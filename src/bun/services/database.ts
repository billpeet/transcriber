import { Database } from "bun:sqlite";
import { Utils } from "electrobun/bun";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import type { AppSettings, TranscriptionFile } from "../../shared/types";
import { DEFAULT_SETTINGS } from "../../shared/types";

let db: Database;

export function initDatabase(): Database {
	const dataDir = Utils.paths.userData;
	if (!existsSync(dataDir)) {
		mkdirSync(dataDir, { recursive: true });
	}

	const dbPath = join(dataDir, "transcriber.db");
	console.log("Database path:", dbPath);

	db = new Database(dbPath);
	db.exec("PRAGMA journal_mode = WAL");
	db.exec("PRAGMA foreign_keys = ON");

	db.exec(`
		CREATE TABLE IF NOT EXISTS jobs (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			file_path TEXT,
			description TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'pending',
			error TEXT,
			transcript TEXT,
			summary TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now')),
			updated_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

	db.exec(`
		CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)
	`);

	return db;
}

// --- Jobs ---

export function createJob(file: {
	id: string;
	name: string;
	filePath?: string;
	description: string;
}): void {
	db.prepare(
		`INSERT INTO jobs (id, name, file_path, description, status)
		 VALUES (?, ?, ?, ?, 'pending')`,
	).run(file.id, file.name, file.filePath ?? null, file.description);
}

export function updateJobStatus(
	id: string,
	status: string,
	data?: { transcript?: string; summary?: string; error?: string },
): void {
	const sets = ["status = ?", "updated_at = datetime('now')"];
	const params: (string | null)[] = [status];

	if (data?.transcript !== undefined) {
		sets.push("transcript = ?");
		params.push(data.transcript);
	}
	if (data?.summary !== undefined) {
		sets.push("summary = ?");
		params.push(data.summary);
	}
	if (data?.error !== undefined) {
		sets.push("error = ?");
		params.push(data.error);
	}

	params.push(id);
	db.prepare(`UPDATE jobs SET ${sets.join(", ")} WHERE id = ?`).run(
		...params,
	);
}

export function updateJobDescription(
	id: string,
	description: string,
): void {
	db.prepare(
		`UPDATE jobs SET description = ?, updated_at = datetime('now') WHERE id = ?`,
	).run(description, id);
}

export function getJob(id: string): TranscriptionFile | undefined {
	const row = db
		.prepare(
			`SELECT id, name, file_path, description, status, error, transcript, summary
			 FROM jobs WHERE id = ?`,
		)
		.get(id) as {
		id: string;
		name: string;
		file_path: string | null;
		description: string;
		status: string;
		error: string | null;
		transcript: string | null;
		summary: string | null;
	} | null;

	if (!row) return undefined;

	return {
		id: row.id,
		name: row.name,
		path: row.file_path ?? undefined,
		description: row.description,
		status: row.status as TranscriptionFile["status"],
		error: row.error ?? undefined,
		transcript: row.transcript ?? undefined,
		summary: row.summary ?? undefined,
	};
}

export function deleteJob(id: string): void {
	db.prepare("DELETE FROM jobs WHERE id = ?").run(id);
}

export function getAllJobs(): TranscriptionFile[] {
	const rows = db
		.prepare(
			`SELECT id, name, file_path, description, status, error, transcript, summary
			 FROM jobs ORDER BY created_at DESC`,
		)
		.all() as Array<{
		id: string;
		name: string;
		file_path: string | null;
		description: string;
		status: string;
		error: string | null;
		transcript: string | null;
		summary: string | null;
	}>;

	return rows.map((row) => ({
		id: row.id,
		name: row.name,
		path: row.file_path ?? undefined,
		description: row.description,
		status: row.status as TranscriptionFile["status"],
		error: row.error ?? undefined,
		transcript: row.transcript ?? undefined,
		summary: row.summary ?? undefined,
	}));
}

// --- Settings ---

export function getSetting(key: string): string | undefined {
	const row = db
		.prepare("SELECT value FROM settings WHERE key = ?")
		.get(key) as { value: string } | null;
	return row?.value;
}

export function setSetting(key: string, value: string): void {
	db.prepare(
		"INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
	).run(key, value, value);
}

export function loadSettings(): AppSettings {
	const model = getSetting("summarizationModel");
	const customTitleBar = getSetting("customTitleBar");
	const openaiApiKey = getSetting("openaiApiKey");
	const openrouterApiKey = getSetting("openrouterApiKey");
	return {
		summarizationModel: model ?? DEFAULT_SETTINGS.summarizationModel,
		customTitleBar: customTitleBar === "true",
		openaiApiKey: openaiApiKey ?? DEFAULT_SETTINGS.openaiApiKey,
		openrouterApiKey: openrouterApiKey ?? DEFAULT_SETTINGS.openrouterApiKey,
	};
}

export function saveSettings(s: Partial<AppSettings>): AppSettings {
	if (s.summarizationModel !== undefined) {
		setSetting("summarizationModel", s.summarizationModel);
	}
	if (s.customTitleBar !== undefined) {
		setSetting("customTitleBar", String(s.customTitleBar));
	}
	if (s.openaiApiKey !== undefined) {
		setSetting("openaiApiKey", s.openaiApiKey);
	}
	if (s.openrouterApiKey !== undefined) {
		setSetting("openrouterApiKey", s.openrouterApiKey);
	}
	return loadSettings();
}

export function getFilesDir(): string {
	const dir = join(Utils.paths.userData, "files");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}
