import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

let cachedApiKey: string | undefined;
let openrouter: ReturnType<typeof createOpenRouter> | null = null;

function getOpenRouter(apiKey?: string) {
	const effectiveKey = apiKey || process.env.OPENROUTER_API_KEY;
	if (!openrouter || effectiveKey !== cachedApiKey) {
		cachedApiKey = effectiveKey;
		openrouter = createOpenRouter({ apiKey: effectiveKey });
	}
	return openrouter;
}

export async function summarize(
	transcript: string,
	modelId: string,
	description?: string,
	apiKey?: string,
): Promise<string> {
	const contextBlock = description
		? `\n\nThe user provided this context about the audio: "${description}"\nUse this to inform your summary.`
		: "";

	const { text } = await generateText({
		model: getOpenRouter(apiKey)(modelId),
		system: `You are a professional transcription summarizer. Given a raw transcript, produce a well-structured summary in Markdown format.

Include:
- A brief overview (2-3 sentences)
- Key points discussed (as bullet points)
- Any action items or decisions mentioned
- Notable quotes if relevant

Keep the summary concise but comprehensive. Use proper Markdown formatting with headers, lists, and emphasis where appropriate.${contextBlock}`,
		prompt: transcript,
	});

	return text;
}
