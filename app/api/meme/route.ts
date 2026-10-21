import { NextResponse } from "next/server";
import { Type } from "@google/genai";
import { generateJsonText } from "@/lib/gemini";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 45;

const DEV = process.env.NODE_ENV !== "production";

type Template = { id: string; name: string; box_count: number };
type Idea = { templateId: string; boxes: string[] };
type Meme = { url: string; templateId: string };

let cache: { at: number; templates: Template[] } | null = null;

async function getTemplates() {
    if (cache && Date.now() - cache.at < 60 * 60 * 1000) return cache.templates;
    const res = await fetch("https://api.imgflip.com/get_memes");
    const body = await res.json();
    if (!body.success) throw new Error("Imgflip templates unavailable");
    const templates = (body.data.memes as Template[])
        .filter((t) => t.box_count >= 2 && t.box_count <= 4)
        .slice(0, 40)
        .map(({ id, name, box_count }) => ({ id: String(id), name, box_count }));
    cache = { at: Date.now(), templates };
    return templates;
}

class ImgflipError extends Error {}

async function renderMeme(templateId: string, boxes: string[]) {
    const form = new URLSearchParams({
        template_id: templateId,
        username: process.env.IMGFLIP_USERNAME ?? "",
        password: process.env.IMGFLIP_PASSWORD ?? "",
    });
    boxes.forEach((text, i) => form.append(`boxes[${i}][text]`, text));
    const res = await fetch("https://api.imgflip.com/caption_image", { method: "POST", body: form });
    const body = await res.json();
    if (!body.success) throw new ImgflipError(String(body.error_message ?? "Unknown Imgflip error"));
    return body.data.url as string;
}

// Accepts whatever shape the AI sends back and turns it into a clean list of ideas.
function readIdeas(text: string, byId: Map<string, Template>): Idea[] {
    const cleaned = text.replace(/```(json)?/g, "").trim();
    const parsed: unknown = JSON.parse(cleaned);
    const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object"
            ? (Object.values(parsed).find(Array.isArray) as unknown[] | undefined) ?? []
            : [];

    return list
        .map((raw) => {
            const item = raw as { templateId?: unknown; template_id?: unknown; id?: unknown; boxes?: unknown };
            const templateId = String(item.templateId ?? item.template_id ?? item.id ?? "").trim();
            const boxes = Array.isArray(item.boxes)
                ? item.boxes.map((b) => String(b ?? "").trim()).filter(Boolean)
                : [];
            return { templateId, boxes };
        })
        .filter((idea) => byId.has(idea.templateId) && idea.boxes.length > 0);
}

async function askForIdeas(prompt: string) {
    return generateJsonText(prompt, {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                templateId: { type: Type.STRING },
                boxes: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["templateId", "boxes"],
        },
    });
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Sign in to make memes." }, { status: 401 });
    }

    const { songTitle, songArtist, moment } = await request.json();
    if (typeof songTitle !== "string" || typeof songArtist !== "string") {
        return NextResponse.json({ error: "Pick a song first." }, { status: 400 });
    }
    const cleanMoment = typeof moment === "string" ? moment.trim().slice(0, 150) : "";
    if (!cleanMoment) {
        return NextResponse.json({ error: "Tell us what's happening first." }, { status: 400 });
    }

    let lastError: unknown = null;

    try {
        const templates = await getTemplates();
        const byId = new Map(templates.map((t) => [t.id, t]));
        const list = templates.map((t) => `${t.id} | ${t.name} | ${t.box_count} boxes`).join("\n");

        const aiPrompt = [
            "You make memes for a daily music check-in app for Columbia University students in New York City.",
            `The student is listening to "${songTitle.slice(0, 200)}" by ${songArtist.slice(0, 200)}.`,
            `What they're doing right now: "${cleanMoment}".`,
            "Make THREE different funny memes about this moment, each using a DIFFERENT template from this list (id | name | number of text boxes):",
            list,
            "For each meme, copy the template id exactly as written, and write exactly as many text boxes as the template has, in the order that template is normally captioned. Keep each box short (under 12 words). Be playful and clever, never mean.",
        ].join("\n");

        // Try twice before giving up.
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const text = await askForIdeas(aiPrompt);
                const ideas = readIdeas(text, byId).slice(0, 3);
                if (!ideas.length) throw new Error(`AI reply had no usable memes: ${text.slice(0, 300)}`);

                const results = await Promise.allSettled(
                    ideas.map(async (idea): Promise<Meme> => {
                        const boxes = idea.boxes.slice(0, byId.get(idea.templateId)!.box_count);
                        return { url: await renderMeme(idea.templateId, boxes), templateId: idea.templateId };
                    })
                );
                const memes = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
                const imgflipFailure = results.find(
                    (r): r is PromiseRejectedResult => r.status === "rejected" && r.reason instanceof ImgflipError
                );

                if (memes.length) return NextResponse.json({ memes, aiPrompt });
                if (imgflipFailure) throw imgflipFailure.reason;
                throw new Error("Every meme failed to render");
            } catch (e) {
                lastError = e;
                console.error(`Meme error (attempt ${attempt}):`, e);
                if (e instanceof ImgflipError) break;
                const message = String(e);
                if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) break;
            }
        }
    } catch (e) {
        lastError = e;
        console.error("Meme error:", e);
    }

    const message = String(lastError);
    const detail = DEV ? { detail: message.slice(0, 500) } : {};

    if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
        return NextResponse.json(
            { error: "Lots of people are making memes right now. Wait a minute and try again.", ...detail },
            { status: 429 }
        );
    }
    if (message.includes("503") || message.includes("UNAVAILABLE") || message.includes("high demand")) {
        return NextResponse.json(
            { error: "Google's AI is overloaded right now. Wait a few seconds and try again.", ...detail },
            { status: 503 }
        );
    }
    if (lastError instanceof ImgflipError) {
        return NextResponse.json(
            { error: "The meme maker is having trouble right now. Try again in a bit.", ...detail },
            { status: 502 }
        );
    }
    return NextResponse.json({ error: "The AI got stumped. Try again.", ...detail }, { status: 500 });
}
