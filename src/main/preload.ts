import { contextBridge, ipcRenderer, webUtils } from "electron";
import type {
	FileStatusUpdate,
	TranscriberApi,
	UpdateState,
} from "../shared/types";

function subscribe<T>(channel: string, callback: (payload: T) => void) {
	const listener = (_event: Electron.IpcRendererEvent, payload: T) =>
		callback(payload);
	ipcRenderer.on(channel, listener);
	return () => {
		ipcRenderer.removeListener(channel, listener);
	};
}

const api: TranscriberApi = {
	selectFiles: () => ipcRenderer.invoke("files:select"),
	startProcessing: (params) => ipcRenderer.invoke("jobs:start", params),

	addJob: (params) => ipcRenderer.invoke("jobs:add", params),
	updateDescription: (params) =>
		ipcRenderer.invoke("jobs:update-description", params),
	removeJob: (params) => ipcRenderer.invoke("jobs:remove", params),
	retryJob: (params) => ipcRenderer.invoke("jobs:retry", params),
	getJobs: () => ipcRenderer.invoke("jobs:get-all"),

	getSettings: () => ipcRenderer.invoke("settings:get"),
	updateSettings: (partial) => ipcRenderer.invoke("settings:update", partial),
	getApiKeyStatus: () => ipcRenderer.invoke("settings:key-status"),

	getAppVersion: () => ipcRenderer.invoke("app:get-version"),

	checkForUpdate: () => ipcRenderer.invoke("update:check"),
	applyUpdate: () => ipcRenderer.invoke("update:apply"),
	getUpdateState: () => ipcRenderer.invoke("update:get-state"),

	getAudioFile: (params) => ipcRenderer.invoke("files:get-audio", params),
	copyToClipboard: (params) => ipcRenderer.invoke("clipboard:write", params),
	openExternal: (params) => ipcRenderer.invoke("shell:open-external", params),

	windowMinimize: () => ipcRenderer.send("window:minimize"),
	windowMaximize: () => ipcRenderer.send("window:maximize"),
	windowClose: () => ipcRenderer.send("window:close"),

	getPathForFile: (file) => {
		try {
			return webUtils.getPathForFile(file);
		} catch {
			return "";
		}
	},

	onFileStatusUpdate: (callback) =>
		subscribe<FileStatusUpdate>("file-status-update", callback),
	onUpdateState: (callback) =>
		subscribe<UpdateState>("update-state", callback),
};

contextBridge.exposeInMainWorld("api", api);
