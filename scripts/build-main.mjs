import { build } from "esbuild";

/**
 * Bundles the Electron main process and preload script to dist-electron/.
 *
 * Everything is bundled into single CJS files except:
 * - electron (provided by the runtime)
 * - electron-updater (reads resources relative to its own module location)
 * - ffmpeg-static / ffprobe-static (export real on-disk binary paths)
 */
const external = [
	"electron",
	"electron-updater",
	"ffmpeg-static",
	"ffprobe-static",
];

const common = {
	bundle: true,
	platform: "node",
	format: "cjs",
	target: "node22",
	sourcemap: true,
	external,
	logLevel: "info",
};

await build({
	...common,
	entryPoints: ["src/main/index.ts"],
	outfile: "dist-electron/main.cjs",
});

await build({
	...common,
	entryPoints: ["src/main/preload.ts"],
	outfile: "dist-electron/preload.cjs",
	external: ["electron"],
});
