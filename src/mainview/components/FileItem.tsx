import { useState, useEffect, useRef } from "react";
import {
	FileAudio,
	Loader2,
	CheckCircle2,
	AlertCircle,
	ChevronDown,
	ChevronUp,
	Copy,
	Check,
	X,
	Play,
	Pause,
	RotateCcw,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { TranscriptionFile } from "../../shared/types";

interface FileItemProps {
	file: TranscriptionFile;
	onDescriptionChange: (id: string, description: string) => void;
	onProcess: (id: string) => void;
	onRetry: (id: string) => void;
	onRemove: (id: string) => void;
	onCopy: (text: string) => void;
	onGetAudioFile: (id: string) => Promise<{ data: string; mimeType: string } | { data: null }>;
}

function AudioPlayer({ fileId, fileStatus, onGetAudioFile }: { fileId: string; fileStatus: string; onGetAudioFile: FileItemProps["onGetAudioFile"] }) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [loading, setLoading] = useState(false);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		// Already loaded successfully, no need to re-fetch
		if (loaded) return;

		let cancelled = false;
		setLoading(true);
		onGetAudioFile(fileId).then((result) => {
			if (cancelled) return;
			if (!result.data) {
				// File not on disk yet — don't mark as permanently failed,
				// it will retry when fileStatus changes
				setLoading(false);
				return;
			}
			const binary = atob(result.data);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) {
				bytes[i] = binary.charCodeAt(i);
			}
			const blob = new Blob([bytes], { type: (result as { mimeType: string }).mimeType });
			setBlobUrl(URL.createObjectURL(blob));
			setLoaded(true);
			setLoading(false);
		}).catch(() => {
			if (!cancelled) {
				setLoading(false);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [fileId, fileStatus, onGetAudioFile, loaded]);

	useEffect(() => {
		return () => {
			if (blobUrl) URL.revokeObjectURL(blobUrl);
		};
	}, [blobUrl]);

	const togglePlay = () => {
		const audio = audioRef.current;
		if (!audio) return;
		if (playing) {
			audio.pause();
		} else {
			audio.play();
		}
	};

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const audio = audioRef.current;
		if (!audio) return;
		audio.currentTime = Number(e.target.value);
	};

	const formatTime = (s: number) => {
		if (!Number.isFinite(s)) return "0:00";
		const m = Math.floor(s / 60);
		const sec = Math.floor(s % 60);
		return `${m}:${sec.toString().padStart(2, "0")}`;
	};

	if (loading) {
		return (
			<div className="px-4 pb-3 flex items-center gap-2 text-xs text-zinc-500">
				<Loader2 className="w-3 h-3 animate-spin" />
				Loading audio...
			</div>
		);
	}
	if (!blobUrl) return null;

	return (
		<div className="px-4 pb-3">
			<div className="flex items-center gap-3 bg-zinc-800/50 rounded-md px-3 py-2">
				<audio
					ref={audioRef}
					src={blobUrl}
					onPlay={() => setPlaying(true)}
					onPause={() => setPlaying(false)}
					onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
					onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
					onEnded={() => setPlaying(false)}
				/>
				<button
					type="button"
					onClick={togglePlay}
					className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors"
				>
					{playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
				</button>
				<span className="text-xs text-zinc-400 tabular-nums w-10 flex-shrink-0">{formatTime(currentTime)}</span>
				<input
					type="range"
					min={0}
					max={duration || 0}
					step={0.1}
					value={currentTime}
					onChange={handleSeek}
					className="flex-1 h-1 accent-blue-500 bg-zinc-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:appearance-none"
				/>
				<span className="text-xs text-zinc-500 tabular-nums w-10 flex-shrink-0 text-right">{formatTime(duration)}</span>
			</div>
		</div>
	);
}

const STATUS_CONFIG: Record<
	string,
	{ label: string; color: string; icon: React.ReactNode }
> = {
	pending: {
		label: "Ready",
		color: "text-zinc-400",
		icon: <FileAudio className="w-4 h-4" />,
	},
	transcribing: {
		label: "Transcribing...",
		color: "text-amber-400",
		icon: <Loader2 className="w-4 h-4 animate-spin" />,
	},
	transcribed: {
		label: "Transcribed",
		color: "text-blue-400",
		icon: <Loader2 className="w-4 h-4 animate-spin" />,
	},
	summarizing: {
		label: "Summarizing...",
		color: "text-purple-400",
		icon: <Loader2 className="w-4 h-4 animate-spin" />,
	},
	done: {
		label: "Complete",
		color: "text-emerald-400",
		icon: <CheckCircle2 className="w-4 h-4" />,
	},
	error: {
		label: "Error",
		color: "text-red-400",
		icon: <AlertCircle className="w-4 h-4" />,
	},
};

export function FileItem({
	file,
	onDescriptionChange,
	onProcess,
	onRetry,
	onRemove,
	onCopy,
	onGetAudioFile,
}: FileItemProps) {
	const [expanded, setExpanded] = useState(false);
	const [copiedField, setCopiedField] = useState<string | null>(null);
	const status = STATUS_CONFIG[file.status];
	const isProcessing =
		file.status === "transcribing" ||
		file.status === "transcribed" ||
		file.status === "summarizing";

	const handleCopy = (text: string, field: string) => {
		onCopy(text);
		setCopiedField(field);
		setTimeout(() => setCopiedField(null), 2000);
	};

	return (
		<div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
			{/* Header */}
			<div className="flex items-center gap-3 px-4 py-3">
				<div className={`flex-shrink-0 ${status.color}`}>{status.icon}</div>

				<div className="flex-1 min-w-0">
					<p className="text-sm text-zinc-200 truncate">{file.name}</p>
					<p className={`text-xs ${status.color}`}>{status.label}</p>
				</div>

				{file.status === "pending" && (
					<>
						<button
							type="button"
							onClick={() => onProcess(file.id)}
							disabled={!file.path && !file.fileData}
							className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs rounded-md transition-colors"
						>
							Transcribe
						</button>
						<button
							type="button"
							onClick={() => onRemove(file.id)}
							className="p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
						>
							<X className="w-4 h-4" />
						</button>
					</>
				)}

				{(file.status === "done" || file.transcript) && (
					<div className="flex items-center gap-1">
						{file.transcript && (
							<button
								type="button"
								onClick={() => handleCopy(file.transcript!, "transcript")}
								title="Copy transcript"
								className="inline-flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors rounded hover:bg-zinc-800"
							>
								{copiedField === "transcript" ? (
									<Check className="w-3 h-3" />
								) : (
									<Copy className="w-3 h-3" />
								)}
								Transcript
							</button>
						)}
						{file.summary && (
							<button
								type="button"
								onClick={() => handleCopy(file.summary!, "summary")}
								title="Copy summary"
								className="inline-flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors rounded hover:bg-zinc-800"
							>
								{copiedField === "summary" ? (
									<Check className="w-3 h-3" />
								) : (
									<Copy className="w-3 h-3" />
								)}
								Summary
							</button>
						)}
						<button
							type="button"
							onClick={() => setExpanded(!expanded)}
							className="p-1.5 text-zinc-400 hover:text-zinc-200 transition-colors"
						>
							{expanded ? (
								<ChevronUp className="w-4 h-4" />
							) : (
								<ChevronDown className="w-4 h-4" />
							)}
						</button>
					</div>
				)}
			</div>

			{/* Description input - only when pending */}
			{file.status === "pending" && (
				<div className="px-4 pb-3">
					<input
						type="text"
						placeholder="Optional: describe this audio to help the AI summarize (e.g. 'team standup meeting')"
						value={file.description}
						onChange={(e) => onDescriptionChange(file.id, e.target.value)}
						className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
					/>
				</div>
			)}

			{/* Audio Player */}
			{file.status !== "pending" && (
				<AudioPlayer fileId={file.id} fileStatus={file.status} onGetAudioFile={onGetAudioFile} />
			)}

			{/* Error message */}
			{file.status === "error" && (
				<div className="px-4 pb-3">
					{file.error && (
						<p className="text-xs text-red-400 bg-red-900/20 rounded-md px-3 py-2 mb-2">
							{file.error}
						</p>
					)}
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => onRetry(file.id)}
							className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md transition-colors"
						>
							<RotateCcw className="w-3 h-3" />
							Retry
						</button>
						<button
							type="button"
							onClick={() => onRemove(file.id)}
							className="inline-flex items-center gap-1.5 px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
						>
							<X className="w-3.5 h-3.5" />
							Remove
						</button>
					</div>
				</div>
			)}

			{/* Expanded content */}
			{expanded && (
				<div className="border-t border-zinc-800">
					{/* Transcript */}
					{file.transcript && (
						<div className="px-4 py-3">
							<h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
								Transcript
							</h4>
							<div className="bg-zinc-800/50 rounded-md p-3 max-h-48 overflow-y-auto">
								<p className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
									{file.transcript}
								</p>
							</div>
						</div>
					)}

					{/* Summary */}
					{file.summary && (
						<div className="px-4 py-3 border-t border-zinc-800">
							<h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-2">
								Summary
							</h4>
							<div className="bg-zinc-800/50 rounded-md p-3 max-h-96 overflow-y-auto prose prose-invert prose-sm max-w-none">
								<ReactMarkdown>{file.summary}</ReactMarkdown>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
