import { GoogleGenAI, type Schema } from "@google/genai";

// Used only if the admin's model list is empty.
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3-flash-preview", "gemini-flash-latest"];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTemporary(e: unknown) {
    const m = String(e);
    return (
        m.includes("503") ||
        m.includes("UNAVAILABLE") ||
        m.includes("high demand") ||
        m.includes("overloaded") ||
        m.includes("404") ||
        m.includes("NOT_FOUND")
    );
}

export type Attempt = {
    model: string;
    prompt: string;
    text: string | null;
    latencyMs: number;
    ok: boolean;
    error?: string;
};

export async function generateJsonText(
    prompt: string,
    opts: { schema?: Schema; models?: string[]; onAttempt?: (a: Attempt) => Promise<void> | void } = {}
) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const models = [...new Set(opts.models?.length ? opts.models : FALLBACK_MODELS)];
    let lastError: unknown;

    // Try every model once, right away. Only if all are busy, wait a second and try once more.
    for (let round = 0; round < 2; round++) {
        for (const model of models) {
            const started = Date.now();
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    config: { responseMimeType: "application/json", ...(opts.schema ? { responseSchema: opts.schema } : {}) },
                });
                const text = response.text ?? "";
                await opts.onAttempt?.({ model, prompt, text, latencyMs: Date.now() - started, ok: true });
                return { text, model };
            } catch (e) {
                lastError = e;
                await opts.onAttempt?.({
                    model,
                    prompt,
                    text: null,
                    latencyMs: Date.now() - started,
                    ok: false,
                    error: String(e).slice(0, 500),
                });
                console.error(`Gemini ${model} failed:`, String(e).slice(0, 200));
                if (!isTemporary(e)) throw e;
            }
        }
        if (round === 0) await sleep(1000);
    }
    throw lastError;
}
