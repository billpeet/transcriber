import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export function ApiKeyInput({
	id,
	label,
	hint,
	value,
	onChange,
	autoFocus,
}: {
	id: string;
	label?: string;
	hint?: string;
	value: string;
	onChange: (v: string) => void;
	autoFocus?: boolean;
}) {
	const [visible, setVisible] = useState(false);
	return (
		<div>
			{label && (
				<label
					htmlFor={id}
					className="block text-xs font-medium text-zinc-400 mb-1.5"
				>
					{label}
				</label>
			)}
			<div className="relative">
				<input
					id={id}
					type={visible ? "text" : "password"}
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder="sk-..."
					autoFocus={autoFocus}
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
			{hint && <p className="mt-1.5 text-xs text-zinc-600">{hint}</p>}
		</div>
	);
}
