import {
	app,
	BrowserWindow,
	clipboard,
	dialog,
	ipcMain,
	shell,
} from "electron";
import { copyFile, readFile, writeFile } from "fs/promises";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import type {
	AppSettings,
	FileStatusUpdate,
	StartProcessingParams,
} from "../shared/types";
import { getTranscriptionProvider } from "./services/transcription";
import { summarize } from "./services/summarization";
import {
	initDatabase,
	createJob,
	updateJobStatus,
	updateJobDescription,
	deleteJob,
	getJob,
	getAllJobs,
	loadSettings,
	saveSettings,
	getFilesDir,
} from "./services/database";
import {
	applyUpdate,
	checkForUpdates,
	getUpdateState,
	initUpdater,
} from "./updater";

const DEV_SERVER_URL = "http://localhost:5173";

// Single instance lock — focus the existing window instead of opening a second app
if (!app.requestSingleInstanceLock()) {
	app.quit();
}

app.setAppUserModelId("com.billpeet.transcriber");

// Load .env in development (UI-configured keys take priority over env vars)
if (!app.isPackaged) {
	try {
		process.loadEnvFile(join(app.getAppPath(), ".env"));
	} catch {
		// No .env file — fine
	}
}

let mainWindow: BrowserWindow | null = null;
let settings: AppSettings;

function sendToWindow(channel: string, payload: unknown) {
	try {
		mainWindow?.webContents.send(channel, payload);
	} catch {
		// Window may have been closed
	}
}

function sendFileStatus(update: FileStatusUpdate) {
	sendToWindow("file-status-update", update);
}

/**
 * Copy the source audio file into the app's local storage.
 * Returns the local file path.
 */
async function storeFile(
	id: string,
	fileName: string,
	filePath?: string,
	fileData?: string,
): Promise<string> {
	const filesDir = getFilesDir();
	const ext = fileName.includes(".")
		? fileName.substring(fileName.lastIndexOf("."))
		: "";
	const localPath = join(filesDir, `${id}${ext}`);

	if (filePath) {
		await copyFile(filePath, localPath);
	} else if (fileData) {
		await writeFile(localPath, Buffer.from(fileData, "base64"));
	} else {
		throw new Error("No file path or file data provided");
	}

	return localPath;
}

async function processFile(
	id: string,
	description: string,
	filePath?: string,
	fileData?: string,
	fileName?: string,
) {
	try {
		// Step 0: Store file locally
		const name = fileName || filePath?.split(/[/\\]/).pop() || "audio";
		const localPath = await storeFile(id, name, filePath, fileData);

		// Step 1: Transcribe
		updateJobStatus(id, "transcribing");
		sendFileStatus({ id, status: "transcribing" });

		const provider = getTranscriptionProvider(settings.openaiApiKey || undefined);
		const transcript = await provider.transcribe(localPath);

		updateJobStatus(id, "transcribed", { transcript });
		sendFileStatus({ id, status: "transcribed", transcript });

		// Step 2: Summarize
		updateJobStatus(id, "summarizing");
		sendFileStatus({ id, status: "summarizing", transcript });

		const summary = await summarize(
			transcript,
			settings.summarizationModel,
			description || undefined,
			settings.openrouterApiKey || undefined,
		);

		updateJobStatus(id, "done", { transcript, summary });
		sendFileStatus({ id, status: "done", transcript, summary });
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		console.error(`Processing failed for ${id}:`, error);
		updateJobStatus(id, "error", { error });
		sendFileStatus({ id, status: "error", error });
	}
}

async function retryFile(
	id: string,
	description: string,
	localPath: string,
	existingTranscript?: string,
) {
	try {
		let transcript = existingTranscript;

		if (!transcript) {
			// Need to re-transcribe
			updateJobStatus(id, "transcribing");
			sendFileStatus({ id, status: "transcribing" });

			const provider = getTranscriptionProvider(settings.openaiApiKey || undefined);
			transcript = await provider.transcribe(localPath);

			updateJobStatus(id, "transcribed", { transcript });
			sendFileStatus({ id, status: "transcribed", transcript });
		}

		// Summarize
		updateJobStatus(id, "summarizing");
		sendFileStatus({ id, status: "summarizing", transcript });

		const summary = await summarize(
			transcript,
			settings.summarizationModel,
			description || undefined,
			settings.openrouterApiKey || undefined,
		);

		updateJobStatus(id, "done", { transcript, summary });
		sendFileStatus({ id, status: "done", transcript, summary });
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		console.error(`Retry failed for ${id}:`, error);
		updateJobStatus(id, "error", { error });
		sendFileStatus({ id, status: "error", error });
	}
}

function registerIpcHandlers() {
	ipcMain.handle("files:select", async () => {
		if (!mainWindow) return { paths: [] };
		const result = await dialog.showOpenDialog(mainWindow, {
			properties: ["openFile", "multiSelections"],
			filters: [
				{
					name: "Audio Files",
					extensions: ["mp3", "mp4", "m4a", "wav", "webm", "ogg", "flac", "mpeg"],
				},
			],
		});
		return { paths: result.canceled ? [] : result.filePaths };
	});

	ipcMain.handle(
		"jobs:start",
		(_event, params: StartProcessingParams) => {
			const { id, filePath, fileData, fileName, description } = params;
			// Fire off processing in background - don't await
			processFile(id, description, filePath, fileData, fileName);
			return { success: true };
		},
	);

	ipcMain.handle(
		"jobs:add",
		(_event, params: { id: string; name: string; description: string }) => {
			createJob(params);
			return { success: true };
		},
	);

	ipcMain.handle(
		"jobs:update-description",
		(_event, { id, description }: { id: string; description: string }) => {
			updateJobDescription(id, description);
			return { success: true };
		},
	);

	ipcMain.handle("jobs:remove", (_event, { id }: { id: string }) => {
		deleteJob(id);
		return { success: true };
	});

	ipcMain.handle("jobs:retry", (_event, { id }: { id: string }) => {
		const job = getJob(id);
		if (!job) return { success: false, error: "Job not found" };
		if (job.status !== "error")
			return { success: false, error: "Job is not in error state" };

		// Find the stored file on disk
		const filesDir = getFilesDir();
		const files = readdirSync(filesDir);
		const match = files.find((f) => f.startsWith(id));
		if (!match) return { success: false, error: "Source file not found on disk" };

		const localPath = join(filesDir, match);
		retryFile(id, job.description, localPath, job.transcript);
		return { success: true };
	});

	ipcMain.handle("jobs:get-all", () => {
		return { jobs: getAllJobs() };
	});

	ipcMain.handle("settings:get", () => {
		return { ...settings };
	});

	ipcMain.handle("settings:update", (_event, partial: Partial<AppSettings>) => {
		settings = saveSettings(partial);
		return { ...settings };
	});

	// Whether each required API key is effectively configured
	// (saved in settings, or provided via env var in development)
	ipcMain.handle("settings:key-status", () => ({
		openai: Boolean(settings.openaiApiKey || process.env.OPENAI_API_KEY),
		openrouter: Boolean(
			settings.openrouterApiKey || process.env.OPENROUTER_API_KEY,
		),
	}));

	ipcMain.handle("shell:open-external", (_event, { url }: { url: string }) => {
		try {
			const parsed = new URL(url);
			const allowedHosts = new Set(["platform.openai.com", "openrouter.ai"]);
			if (parsed.protocol !== "https:" || !allowedHosts.has(parsed.hostname)) {
				return { success: false };
			}
			shell.openExternal(parsed.toString());
			return { success: true };
		} catch {
			return { success: false };
		}
	});

	ipcMain.handle("update:check", () => {
		checkForUpdates();
		return getUpdateState();
	});

	ipcMain.handle("update:apply", () => {
		return { success: applyUpdate() };
	});

	ipcMain.handle("update:get-state", () => {
		return getUpdateState();
	});

	ipcMain.handle("files:get-audio", async (_event, { id }: { id: string }) => {
		const filesDir = getFilesDir();
		const files = readdirSync(filesDir);
		const match = files.find((f) => f.startsWith(id));
		if (!match) return { data: null };

		const filePath = join(filesDir, match);
		const buffer = await readFile(filePath);
		const ext = match.substring(match.lastIndexOf(".")).toLowerCase();
		const mimeMap: Record<string, string> = {
			".mp3": "audio/mpeg",
			".m4a": "audio/mp4",
			".mp4": "audio/mp4",
			".wav": "audio/wav",
			".webm": "audio/webm",
			".ogg": "audio/ogg",
			".flac": "audio/flac",
		};
		return {
			data: buffer.toString("base64"),
			mimeType: mimeMap[ext] || "audio/mpeg",
		};
	});

	ipcMain.handle("clipboard:write", (_event, { text }: { text: string }) => {
		clipboard.writeText(text);
		return { success: true };
	});

	// Window controls for the custom titlebar
	ipcMain.on("window:minimize", () => {
		mainWindow?.minimize();
	});

	ipcMain.on("window:maximize", () => {
		if (!mainWindow) return;
		if (mainWindow.isMaximized()) {
			mainWindow.unmaximize();
		} else {
			mainWindow.maximize();
		}
	});

	ipcMain.on("window:close", () => {
		mainWindow?.close();
	});
}

async function resolveMainViewUrl(): Promise<string | null> {
	if (app.isPackaged) return null;
	try {
		await fetch(DEV_SERVER_URL, { method: "HEAD" });
		console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
		return DEV_SERVER_URL;
	} catch {
		console.log(
			"Vite dev server not running. Run 'npm run dev' for HMR support.",
		);
		return null;
	}
}

async function createWindow() {
	mainWindow = new BrowserWindow({
		title: "Transcriber",
		width: 1100,
		height: 800,
		minWidth: 640,
		minHeight: 480,
		backgroundColor: "#09090b", // matches bg-zinc-950
		show: false,
		...(settings.customTitleBar ? { frame: false } : {}),
		webPreferences: {
			preload: join(__dirname, "preload.cjs"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});

	mainWindow.once("ready-to-show", () => mainWindow?.show());
	mainWindow.on("closed", () => {
		mainWindow = null;
	});

	const devUrl = await resolveMainViewUrl();
	if (devUrl) {
		await mainWindow.loadURL(devUrl);
	} else {
		const indexPath = join(__dirname, "..", "dist", "index.html");
		if (!existsSync(indexPath)) {
			console.error(
				`Renderer bundle not found at ${indexPath}. Run 'npm run build' first.`,
			);
		}
		await mainWindow.loadFile(indexPath);
	}
}

app.on("second-instance", () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) mainWindow.restore();
		mainWindow.focus();
	}
});

app.whenReady().then(async () => {
	initDatabase();
	settings = loadSettings();

	registerIpcHandlers();
	initUpdater(() => mainWindow);

	await createWindow();

	app.on("activate", () => {
		// macOS: re-create the window when the dock icon is clicked
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});

	console.log("Transcriber app started!");
});

app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});
