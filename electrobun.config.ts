import type { ElectrobunConfig } from "electrobun";

const GITHUB_OWNER = process.env.GITHUB_REPOSITORY?.split("/")[0] || "OWNER";
const GITHUB_REPO = process.env.GITHUB_REPOSITORY?.split("/")[1] || "transcriber";

export default {
	app: {
		name: "Transcriber",
		identifier: "transcriber.electrobun.dev",
		version: "0.0.1",
	},
	build: {
		// Vite builds to dist/, we copy from there
		copy: {
			"dist/index.html": "views/mainview/index.html",
			"dist/assets": "views/mainview/assets",
		},
		// Ignore Vite output in watch mode — HMR handles view rebuilds separately
		watchIgnore: ["dist/**"],
		mac: {
			bundleCEF: false,
		},
		linux: {
			bundleCEF: false,
			icon: "build/icon-256.png",
		},
		win: {
			bundleCEF: false,
			icon: "build/icon.ico",
		},
	},
	release: {
		baseUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download`,
	},
} satisfies ElectrobunConfig;
