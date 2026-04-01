import { useState, useEffect } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import type { AppSettings } from "../../shared/types";

interface SettingsProps {
	settings: AppSettings;
	onSave: (settings: Partial<AppSettings>) => void;
	onClose: () => void;
}

function ApiKeyInput({
	id,
	label,
	hint,
	value,
	onChange,
}: {
	id: string;
	label: string;
	hint: string;
	value: string;
	onChange: (v: string) => void;
}) {
	const [visible, setVisible] = useState(false);
	return (
		<div>
			<label
				htmlFor={id}
				className="block text-xs font-medium text-zinc-400 mb-1.5"
			>
				{label}
			</label>
			<div className="relative">
				<input
					id={id}
					type={visible ? "text" : "password"}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="sk-..."
					className="w-full px-3 py-2 pr-9 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-mono"
				/>
				<button
					type="button"
					onClick={() => setVisible(!visible)}
					className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
				>
					{visible ? (
						<EyeOff className="w-3.5 h-3.5" />
					) : (
						<Eye className="w-3.5 h-3.5" />
					)}
				</button>
			</div>
			<p className="mt-1.5 text-xs text-zinc-600">{hint}</p>
		</div>
	);
}

export function Settings({ settings, onSave, onClose }: SettingsProps) {
	const [model, setModel] = useState(settings.summarizationModel);
	const [customTitleBar, setCustomTitleBar] = useState(settings.customTitleBar);
	const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey);
	const [openrouterApiKey, setOpenrouterApiKey] = useState(settings.openrouterApiKey);

	useEffect(() => {
		setModel(settings.summarizationModel);
		setCustomTitleBar(settings.customTitleBar);
		setOpenaiApiKey(settings.openaiApiKey);
		setOpenrouterApiKey(settings.openrouterApiKey);
	}, [settings]);

	const handleSave = () => {
		onSave({
			summarizationModel: model,
			customTitleBar,
			openaiApiKey,
			openrouterApiKey,
		});
		onClose();
	};

	return (
		<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-24">
			<div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md shadow-2xl">
				<div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
					<h2 className="text-sm font-semibold text-zinc-100">Settings</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-zinc-500 hover:text-zinc-300 transition-colors"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				<div className="px-5 py-4 space-y-5">
					{/* API Keys Section */}
					<div>
						<h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
							API Keys
						</h3>
						<div className="space-y-3">
							<ApiKeyInput
								id="openaiApiKey"
								label="OpenAI API Key"
								hint="Used for Whisper transcription"
								value={openaiApiKey}
								onChange={setOpenaiApiKey}
							/>
							<ApiKeyInput
								id="openrouterApiKey"
								label="OpenRouter API Key"
								hint="Used for AI summarization"
								value={openrouterApiKey}
								onChange={setOpenrouterApiKey}
							/>
						</div>
					</div>

					{/* Model Section */}
					<div>
						<h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
							Model
						</h3>
						<div>
							<label
								htmlFor="model"
								className="block text-xs font-medium text-zinc-400 mb-1.5"
							>
								Summarization Model
							</label>
							<input
								id="model"
								type="text"
								value={model}
								onChange={(e) => setModel(e.target.value)}
								placeholder="google/gemini-2.5-flash"
								className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
							/>
							<p className="mt-1.5 text-xs text-zinc-600">
								OpenRouter model ID (e.g. google/gemini-2.5-flash,
								anthropic/claude-sonnet-4)
							</p>
						</div>
					</div>

					{/* Appearance Section */}
					<div>
						<h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-3">
							Appearance
						</h3>
						<div className="flex items-center justify-between">
							<div>
								<label
									htmlFor="customTitleBar"
									className="block text-xs font-medium text-zinc-400"
								>
									Custom Title Bar
								</label>
								<p className="mt-0.5 text-xs text-zinc-600">
									Requires restart to take effect
								</p>
							</div>
							<button
								id="customTitleBar"
								type="button"
								role="switch"
								aria-checked={customTitleBar}
								onClick={() => setCustomTitleBar(!customTitleBar)}
								className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
									customTitleBar ? "bg-blue-600" : "bg-zinc-700"
								}`}
							>
								<span
									className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
										customTitleBar ? "translate-x-4" : "translate-x-0.5"
									}`}
								/>
							</button>
						</div>
					</div>
				</div>

				<div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800">
					<button
						type="button"
						onClick={onClose}
						className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-md transition-colors"
					>
						Save
					</button>
				</div>
			</div>
		</div>
	);
}
