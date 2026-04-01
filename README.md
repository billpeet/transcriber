# Transcriber

A desktop app for transcribing and summarizing audio files. Drop in audio files, get back structured transcripts and AI-generated summaries.

Built with [Electrobun](https://electrobun.dev), React, and Tailwind CSS.

## Features

- **Audio transcription** via OpenAI Whisper — supports MP3, M4A, WAV, WebM, OGG, FLAC
- **AI summarization** via OpenRouter — produces structured Markdown summaries with key points, action items, and notable quotes
- **Large file handling** — automatically chunks files over 24MB and stitches transcripts together
- **Batch processing** — queue multiple files and transcribe them all at once
- **Persistent storage** — jobs and settings are saved to a local SQLite database
- **Auto-updates** — checks for new versions periodically and offers a one-click restart to update

## Setup

### Prerequisites

- [Bun](https://bun.sh) runtime
- [ffmpeg](https://ffmpeg.org) on your PATH (used for audio normalization and chunking)

### Install

```bash
bun install
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

Keys set in the UI take priority over environment variables.

## Development

```bash
# Development with hot module replacement (recommended)
bun run dev:hmr

# Development without HMR (uses bundled assets)
bun run dev
```

With HMR, the Vite dev server runs on `http://localhost:5173` and the app loads from it directly — React component changes update instantly without a full reload.

## Building

```bash
# Build for canary release
bun run build:canary
```

Build artifacts are output to `artifacts/`.

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
| Custom Title Bar | Use a custom frameless title bar instead of the OS native one |

### Updates

The app checks for updates automatically every 30 minutes. When a new version is available and downloaded, a green banner appears at the top of the window with a **Restart to Update** button.

## Project Structure

```
src/
  bun/                  # Main process (runs in Bun)
    index.ts            # App entry point, RPC handlers, update logic
    services/
      transcription.ts  # OpenAI Whisper integration with chunking
      summarization.ts  # OpenRouter AI summarization
      database.ts       # SQLite persistence for jobs and settings
  mainview/             # Frontend (React, loaded in webview)
    App.tsx             # Root component and state management
    components/
      FileUpload.tsx    # Drag-and-drop file input
      FileItem.tsx      # File card with audio player and results
      Settings.tsx      # Settings modal (API keys, model, appearance)
      UpdateBanner.tsx  # Auto-update notification banner
      TitleBar.tsx      # Optional custom window title bar
      ErrorBoundary.tsx # Error handling wrapper
  shared/
    types.ts            # TypeScript types shared between main and view
```

## CI/CD

Pushes to `main` trigger a GitHub Actions workflow that builds the app and publishes artifacts to GitHub Releases. The auto-updater checks these releases for new versions.
