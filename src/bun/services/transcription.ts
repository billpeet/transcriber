import OpenAI from "openai";
import { readFile, writeFile, mkdtemp, readdir, rm } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

/**
 * Resolve a binary path: bundled in bin/ > npm static package > system PATH
 */
function resolveBinary(name: string, npmFallback: () => string): string {
	const ext = process.platform === "win32" ? ".exe" : "";
	const bundledPath = join(dirname(process.argv0), `${name}${ext}`);
	if (existsSync(bundledPath)) return bundledPath;

	try {
		return npmFallback();
	} catch {}

	return name;
}

const ffmpegPath = resolveBinary("ffmpeg", () => require("ffmpeg-static"));
const ffprobePath = resolveBinary("ffprobe", () => require("ffprobe-static").path);

const MAX_FILE_SIZE = 24 * 1024 * 1024; // 24MB to stay safely under Whisper's 25MB limit
const CHUNK_DURATION_MINUTES = 10;

export interface TranscriptionProvider {
	transcribe(filePath: string): Promise<string>;
	transcribeBuffer(buffer: Buffer, fileName: string): Promise<string>;
}

export class WhisperTranscriptionProvider implements TranscriptionProvider {
	private client: OpenAI;

	constructor(apiKey?: string) {
		this.client = new OpenAI({
			apiKey: apiKey || process.env.OPENAI_API_KEY,
		});
	}

	async transcribe(filePath: string): Promise<string> {
		return this.processFromPath(filePath);
	}

	async transcribeBuffer(buffer: Buffer, fileName: string): Promise<string> {
		const tempDir = await mkdtemp(join(tmpdir(), "transcriber-"));
		// Use a sanitized filename to avoid filesystem issues
		const safeFileName = fileName.replace(/[<>:"/\\|?*]/g, "_");
		const tempFile = join(tempDir, safeFileName);
		try {
			await writeFile(tempFile, buffer);
			return await this.processFromPath(tempFile);
		} finally {
			await rm(tempDir, { recursive: true, force: true }).catch(() => {});
		}
	}

	/**
	 * Normalizes audio to mp3 via ffmpeg, then transcribes.
	 * Handles chunking automatically if the normalized file is still over 24MB.
	 */
	private async processFromPath(filePath: string): Promise<string> {
		const tempDir = await mkdtemp(join(tmpdir(), "transcriber-norm-"));
		try {
			// Normalize to mp3 - handles all codec/container issues
			const normalizedFile = join(tempDir, "normalized.mp3");
			await execFileAsync(ffmpegPath, [
				"-i",
				filePath,
				"-c:a",
				"libmp3lame",
				"-q:a",
				"4",
				normalizedFile,
			]);

			const normalizedBuffer = await readFile(normalizedFile);

			if (normalizedBuffer.length <= MAX_FILE_SIZE) {
				return this.transcribeSingle(normalizedBuffer, "audio.mp3");
			}

			// Still too large - split the normalized mp3 into chunks
			// Must await here so finally doesn't delete tempDir before chunking completes
			return await this.transcribeChunked(tempDir, normalizedFile);
		} finally {
			await rm(tempDir, { recursive: true, force: true }).catch(() => {});
		}
	}

	private async transcribeSingle(
		buffer: Buffer,
		fileName: string,
	): Promise<string> {
		const file = new File([buffer], fileName, {
			type: "audio/mpeg",
		});

		const response = await this.client.audio.transcriptions.create({
			model: "whisper-1",
			file,
			response_format: "verbose_json",
		});

		return response.text;
	}

	private async transcribeChunked(
		tempDir: string,
		normalizedFile: string,
	): Promise<string> {
		// Get duration of normalized file
		const { stdout } = await execFileAsync(ffprobePath, [
			"-v", "error",
			"-show_entries", "format=duration",
			"-of", "default=noprint_wrappers=1:nokey=1",
			normalizedFile,
		]);
		const totalDuration = parseFloat(stdout.trim());
		if (!Number.isFinite(totalDuration) || totalDuration <= 0) {
			throw new Error("Could not determine audio duration");
		}

		const chunkSeconds = CHUNK_DURATION_MINUTES * 60;
		const chunkCount = Math.ceil(totalDuration / chunkSeconds);

		// Split into chunks using -ss/-t (avoids broken segment muxer on Windows)
		const chunkFiles: string[] = [];
		for (let i = 0; i < chunkCount; i++) {
			const chunkFile = join(tempDir, `chunk_${String(i).padStart(3, "0")}.mp3`);
			await execFileAsync(ffmpegPath, [
				"-i", normalizedFile,
				"-ss", String(i * chunkSeconds),
				"-t", String(chunkSeconds),
				"-c:a", "copy",
				chunkFile,
			]);
			chunkFiles.push(chunkFile);
		}

		if (chunkFiles.length === 0) {
			throw new Error("ffmpeg produced no chunks");
		}

		const transcripts: string[] = [];
		for (const chunkFile of chunkFiles) {
			const chunkBuffer = await readFile(chunkFile);
			const text = await this.transcribeSingle(chunkBuffer, "chunk.mp3");
			transcripts.push(text);
		}

		return transcripts.join(" ");
	}
}

// Default provider - lazily created to avoid crashing when no API key is set
let provider: TranscriptionProvider | null = null;
let currentApiKey: string | undefined;

export function setTranscriptionProvider(p: TranscriptionProvider) {
	provider = p;
}

export function getTranscriptionProvider(apiKey?: string): TranscriptionProvider {
	const effectiveKey = apiKey || undefined;
	if (!provider || effectiveKey !== currentApiKey) {
		currentApiKey = effectiveKey;
		provider = new WhisperTranscriptionProvider(effectiveKey);
	}
	return provider;
}
