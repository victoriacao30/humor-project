import { GoogleGenAI, type Schema } from "@google/genai";

// Tried in order. If one is overloaded, the next one takes over.
const MODELS = [
    process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-flash-latest",
];

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

export async function generateJsonText(prompt: string, responseSchema?: Schema) {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const models = [...new Set(MODELS)];
    let lastError: unknown;

    // Try every model once, right away. Only if all are busy, wait a second and try once more.
    for (let round = 0; round < 2; round++) {
        for (const model of models) {
            try {
                const response = await ai.models.generateContent({
                    model,
                    contents: [{ role: "user", parts: [{ text: prompt }] }],
                    config: { responseMimeType: "application/json", ...(responseSchema ? { responseSchema } : {}) },
                });
                return response.text ?? "";
            } catch (e) {
                lastError = e;
                console.error(`Gemini ${model} failed:`, String(e).slice(0, 200));
                if (!isTemporary(e)) throw e;
            }
        }
        if (round === 0) await sleep(1000);
    }
    throw lastError;
}