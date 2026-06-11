export type FileStatus =
	| "pending"
	| "transcribing"
	| "transcribed"
	| "summarizing"
	| "done"
	| "error";

export interface TranscriptionFile {
	id: string;
	name: string;
	path?: string;
	fileData?: string;
	description: string;
	status: FileStatus;
	error?: string;
	transcript?: string;
	summary?: string;
}

export interface AppSettings {
	summarizationModel: string;
	customTitleBar: boolean;
	openaiApiKey: string;
	openrouterApiKey: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
	summarizationModel: "google/gemini-2.5-flash",
	customTitleBar: true,
	openaiApiKey: "",
	openrouterApiKey: "",
};

/**
 * Whether each required API key is effectively configured —
 * either saved in settings or provided via environment variable (dev).
 */
export interface ApiKeyStatus {
	openai: boolean;
	openrouter: boolean;
}

export interface UpdateState {
	available: boolean;
	ready: boolean;
	checking: boolean;
	downloading: boolean;
	/** Download progress percentage (0-100) while downloading */
	progress?: number;
	error?: string;
	version?: string;
}

export interface FileStatusUpdate {
	id: string;
	status: FileStatus;
	transcript?: string;
	summary?: string;
	error?: string;
}

export interface StartProcessingParams {
	id: string;
	filePath?: string;
	fileData?: string;
	fileName?: string;
	description: string;
}

/**
 * The API exposed to the renderer via the preload script (window.api).
 * Implemented in src/main/preload.ts, handled in src/main/index.ts.
 */
export interface TranscriberApi {
	// File dialogs & processing
	selectFiles(): Promise<{ paths: string[] }>;
	startProcessing(
		params: StartProcessingParams,
	): Promise<{ success: boolean; error?: string }>;

	// Job persistence
	addJob(params: {
		id: string;
		name: string;
		description: string;
	}): Promise<{ success: boolean }>;
	updateDescription(params: {
		id: string;
		description: string;
	}): Promise<{ success: boolean }>;
	removeJob(params: { id: string }): Promise<{ success: boolean }>;
	retryJob(params: { id: string }): Promise<{ success: boolean; error?: string }>;
	getJobs(): Promise<{ jobs: TranscriptionFile[] }>;

	// Settings
	getSettings(): Promise<AppSettings>;
	updateSettings(partial: Partial<AppSettings>): Promise<AppSettings>;
	getApiKeyStatus(): Promise<ApiKeyStatus>;

	/** The application version (from package.json) */
	getAppVersion(): Promise<string>;

	// Auto-update
	checkForUpdate(): Promise<UpdateState>;
	applyUpdate(): Promise<{ success: boolean }>;
	getUpdateState(): Promise<UpdateState>;

	// Misc utilities
	getAudioFile(params: {
		id: string;
	}): Promise<{ data: string; mimeType: string } | { data: null }>;
	copyToClipboard(params: { text: string }): Promise<{ success: boolean }>;
	/** Open an allowlisted https URL in the default browser */
	openExternal(params: { url: string }): Promise<{ success: boolean }>;

	// Window controls (custom titlebar)
	windowMinimize(): void;
	windowMaximize(): void;
	windowClose(): void;

	/** Resolve the on-disk path of a dropped File (empty string if unavailable) */
	getPathForFile(file: File): string;

	// Events (return an unsubscribe function)
	onFileStatusUpdate(callback: (update: FileStatusUpdate) => void): () => void;
	onUpdateState(callback: (state: UpdateState) => void): () => void;
}

declare global {
	interface Window {
		api: TranscriberApi;
	}
}
