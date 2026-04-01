import { Minus, Square, X } from "lucide-react";
import appIcon from "../icon.svg";

interface TitleBarProps {
	onMinimize: () => void;
	onMaximize: () => void;
	onClose: () => void;
}

export function TitleBar({ onMinimize, onMaximize, onClose }: TitleBarProps) {
	return (
		<div
			className="electrobun-webkit-app-region-drag fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-zinc-900 border-b border-zinc-800 select-none rounded-t-lg"
			style={{ height: 36 }}
		>
			<div className="flex items-center gap-2 pl-3">
				<img src={appIcon} alt="" className="w-5 h-5 rounded" />
				<span className="text-xs font-medium text-zinc-400">
					Transcriber
				</span>
			</div>

			<div className="electrobun-webkit-app-region-no-drag flex h-full">
				<button
					type="button"
					onClick={onMinimize}
					className="h-full px-4 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors flex items-center"
				>
					<Minus className="w-3.5 h-3.5" />
				</button>
				<button
					type="button"
					onClick={onMaximize}
					className="h-full px-4 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 transition-colors flex items-center"
				>
					<Square className="w-3 h-3" />
				</button>
				<button
					type="button"
					onClick={onClose}
					className="h-full px-4 text-zinc-500 hover:bg-red-600 hover:text-white transition-colors flex items-center"
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>
		</div>
	);
}
