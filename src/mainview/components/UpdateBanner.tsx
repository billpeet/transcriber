import { Download, RefreshCw, Loader2 } from "lucide-react";
import type { UpdateState } from "../../shared/types";

interface UpdateBannerProps {
	updateState: UpdateState;
	onRestart: () => void;
}

export function UpdateBanner({ updateState, onRestart }: UpdateBannerProps) {
	if (!updateState.available) return null;

	if (updateState.ready) {
		return (
			<div className="bg-emerald-600/20 border-b border-emerald-600/30 px-6 py-2 flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Download className="w-3.5 h-3.5 text-emerald-400" />
					<span className="text-xs text-emerald-300">
						A new version is ready to install
						{updateState.version ? ` (v${updateState.version})` : ""}
					</span>
				</div>
				<button
					type="button"
					onClick={onRestart}
					className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-md transition-colors"
				>
					<RefreshCw className="w-3 h-3" />
					Restart to Update
				</button>
			</div>
		);
	}

	if (updateState.downloading) {
		return (
			<div className="bg-blue-600/20 border-b border-blue-600/30 px-6 py-2 flex items-center gap-2">
				<Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
				<span className="text-xs text-blue-300">Downloading update...</span>
			</div>
		);
	}

	return null;
}
