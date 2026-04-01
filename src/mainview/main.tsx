import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<ErrorBoundary
			fallback={
				<div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
					<div className="text-center space-y-3">
						<p className="text-red-400 font-medium">The application encountered an unexpected error.</p>
						<button
							type="button"
							onClick={() => window.location.reload()}
							className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-md transition-colors"
						>
							Reload
						</button>
					</div>
				</div>
			}
		>
			<App />
		</ErrorBoundary>
	</StrictMode>,
);
