import { useState, useEffect, useCallback, useRef } from "react";
import type { TranscriptionFile, UpdateState } from "../shared/types";
import { FileUpload } from "./components/FileUpload";
import { FileItem } from "./components/FileItem";
import { Settings as SettingsComponent } from "./components/Settings";
import { Onboarding } from "./components/Onboarding";
import { TitleBar } from "./components/TitleBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DEFAULT_SETTINGS } from "../shared/types";
import type { ApiKeyStatus, AppSettings } from "../shared/types";
import { Mic, Settings } from "lucide-react";

const api = window.api;

function App() {
	const [files, setFiles] = useState<TranscriptionFile[]>([]);
	const [showSettings, setShowSettings] = useState(false);
	const [showOnboarding, setShowOnboarding] = useState(false);
	const [keyStatus, setKeyStatus] = useState<ApiKeyStatus>({
		openai: true,
		openrouter: true,
	});
	const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
	const [updateState, setUpdateState] = useState<UpdateState>({
		available: false,
		ready: false,
		checking: false,
		downloading: false,
	});
	const filesRef = useRef(files);
	filesRef.current = files;

	useEffect(() => {
		const unsubscribeStatus = api.onFileStatusUpdate(
			({ id, status, transcript, summary, error }) => {
				setFiles((prev) =>
					prev.map((f) =>
						f.id === id
							? {
									...f,
									status,
									...(transcript !== undefined && { transcript }),
									...(summary !== undefined && { summary }),
									...(error !== undefined && { error }),
								}
							: f,
					),
				);
			},
		);
		const unsubscribeUpdate = api.onUpdateState(setUpdateState);

		// Load persisted data on startup
		api.getSettings().then(setSettings);
		api.getJobs().then(({ jobs }) => setFiles(jobs));
		api.getUpdateState().then(setUpdateState);

		// First-run onboarding: show when API keys aren't configured yet
		api.getApiKeyStatus().then((status) => {
			setKeyStatus(status);
			if (!status.openai || !status.openrouter) {
				setShowOnboarding(true);
			}
		});

		return () => {
			unsubscribeStatus();
			unsubscribeUpdate();
		};
	}, []);

	const addFilesFromPaths = useCallback((paths: string[]) => {
		const newFiles: TranscriptionFile[] = paths.map((path) => ({
			id: crypto.randomUUID(),
			name: path.split(/[/\\]/).pop() || "Unknown file",
			path,
			description: "",
			status: "pending" as const,
		}));
		setFiles((prev) => [...prev, ...newFiles]);
		// Persist each new job to DB
		for (const file of newFiles) {
			api.addJob({ id: file.id, name: file.name, description: "" });
		}
	}, []);

	const addFilesFromDropped = useCallback(
		(droppedFiles: File[]) => {
			// In Electron we can resolve real paths for dropped files via the preload
			const withPaths = droppedFiles.map((f) => ({
				file: f,
				path: api.getPathForFile(f),
			}));

			const pathFiles = withPaths.filter((f) => f.path).map((f) => f.path);
			if (pathFiles.length > 0) {
				addFilesFromPaths(pathFiles);
			}

			// Fallback for files without a resolvable path: read data in renderer
			const dataFiles = withPaths.filter((f) => !f.path).map((f) => f.file);
			if (dataFiles.length === 0) return;

			// Optimistic update — add files to UI immediately before reading data
			const placeholders: TranscriptionFile[] = dataFiles.map((f) => ({
				id: crypto.randomUUID(),
				name: f.name,
				description: "",
				status: "pending" as const,
			}));
			setFiles((prev) => [...prev, ...placeholders]);

			// Persist to DB immediately (doesn't need file data)
			for (const file of placeholders) {
				api.addJob({ id: file.id, name: file.name, description: "" });
			}

			// Read base64 data in background and attach to existing files
			for (let i = 0; i < dataFiles.length; i++) {
				const f = dataFiles[i];
				const id = placeholders[i].id;
				f.arrayBuffer().then((buffer) => {
					const bytes = new Uint8Array(buffer);
					let binary = "";
					for (let j = 0; j < bytes.length; j++) {
						binary += String.fromCharCode(bytes[j]);
					}
					const base64 = btoa(binary);
					setFiles((prev) =>
						prev.map((file) =>
							file.id === id ? { ...file, fileData: base64 } : file,
						),
					);
				});
			}
		},
		[addFilesFromPaths],
	);

	const handleBrowse = useCallback(async () => {
		const { paths } = await api.selectFiles();
		if (paths.length > 0) {
			addFilesFromPaths(paths);
		}
	}, [addFilesFromPaths]);

	const handleDroppedFiles = useCallback(
		(droppedFiles: File[]) => {
			addFilesFromDropped(droppedFiles);
		},
		[addFilesFromDropped],
	);

	const handleDescriptionChange = useCallback(
		(id: string, description: string) => {
			setFiles((prev) =>
				prev.map((f) => (f.id === id ? { ...f, description } : f)),
			);
			api.updateDescription({ id, description });
		},
		[],
	);

	const handleProcess = useCallback(async (id: string) => {
		const file = filesRef.current.find((f) => f.id === id);
		if (!file) return;

		// Optimistic update — show transcribing immediately
		setFiles((prev) =>
			prev.map((f) =>
				f.id === id ? { ...f, status: "transcribing" as const } : f,
			),
		);

		await api.startProcessing({
			id: file.id,
			filePath: file.path,
			fileData: file.fileData,
			fileName: file.name,
			description: file.description,
		});
	}, []);

	const handleProcessAll = useCallback(async () => {
		const pendingFiles = filesRef.current.filter(
			(f) => f.status === "pending",
		);
		if (pendingFiles.length === 0) return;

		// Optimistic update — show all as transcribing immediately
		const pendingIds = new Set(pendingFiles.map((f) => f.id));
		setFiles((prev) =>
			prev.map((f) =>
				pendingIds.has(f.id)
					? { ...f, status: "transcribing" as const }
					: f,
			),
		);

		for (const file of pendingFiles) {
			await api.startProcessing({
				id: file.id,
				filePath: file.path,
				fileData: file.fileData,
				fileName: file.name,
				description: file.description,
			});
		}
	}, []);

	const handleRetry = useCallback(async (id: string) => {
		// Optimistic update — show processing immediately
		setFiles((prev) =>
			prev.map((f) =>
				f.id === id ? { ...f, status: "transcribing" as const, error: undefined } : f,
			),
		);

		await api.retryJob({ id });
	}, []);

	const handleRemove = useCallback((id: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== id));
		api.removeJob({ id });
	}, []);

	const handleCopy = useCallback(async (text: string) => {
		await api.copyToClipboard({ text });
	}, []);

	const handleGetAudioFile = useCallback(async (id: string) => {
		return api.getAudioFile({ id });
	}, []);

	const handleSaveSettings = useCallback(async (partial: Partial<AppSettings>) => {
		const updated = await api.updateSettings(partial);
		setSettings(updated);
		api.getApiKeyStatus().then(setKeyStatus);
	}, []);

	const handleOnboardingComplete = useCallback(
		async (partial: Partial<AppSettings>) => {
			await handleSaveSettings(partial);
			setShowOnboarding(false);
		},
		[handleSaveSettings],
	);

	const handleOpenExternal = useCallback((url: string) => {
		api.openExternal({ url });
	}, []);

	const handleRestartToUpdate = useCallback(async () => {
		await api.applyUpdate();
	}, []);

	const pendingCount = files.filter((f) => f.status === "pending").length;
	const processingCount = files.filter(
		(f) =>
			f.status === "transcribing" ||
			f.status === "transcribed" ||
			f.status === "summarizing",
	).length;
	const doneCount = files.filter((f) => f.status === "done").length;

	return (
		<div
			className="min-h-screen bg-zinc-950 text-zinc-100"
			style={settings.customTitleBar ? { paddingTop: 36 } : undefined}
		>
			{settings.customTitleBar && (
				<TitleBar
					onMinimize={() => api.windowMinimize()}
					onMaximize={() => api.windowMaximize()}
					onClose={() => api.windowClose()}
				/>
			)}

			<UpdateBanner
				updateState={updateState}
				onRestart={handleRestartToUpdate}
			/>

			{/* Header */}
			<header className="border-b border-zinc-800 bg-zinc-950">
				<div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
							<Mic className="w-4 h-4 text-white" />
						</div>
						<div>
							<h1 className="text-lg font-semibold">Transcriber</h1>
							<p className="text-xs text-zinc-500">
								Transcribe & summarize audio files
							</p>
						</div>
					</div>

					<div className="flex items-center gap-3">
						{files.length > 0 && (
							<>
								<div className="text-xs text-zinc-500 space-x-3">
									{processingCount > 0 && (
										<span className="text-amber-400">
											{processingCount} processing
										</span>
									)}
									{doneCount > 0 && (
										<span className="text-emerald-400">{doneCount} done</span>
									)}
								</div>
								{pendingCount > 1 && (
									<button
										type="button"
										onClick={handleProcessAll}
										className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md transition-colors"
									>
										Transcribe All ({pendingCount})
									</button>
								)}
							</>
						)}
						<button
							type="button"
							onClick={() => setShowSettings(true)}
							className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
						>
							<Settings className="w-4 h-4" />
						</button>
					</div>
				</div>
			</header>

			{/* Main content */}
			<main className="max-w-3xl mx-auto px-6 py-6 space-y-4">
				<FileUpload
					onFilesSelected={handleDroppedFiles}
					onBrowse={handleBrowse}
				/>

				{files.length > 0 && (
					<div className="space-y-2">
						{files.map((file) => (
							<ErrorBoundary key={file.id} fallback={(error, reset) => (
								<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-center justify-between">
									<div>
										<p className="text-sm text-red-400">{file.name} — render error</p>
										<p className="text-xs text-red-400/70 mt-0.5">{error.message}</p>
									</div>
									<div className="flex gap-2">
										<button type="button" onClick={reset} className="text-xs text-red-400 underline hover:text-red-300">Retry</button>
										<button type="button" onClick={() => handleRemove(file.id)} className="text-xs text-zinc-500 underline hover:text-zinc-400">Remove</button>
									</div>
								</div>
							)}>
								<FileItem
									file={file}
									onDescriptionChange={handleDescriptionChange}
									onProcess={handleProcess}
									onRetry={handleRetry}
									onRemove={handleRemove}
									onCopy={handleCopy}
									onGetAudioFile={handleGetAudioFile}
								/>
							</ErrorBoundary>
						))}
					</div>
				)}

				{files.length === 0 && (
					<div className="text-center py-12">
						<p className="text-zinc-600 text-sm">
							No files yet. Upload audio files to get started.
						</p>
					</div>
				)}
			</main>
			{showSettings && (
				<SettingsComponent
					settings={settings}
					onSave={handleSaveSettings}
					onClose={() => setShowSettings(false)}
				/>
			)}
			{showOnboarding && !showSettings && (
				<Onboarding
					keyStatus={keyStatus}
					onComplete={handleOnboardingComplete}
					onSkip={() => setShowOnboarding(false)}
					onOpenExternal={handleOpenExternal}
				/>
			)}
		</div>
	);
}

export default App;
