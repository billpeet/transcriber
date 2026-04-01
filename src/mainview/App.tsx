import { useState, useEffect, useCallback, useRef } from "react";
import { Electroview } from "electrobun/view";
import type { AppRPC, TranscriptionFile, FileStatus, UpdateState } from "../shared/types";
import { FileUpload } from "./components/FileUpload";
import { FileItem } from "./components/FileItem";
import { Settings as SettingsComponent } from "./components/Settings";
import { TitleBar } from "./components/TitleBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DEFAULT_SETTINGS } from "../shared/types";
import type { AppSettings } from "../shared/types";
import { Mic, Settings } from "lucide-react";

let electroview: InstanceType<typeof Electroview> | null = null;

function App() {
	const [files, setFiles] = useState<TranscriptionFile[]>([]);
	const [showSettings, setShowSettings] = useState(false);
	const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
	const [updateState, setUpdateState] = useState<UpdateState>({
		available: false,
		ready: false,
		checking: false,
		downloading: false,
	});
	const electroviewRef = useRef(electroview);
	const filesRef = useRef(files);
	filesRef.current = files;

	useEffect(() => {
		if (electroviewRef.current) return;

		const rpc = Electroview.defineRPC<AppRPC>({
			handlers: {
				requests: {},
				messages: {
					updateStateChanged: (state) => {
						setUpdateState(state);
					},
					fileStatusUpdate: ({ id, status, transcript, summary, error }) => {
						setFiles((prev) =>
							prev.map((f) =>
								f.id === id
									? {
											...f,
											status: status as FileStatus,
											...(transcript !== undefined && { transcript }),
											...(summary !== undefined && { summary }),
											...(error !== undefined && { error }),
										}
									: f,
							),
						);
					},
				},
			},
		});

		electroview = new Electroview({ rpc });
		electroviewRef.current = electroview;

		// Load persisted data on startup
		electroview.rpc.request.getSettings({}).then(setSettings);
		electroview.rpc.request.getJobs({}).then(({ jobs }) => setFiles(jobs));
		electroview.rpc.request.getUpdateState({}).then(setUpdateState);
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
			electroviewRef.current?.rpc.request.addJob({
				id: file.id,
				name: file.name,
				description: "",
			});
		}
	}, []);

	const addFilesFromDropped = useCallback((droppedFiles: File[]) => {
		// Optimistic update — add files to UI immediately before reading data
		const placeholders: TranscriptionFile[] = droppedFiles.map((f) => ({
			id: crypto.randomUUID(),
			name: f.name,
			description: "",
			status: "pending" as const,
		}));
		setFiles((prev) => [...prev, ...placeholders]);

		// Persist to DB immediately (doesn't need file data)
		for (const file of placeholders) {
			electroviewRef.current?.rpc.request.addJob({
				id: file.id,
				name: file.name,
				description: "",
			});
		}

		// Read base64 data in background and attach to existing files
		for (let i = 0; i < droppedFiles.length; i++) {
			const f = droppedFiles[i];
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
	}, []);

	const handleBrowse = useCallback(async () => {
		if (!electroviewRef.current) return;
		const { paths } = await electroviewRef.current.rpc.request.selectFiles({});
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
			electroviewRef.current?.rpc.request.updateDescription({ id, description });
		},
		[],
	);

	const handleProcess = useCallback(async (id: string) => {
		const file = filesRef.current.find((f) => f.id === id);
		if (!file || !electroviewRef.current) return;

		// Optimistic update — show transcribing immediately
		setFiles((prev) =>
			prev.map((f) =>
				f.id === id ? { ...f, status: "transcribing" as const } : f,
			),
		);

		await electroviewRef.current.rpc.request.startProcessing({
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
		if (!electroviewRef.current || pendingFiles.length === 0) return;

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
			await electroviewRef.current.rpc.request.startProcessing({
				id: file.id,
				filePath: file.path,
				fileData: file.fileData,
				fileName: file.name,
				description: file.description,
			});
		}
	}, []);

	const handleRetry = useCallback(async (id: string) => {
		if (!electroviewRef.current) return;

		// Optimistic update — show processing immediately
		setFiles((prev) =>
			prev.map((f) =>
				f.id === id ? { ...f, status: "transcribing" as const, error: undefined } : f,
			),
		);

		await electroviewRef.current.rpc.request.retryJob({ id });
	}, []);

	const handleRemove = useCallback((id: string) => {
		setFiles((prev) => prev.filter((f) => f.id !== id));
		electroviewRef.current?.rpc.request.removeJob({ id });
	}, []);

	const handleCopy = useCallback(async (text: string) => {
		if (!electroviewRef.current) return;
		await electroviewRef.current.rpc.request.copyToClipboard({ text });
	}, []);

	const handleGetAudioFile = useCallback(async (id: string) => {
		if (!electroviewRef.current) return { data: null } as { data: null };
		return electroviewRef.current.rpc.request.getAudioFile({ id });
	}, []);

	const handleSaveSettings = useCallback(async (partial: Partial<AppSettings>) => {
		if (!electroviewRef.current) return;
		const updated = await electroviewRef.current.rpc.request.updateSettings(partial);
		setSettings(updated);
	}, []);

	const handleRestartToUpdate = useCallback(async () => {
		if (!electroviewRef.current) return;
		await electroviewRef.current.rpc.request.applyUpdate({});
	}, []);

	const handleWindowMinimize = useCallback(() => {
		electroviewRef.current?.rpc.request.windowMinimize({});
	}, []);

	const handleWindowMaximize = useCallback(() => {
		electroviewRef.current?.rpc.request.windowMaximize({});
	}, []);

	const handleWindowClose = useCallback(() => {
		electroviewRef.current?.rpc.request.windowClose({});
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
			className={`min-h-screen bg-zinc-950 text-zinc-100${settings.customTitleBar ? " rounded-lg overflow-hidden" : ""}`}
			style={settings.customTitleBar ? { paddingTop: 36 } : undefined}
		>
			{settings.customTitleBar && (
				<TitleBar
					onMinimize={handleWindowMinimize}
					onMaximize={handleWindowMaximize}
					onClose={handleWindowClose}
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
		</div>
	);
}

export default App;
