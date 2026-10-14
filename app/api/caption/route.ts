import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase-server";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Sign in to generate captions." }, { status: 401 });
    }

    const { screenshotPath, selfiePath, hint } = await request.json();
    const mine = (p: unknown) => typeof p === "string" && p.startsWith(`${user.id}/`);
    if (!mine(screenshotPath) || !mine(selfiePath)) {
        return NextResponse.json({ error: "Those photos aren't yours." }, { status: 400 });
    }

    const [shot, selfie] = await Promise.all([
        supabase.storage.from("entries").download(screenshotPath),
        supabase.storage.from("entries").download(selfiePath),
    ]);
    if (!shot.data || !selfie.data) {
        return NextResponse.json({ error: "Couldn't read your photos." }, { status: 400 });
    }

    const cleanHint = typeof hint === "string" ? hint.trim().slice(0, 100) : "";
    const aiPrompt = [
        "You write captions for a daily music check-in app for Columbia University students in New York City, like BeReal but for music.",
        "Image 1 is a screenshot of the song they're listening to right now. Image 2 is a selfie showing what they're doing.",
        "Read the song and artist from the screenshot if you can.",
        cleanHint ? `The user's hint: "${cleanHint}".` : "",
        "Write THREE different short, funny captions (each under 25 words) connecting the song to what they're doing. Be playful and clever, never mean.",
        "Reply with only a JSON array of 3 strings.",
    ]
        .filter(Boolean)
        .join(" ");

    try {
        const toPart = async (blob: Blob) => ({
            inlineData: {
                mimeType: blob.type || "image/jpeg",
                data: Buffer.from(await blob.arrayBuffer()).toString("base64"),
            },
        });
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: [
                {
                    role: "user",
                    parts: [await toPart(shot.data), await toPart(selfie.data), { text: aiPrompt }],
                },
            ],
            config: { responseMimeType: "application/json" },
        });

        const parsed: unknown = JSON.parse(response.text ?? "[]");
        const captions = (Array.isArray(parsed) ? parsed : [])
            .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
            .map((c) => c.trim().replace(/^"|"$/g, ""));
        if (!captions.length) throw new Error("No captions");

        return NextResponse.json({ captions, aiPrompt });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "The AI got stumped. Try again." }, { status: 500 });
    }
}
