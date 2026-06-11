import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	root: "src/mainview",
	// Relative asset paths so the bundle works when loaded via file:// in Electron
	base: "./",
	build: {
		outDir: "../../dist",
		emptyOutDir: true,
	},
	server: {
		port: 5173,
		strictPort: true,
	},
});
