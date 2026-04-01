import { Component, type ReactNode, type ErrorInfo } from "react";

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
}

interface ErrorBoundaryState {
	error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	state: ErrorBoundaryState = { error: null };

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error("ErrorBoundary caught:", error, info.componentStack);
	}

	reset = () => {
		this.setState({ error: null });
	};

	render() {
		const { error } = this.state;
		if (!error) return this.props.children;

		if (typeof this.props.fallback === "function") {
			return this.props.fallback(error, this.reset);
		}

		if (this.props.fallback) {
			return this.props.fallback;
		}

		return (
			<div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
				<p className="text-sm font-medium text-red-400">Something went wrong</p>
				<p className="mt-1 text-xs text-red-400/70">{error.message}</p>
				<button
					type="button"
					onClick={this.reset}
					className="mt-2 text-xs text-red-400 underline hover:text-red-300"
				>
					Try again
				</button>
			</div>
		);
	}
}
