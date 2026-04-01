import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FolderOpen } from "lucide-react";

const ACCEPTED_TYPES: Record<string, string[]> = {
	"audio/mpeg": [".mp3"],
	"audio/mp4": [".m4a", ".mp4"],
	"audio/wav": [".wav"],
	"audio/webm": [".webm"],
	"audio/ogg": [".ogg"],
	"audio/flac": [".flac"],
};

interface FileUploadProps {
	onFilesSelected: (files: File[]) => void;
	onBrowse: () => void;
}

export function FileUpload({ onFilesSelected, onBrowse }: FileUploadProps) {
	const onDrop = useCallback(
		(acceptedFiles: File[]) => {
			if (acceptedFiles.length > 0) {
				onFilesSelected(acceptedFiles);
			}
		},
		[onFilesSelected],
	);

	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		onDrop,
		accept: ACCEPTED_TYPES,
		noClick: true,
	});

	return (
		<div
			{...getRootProps()}
			className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
				isDragActive
					? "border-blue-400 bg-blue-500/10"
					: "border-zinc-700 hover:border-zinc-500 bg-zinc-900/50"
			}`}
		>
			<input {...getInputProps()} />
			<Upload
				className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? "text-blue-400" : "text-zinc-500"}`}
			/>
			<p className="text-zinc-300 text-sm mb-1">
				{isDragActive
					? "Drop audio files here..."
					: "Drag & drop audio files here"}
			</p>
			<p className="text-zinc-500 text-xs mb-4">
				MP3, M4A, WAV, WebM, OGG, FLAC
			</p>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onBrowse();
				}}
				className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm rounded-lg transition-colors border border-zinc-700"
			>
				<FolderOpen className="w-4 h-4" />
				Browse Files
			</button>
		</div>
	);
}
