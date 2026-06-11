// Quick smoke check: attach to a running instance via CDP and verify the
// renderer mounted React and the preload bridge is exposed.
// Usage: node scripts/smoke-cdp.mjs <port>
const port = process.argv[2] || "9223";

const pages = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
const page = pages.find((p) => p.type === "page");
if (!page) {
	console.error("No page target found");
	process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
const result = await new Promise((resolve, reject) => {
	const timer = setTimeout(() => reject(new Error("CDP timeout")), 10000);
	ws.onopen = () => {
		ws.send(
			JSON.stringify({
				id: 1,
				method: "Runtime.evaluate",
				params: {
					expression: `JSON.stringify({
						rootChildren: document.getElementById("root")?.children.length ?? -1,
						hasApi: typeof window.api === "object" && window.api !== null,
						apiKeys: window.api ? Object.keys(window.api).length : 0,
						titleBarPresent: !!document.querySelector("img[alt='']"),
						bodyText: document.body.innerText.slice(0, 120),
					})`,
					returnByValue: true,
				},
			}),
		);
	};
	ws.onmessage = (e) => {
		const msg = JSON.parse(e.data);
		if (msg.id === 1) {
			clearTimeout(timer);
			resolve(msg.result);
		}
	};
	ws.onerror = (e) => {
		clearTimeout(timer);
		reject(new Error("WebSocket error"));
	};
});

console.log(JSON.parse(result.result.value));
ws.close();
