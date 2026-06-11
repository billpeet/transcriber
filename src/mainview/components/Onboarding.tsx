import { useState } from "react";
import { Check, ExternalLink, Mic } from "lucide-react";
import type { ApiKeyStatus, AppSettings } from "../../shared/types";
import { ApiKeyInput } from "./ApiKeyInput";

interface OnboardingProps {
	/** Which keys are already effectively configured (e.g. via .env in dev) */
	keyStatus: ApiKeyStatus;
	onComplete: (settings: Partial<AppSettings>) => void;
	onSkip: () => void;
	onOpenExternal: (url: string) => void;
}

function StepBadge({ step, done }: { step: number; done: boolean }) {
	return (
		<div
			className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
				done
					? "bg-emerald-600/20 text-emerald-400"
					: "bg-blue-600/20 text-blue-400"
			}`}
		>
			{done ? <Check className="w-3.5 h-3.5" /> : step}
		</div>
	);
}

function KeyLink({
	label,
	url,
	onOpenExternal,
}: {
	label: string;
	url: string;
	onOpenExternal: (url: string) => void;
}) {
	return (
		<button
			type="button"
			onClick={() => onOpenExternal(url)}
			className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
		>
			{label}
			<ExternalLink className="w-3 h-3" />
		</button>
	);
}

export function Onboarding({
	keyStatus,
	onComplete,
	onSkip,
	onOpenExternal,
}: OnboardingProps) {
	const [openaiApiKey, setOpenaiApiKey] = useState("");
	const [openrouterApiKey, setOpenrouterApiKey] = useState("");

	const openaiReady = keyStatus.openai || openaiApiKey.trim().length > 0;
	const openrouterReady =
		keyStatus.openrouter || openrouterApiKey.trim().length > 0;
	const canComplete = openaiReady && openrouterReady;

	const handleComplete = () => {
		if (!canComplete) return;
		const partial: Partial<AppSettings> = {};
		if (openaiApiKey.trim()) partial.openaiApiKey = openaiApiKey.trim();
		if (openrouterApiKey.trim())
			partial.openrouterApiKey = openrouterApiKey.trim();
		onComplete(partial);
	};

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 overflow-y-auto">
			<div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl mb-16">
				{/* Header */}
				<div className="px-6 pt-8 pb-6 text-center border-b border-zinc-800">
					<div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
						<Mic className="w-6 h-6 text-white" />
					</div>
					<h2 className="text-lg font-semibold text-zinc-100">
						Welcome to Transcriber
					</h2>
					<p className="mt-1.5 text-sm text-zinc-500">
						Transcriber uses external AI services to transcribe and summarize
						your audio. Two API keys are needed before you can process files.
					</p>
				</div>

				<div className="px-6 py-5 space-y-6">
					{/* Step 1: OpenAI */}
					<div className="flex gap-3">
						<StepBadge step={1} done={openaiReady} />
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between mb-1">
								<h3 className="text-sm font-medium text-zinc-200">
									OpenAI API key
								</h3>
								<KeyLink
									label="Get a key"
									url="https://platform.openai.com/api-keys"
									onOpenExternal={onOpenExternal}
								/>
							</div>
							<p className="text-xs text-zinc-600 mb-2.5">
								Used for Whisper audio transcription.
							</p>
							{keyStatus.openai ? (
								<p className="text-xs text-emerald-400 flex items-center gap-1.5">
									<Check className="w-3.5 h-3.5" />
									Already configured via environment
								</p>
							) : (
								<ApiKeyInput
									id="onboarding-openai"
									value={openaiApiKey}
									onChange={setOpenaiApiKey}
									autoFocus
								/>
							)}
						</div>
					</div>

					{/* Step 2: OpenRouter */}
					<div className="flex gap-3">
						<StepBadge step={2} done={openrouterReady} />
						<div className="flex-1 min-w-0">
							<div className="flex items-center justify-between mb-1">
								<h3 className="text-sm font-medium text-zinc-200">
									OpenRouter API key
								</h3>
								<KeyLink
									label="Get a key"
									url="https://openrouter.ai/settings/keys"
									onOpenExternal={onOpenExternal}
								/>
							</div>
							<p className="text-xs text-zinc-600 mb-2.5">
								Used for AI summarization of your transcripts.
							</p>
							{keyStatus.openrouter ? (
								<p className="text-xs text-emerald-400 flex items-center gap-1.5">
									<Check className="w-3.5 h-3.5" />
									Already configured via environment
								</p>
							) : (
								<ApiKeyInput
									id="onboarding-openrouter"
									value={openrouterApiKey}
									onChange={setOpenrouterApiKey}
								/>
							)}
						</div>
					</div>

					<p className="text-xs text-zinc-600">
						Keys are stored locally on this device and never shared. You can
						change them anytime in Settings.
					</p>
				</div>

				{/* Footer */}
				<div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800">
					<button
						type="button"
						onClick={onSkip}
						className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
					>
						Skip for now
					</button>
					<button
						type="button"
						onClick={handleComplete}
						disabled={!canComplete}
						className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white text-xs font-medium rounded-md transition-colors"
					>
						Get Started
					</button>
				</div>
			</div>
		</div>
	);
}
