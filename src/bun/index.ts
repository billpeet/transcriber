import { BrowserView, BrowserWindow, Updater, Utils } from "electrobun/bun";
import { copyFile, readFile, writeFile } from "fs/promises";
import { readdirSync } from "fs";
import { join } from "path";
import type { AppRPC, AppSettings, UpdateState } from "../shared/types";
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

// Initialize database
initDatabase();
let settings: AppSettings = loadSettings();

// --- Auto-update state ---
let updateState: UpdateState = {
	available: false,
	ready: false,
	checking: false,
	downloading: false,
};

const UPDATE_CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes

function broadcastUpdateState() {
	try {
		mainWindow?.webview?.rpc?.send?.updateStateChanged({ ...updateState });
	} catch {
		// Window may not be ready yet
	}
}

async function checkAndDownloadUpdate() {
	try {
		const channel = await Updater.localInfo.channel();
		if (channel === "dev") return;

		updateState.checking = true;
		broadcastUpdateState();

		const info = await Updater.checkForUpdate();
		updateState.checking = false;

		if (info.updateAvailable) {
			updateState.available = true;
			updateState.version = info.version;
			broadcastUpdateState();

			// Download in background
			updateState.downloading = true;
			broadcastUpdateState();

			await Updater.downloadUpdate();

			updateState.downloading = false;
			const status = Updater.updateInfo();
			if (status?.updateReady) {
				updateState.ready = true;
			}
			broadcastUpdateState();
		} else {
			updateState.available = false;
			updateState.ready = false;
			broadcastUpdateState();
		}
	} catch (err) {
		updateState.checking = false;
		updateState.downloading = false;
		updateState.error = err instanceof Error ? err.message : String(err);
		broadcastUpdateState();
	}
}

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;

async function getMainViewUrl(): Promise<string> {
	const channel = await Updater.localInfo.channel();
	if (channel === "dev") {
		try {
			await fetch(DEV_SERVER_URL, { method: "HEAD" });
			console.log(`HMR enabled: Using Vite dev server at ${DEV_SERVER_URL}`);
			return DEV_SERVER_URL;
		} catch {
			console.log(
				"Vite dev server not running. Run 'bun run dev:hmr' for HMR support.",
			);
		}
	}
	return "views://mainview/index.html";
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
	const ext = fileName.includes(".") ? fileName.substring(fileName.lastIndexOf(".")) : "";
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

const rpc = BrowserView.defineRPC<AppRPC>({
	maxRequestTime: 300000, // 5 min for long transcriptions
	handlers: {
		requests: {
			selectFiles: async () => {
				const paths = await Utils.openFileDialog({
					startingFolder: Utils.paths.home,
					allowedFileTypes: "mp3,mp4,m4a,wav,webm,ogg,flac,mpeg",
					canChooseFiles: true,
					canChooseDirectory: false,
					allowsMultipleSelection: true,
				});
				return { paths: paths || [] };
			},

			startProcessing: async ({
				id,
				filePath,
				fileData,
				fileName,
				description,
			}) => {
				// Fire off processing in background - don't await
				processFile(id, description, filePath, fileData, fileName);
				return { success: true };
			},

			addJob: ({ id, name, description }) => {
				createJob({ id, name, description });
				return { success: true };
			},

			updateDescription: ({ id, description }) => {
				updateJobDescription(id, description);
				return { success: true };
			},

			removeJob: ({ id }) => {
				deleteJob(id);
				return { success: true };
			},

			retryJob: ({ id }) => {
				const job = getJob(id);
				if (!job) return { success: false, error: "Job not found" };
				if (job.status !== "error") return { success: false, error: "Job is not in error state" };

				// Find the stored file on disk
				const filesDir = getFilesDir();
				const files = readdirSync(filesDir);
				const match = files.find((f) => f.startsWith(id));
				if (!match) return { success: false, error: "Source file not found on disk" };

				const localPath = join(filesDir, match);
				retryFile(id, job.description, localPath, job.transcript);
				return { success: true };
			},

			getJobs: () => {
				return { jobs: getAllJobs() };
			},

			getSettings: () => {
				return { ...settings };
			},

			updateSettings: (partial) => {
				settings = saveSettings(partial);
				return { ...settings };
			},

			checkForUpdate: async () => {
				checkAndDownloadUpdate();
				return { ...updateState };
			},

			applyUpdate: async () => {
				if (updateState.ready) {
					await Updater.applyUpdate();
					return { success: true };
				}
				return { success: false };
			},

			getUpdateState: () => {
				return { ...updateState };
			},

			getAudioFile: async ({ id }) => {
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
			},

			copyToClipboard: ({ text }) => {
				Utils.clipboardWriteText(text);
				return { success: true };
			},

			windowMinimize: () => {
				mainWindow.minimize();
				return { success: true };
			},

			windowMaximize: () => {
				mainWindow.maximize();
				return { success: true };
			},

			windowClose: () => {
				mainWindow.close();
				return { success: true };
			},
		},
		messages: {
			"*": (messageName, payload) => {
				console.log("Message from view:", messageName, payload);
			},
			ping: ({ msg }) => console.log("Ping:", msg),
		},
	},
});

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
		mainWindow.webview.rpc.send.fileStatusUpdate({
			id,
			status: "transcribing",
		});

		const provider = getTranscriptionProvider(settings.openaiApiKey || undefined);
		const transcript = await provider.transcribe(localPath);

		updateJobStatus(id, "transcribed", { transcript });
		mainWindow.webview.rpc.send.fileStatusUpdate({
			id,
			status: "transcribed",
			transcript,
		});

		// Step 2: Summarize
		updateJobStatus(id, "summarizing");
		mainWindow.webview.rpc.send.fileStatusUpdate({
			id,
			status: "summarizing",
			transcript,
		});

		const summary = await summarize(
			transcript,
			settings.summarizationModel,
			description || undefined,
			settings.openrouterApiKey || undefined,
		);

		updateJobStatus(id, "done", { transcript, summary });
		mainWindow.webview.rpc.send.fileStatusUpdate({
			id,
			status: "done",
			transcript,
			summary,
		});
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		console.error(`Processing failed for ${id}:`, error);
		updateJobStatus(id, "error", { error });
		mainWindow.webview.rpc.send.fileStatusUpdate({
			id,
			status: "error",
			error,
		});
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
			mainWindow.webview.rpc.send.fileStatusUpdate({
				id,
				status: "transcribing",
			});

			const provider = getTranscriptionProvider(settings.openaiApiKey || undefined);
			transcript = await provider.transcribe(localPath);

			updateJobStatus(id, "transcribed", { transcript });
			mainWindow.webview.rpc.send.fileStatusUpdate({
				id,
				status: "transcribed",
				transcript,
			});
		}

		// Summarize
		updateJobStatus(id, "summarizing");
		mainWindow.webview.rpc.send.fileStatusUpdate({
			id,
			status: "summarizing",
			transcript,
		});

		const summary = await summarize(
			transcript,
			settings.summarizationModel,
			description || undefined,
			settings.openrouterApiKey || undefined,
		);

		updateJobStatus(id, "done", { transcript, summary });
		mainWindow.webview.rpc.send.fileStatusUpdate({
			id,
			status: "done",
			transcript,
			summary,
		});
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err);
		console.error(`Retry failed for ${id}:`, error);
		updateJobStatus(id, "error", { error });
		mainWindow.webview.rpc.send.fileStatusUpdate({
			id,
			status: "error",
			error,
		});
	}
}

const url = await getMainViewUrl();

const mainWindow = new BrowserWindow({
	title: "Transcriber",
	url,
	rpc,
	...(settings.customTitleBar
		? { titleBarStyle: "hidden" as const, transparent: true }
		: {}),
	frame: {
		width: 1100,
		height: 800,
		x: 150,
		y: 100,
	},
});

console.log("Transcriber app started!");

// Start periodic update checks (first check after 10s, then every 30 min)
setTimeout(() => {
	checkAndDownloadUpdate();
	setInterval(checkAndDownloadUpdate, UPDATE_CHECK_INTERVAL);
}, 10_000);
