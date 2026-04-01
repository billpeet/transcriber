import type { RPCSchema } from "electrobun/bun";

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
	customTitleBar: false,
	openaiApiKey: "",
	openrouterApiKey: "",
};

export interface UpdateState {
	available: boolean;
	ready: boolean;
	checking: boolean;
	downloading: boolean;
	error?: string;
	version?: string;
}

export type AppRPC = {
	bun: RPCSchema<{
		requests: {
			selectFiles: {
				params: {};
				response: { paths: string[] };
			};
			startProcessing: {
				params: {
					id: string;
					filePath?: string;
					fileData?: string;
					fileName?: string;
					description: string;
				};
				response: { success: boolean; error?: string };
			};
			addJob: {
				params: { id: string; name: string; description: string };
				response: { success: boolean };
			};
			updateDescription: {
				params: { id: string; description: string };
				response: { success: boolean };
			};
			removeJob: {
				params: { id: string };
				response: { success: boolean };
			};
			retryJob: {
				params: { id: string };
				response: { success: boolean; error?: string };
			};
			getJobs: {
				params: {};
				response: { jobs: TranscriptionFile[] };
			};
			getSettings: {
				params: {};
				response: AppSettings;
			};
			updateSettings: {
				params: Partial<AppSettings>;
				response: AppSettings;
			};
			checkForUpdate: {
				params: {};
				response: UpdateState;
			};
			applyUpdate: {
				params: {};
				response: { success: boolean };
			};
			getUpdateState: {
				params: {};
				response: UpdateState;
			};
			getAudioFile: {
				params: { id: string };
				response: { data: string; mimeType: string } | { data: null };
			};
			copyToClipboard: {
				params: { text: string };
				response: { success: boolean };
			};
			windowMinimize: {
				params: {};
				response: { success: boolean };
			};
			windowMaximize: {
				params: {};
				response: { success: boolean };
			};
			windowClose: {
				params: {};
				response: { success: boolean };
			};
		};
		messages: {
			ping: { msg: string };
		};
	}>;
	webview: RPCSchema<{
		requests: {};
		messages: {
			fileStatusUpdate: {
				id: string;
				status: FileStatus;
				transcript?: string;
				summary?: string;
				error?: string;
			};
			updateStateChanged: UpdateState;
		};
	}>;
};
