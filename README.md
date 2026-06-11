# Transcriber

A desktop app for transcribing and summarizing audio files. Drop in audio files, get back structured transcripts and AI-generated summaries.

Built with [Electron](https://www.electronjs.org), React, and Tailwind CSS.

## Features

- **Audio transcription** via OpenAI Whisper — supports MP3, M4A, WAV, WebM, OGG, FLAC
- **AI summarization** via OpenRouter — produces structured Markdown summaries with key points, action items, and notable quotes
- **Large file handling** — automatically chunks files over 24MB and stitches transcripts together
- **Batch processing** — queue multiple files and transcribe them all at once
- **Persistent storage** — jobs and settings are saved to a local SQLite database
- **Custom title bar** — frameless window with custom titlebar (toggleable in Settings)
- **Auto-updates** — checks GitHub Releases periodically, downloads updates in the background (with progress), and offers a one-click restart to install

## Setup

### Prerequisites

- [Node.js](https://nodejs.org) 22+

ffmpeg/ffprobe are bundled via `ffmpeg-static`/`ffprobe-static` — no system install required (a system `ffmpeg` on PATH is used as a fallback).

### Install

```bash
npm install
```

### API Keys

You can configure API keys in two ways:

**Option A: Through the app UI (recommended)**

Launch the app and open Settings (gear icon). Enter your keys in the API Keys section:

- **OpenAI API Key** — for Whisper transcription ([platform.openai.com](https://platform.openai.com/api-keys))
- **OpenRouter API Key** — for AI summarization ([openrouter.ai](https://openrouter.ai/keys))

Keys are stored locally in the app's SQLite database.

**Option B: Environment variables**

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-v1-...
```

Keys set in the UI take priority over environment variables. The `.env` file is only loaded in development.

## Development

```bash
npm run dev
```

This starts the Vite dev server (HMR) and launches Electron against it — React component changes update instantly without a full reload.

Other useful scripts:

```bash
npm run typecheck   # TypeScript type-checking
npm run build       # Build renderer (Vite) + main process (esbuild)
```

## Building

```bash
# Unpacked build for local inspection (release/win-unpacked/)
npm run pack

# Full Windows NSIS installer
npm run dist

# Build and publish a release to GitHub (requires GH_TOKEN)
npm run release
```

Build artifacts are output to `release/`.

## Usage

1. **Add files** — drag and drop audio files onto the app, or click Browse to select them
2. **Add context** (optional) — type a description for each file to help the summarizer understand the content
3. **Transcribe** — click the transcribe button on individual files, or use "Transcribe All" in the header for batch processing
4. **Review results** — expand each file card to see the full transcript and summary. Use the copy buttons to grab either one

### Settings

Open Settings via the gear icon in the header:

| Setting | Description |
|---------|-------------|
| OpenAI API Key | Your OpenAI key for Whisper transcription |
| OpenRouter API Key | Your OpenRouter key for AI summarization |
| Summarization Model | OpenRouter model ID (default: `google/gemini-2.5-flash`) |
| Custom Title Bar | Use a custom frameless title bar instead of the OS native one (default: on, requires restart) |

### Updates

The app checks GitHub Releases for updates 10 seconds after launch and every 30 minutes thereafter (packaged builds only). Updates download automatically in the background — a banner shows download progress, then offers a **Restart to Update** button when ready. Pending updates are also installed automatically when the app quits.

Auto-update is powered by [electron-updater](https://www.electron.build/auto-update), using the `latest.yml` manifest and blockmap (differential download) that `electron-builder` publishes alongside each release.

## Project Structure

```
src/
  main/                 # Electron main process
    index.ts            # App entry point, window creation, IPC handlers
    preload.ts          # Context bridge exposing the typed window.api
    updater.ts          # Auto-update via electron-updater (GitHub Releases)
    services/
      transcription.ts  # OpenAI Whisper integration with chunking
      summarization.ts  # OpenRouter AI summarization
      database.ts       # SQLite persistence (node:sqlite) for jobs and settings
  mainview/             # Frontend (React, loaded in the renderer)
    App.tsx             # Root component and state management
    components/
      FileUpload.tsx    # Drag-and-drop file input
      FileItem.tsx      # File card with audio player and results
      Settings.tsx      # Settings modal (API keys, model, appearance)
      UpdateBanner.tsx  # Auto-update notification banner
      TitleBar.tsx      # Custom window title bar
      ErrorBoundary.tsx # Error handling wrapper
  shared/
    types.ts            # Types shared between main, preload, and renderer
scripts/
  build-main.mjs        # esbuild bundling for main process + preload
electron-builder.yml    # Packaging & publishing configuration
```

## CI/CD

Pushes to `main` trigger a GitHub Actions workflow that builds the Windows installer with `electron-builder` and publishes it to GitHub Releases as `v<major>.<minor>.<run-number>`. Each release includes `latest.yml`, which the auto-updater uses to detect and download new versions.
