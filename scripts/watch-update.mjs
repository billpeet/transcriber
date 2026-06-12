// Polls the running app's update state via CDP until the update is
// downloaded and ready (or timeout). Verifies the auto-update flow.
// Usage: node scripts/watch-update.mjs <port> [timeoutSec]
const port = process.argv[2] || "9225";
const timeoutSec = Number(process.argv[3] || 300);

async function getTarget() {
	const pages = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
	return pages.find((p) => p.type === "page");
}

function evaluate(ws, id, expression) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("CDP timeout")), 15000);
		const onMessage = (e) => {
			const msg = JSON.parse(e.data);
			if (msg.id === id) {
				clearTimeout(timer);
				ws.removeEventListener("message", onMessage);
				resolve(msg.result?.result?.value);
			}
		};
		ws.addEventListener("message", onMessage);
		ws.send(
			JSON.stringify({
				id,
				method: "Runtime.evaluate",
				params: { expression, awaitPromise: true, returnByValue: true },
			}),
		);
	});
}

const page = await getTarget();
if (!page) {
	console.error("No page target found");
	process.exit(1);
}
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
	ws.onopen = resolve;
	ws.onerror = () => reject(new Error("WebSocket connect failed"));
});

const version = await evaluate(ws, 1, "window.api.getAppVersion()");
console.log(`Running app version: ${version}`);

let lastJson = "";
const deadline = Date.now() + timeoutSec * 1000;
let id = 2;
while (Date.now() < deadline) {
	const state = await evaluate(
		ws,
		id++,
		"window.api.getUpdateState().then(s => JSON.stringify(s))",
	);
	if (state !== lastJson) {
		lastJson = state;
		console.log(`[${new Date().toISOString()}] ${state}`);
	}
	const parsed = JSON.parse(state);
	if (parsed.ready) {
		const banner = await evaluate(
			ws,
			id++,
			"JSON.stringify({ bannerText: document.body.innerText.match(/new version[^\\n]*/i)?.[0] ?? null, hasRestartButton: [...document.querySelectorAll('button')].some(b => /restart to update/i.test(b.textContent)) })",
		);
		console.log(`UI check: ${banner}`);
		console.log("UPDATE READY ✓");
		process.exit(0);
	}
	if (parsed.error) {
		console.error(`UPDATE ERROR: ${parsed.error}`);
		process.exit(1);
	}
	await new Promise((r) => setTimeout(r, 3000));
}
console.error("Timed out waiting for update to become ready");
process.exit(1);
