import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase-server";

export const maxDuration = 30;

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

type Template = { id: string; name: string; box_count: number };
type Idea = { templateId: string; boxes: string[] };

let cache: { at: number; templates: Template[] } | null = null;

async function getTemplates() {
    if (cache && Date.now() - cache.at < 60 * 60 * 1000) return cache.templates;
    const res = await fetch("https://api.imgflip.com/get_memes");
    const body = await res.json();
    if (!body.success) throw new Error("Imgflip templates unavailable");
    const templates = (body.data.memes as Template[])
        .filter((t) => t.box_count >= 2 && t.box_count <= 4)
        .slice(0, 80)
        .map(({ id, name, box_count }) => ({ id, name, box_count }));
    cache = { at: Date.now(), templates };
    return templates;
}

async function renderMeme(templateId: string, boxes: string[]) {
    const form = new URLSearchParams({
        template_id: templateId,
        username: process.env.IMGFLIP_USERNAME ?? "",
        password: process.env.IMGFLIP_PASSWORD ?? "",
    });
    boxes.forEach((text, i) => form.append(`boxes[${i}][text]`, text));
    const res = await fetch("https://api.imgflip.com/caption_image", { method: "POST", body: form });
    const body = await res.json();
    if (!body.success) throw new Error(`Imgflip: ${body.error_message}`);
    return body.data.url as string;
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
            "For each meme, write exactly as many text boxes as the template has, in the order that template is normally captioned. Keep each box short (under 12 words). Be playful and clever, never mean.",
            'Reply with only JSON in this shape: [{"templateId": "...", "boxes": ["...", "..."]}]',
        ].join("\n");

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: [{ role: "user", parts: [{ text: aiPrompt }] }],
            config: { responseMimeType: "application/json" },
        });

        const text = (response.text ?? "").replace(/```(json)?/g, "").trim();
        const parsed: unknown = JSON.parse(text);
        const ideas = (Array.isArray(parsed) ? parsed : [])
            .filter(
                (i): i is Idea =>
                    !!i &&
                    typeof i.templateId === "string" &&
                    byId.has(i.templateId) &&
                    Array.isArray(i.boxes) &&
                    i.boxes.every((b: unknown) => typeof b === "string")
            )
            .slice(0, 3);

        const memes = (
            await Promise.all(
                ideas.map(async (idea) => {
                    try {
                        const boxes = idea.boxes.slice(0, byId.get(idea.templateId)!.box_count);
                        return { url: await renderMeme(idea.templateId, boxes), templateId: idea.templateId };
                    } catch (e) {
                        console.error(e);
                        return null;
                    }
                })
            )
        ).filter((m): m is { url: string; templateId: string } => m !== null);

        if (!memes.length) throw new Error(`No memes made from reply: ${text.slice(0, 200)}`);
        return NextResponse.json({ memes, aiPrompt });
    } catch (e) {
        console.error("Meme error:", e);
        const message = String(e);
        if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
            return NextResponse.json(
                { error: "Lots of people are making memes right now. Wait a minute and try again." },
                { status: 429 }
            );
        }
        return NextResponse.json({ error: "The AI got stumped. Try again." }, { status: 500 });
    }
}
