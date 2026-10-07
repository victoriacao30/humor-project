import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase-server";
import { getToday } from "@/lib/battle";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Sign in to generate captions." }, { status: 401 });
    }

    const { path, hint } = await request.json();
    if (typeof path !== "string" || !path.startsWith(`${user.id}/`)) {
        return NextResponse.json({ error: "That photo isn't yours." }, { status: 400 });
    }

    const { data: file, error } = await supabase.storage.from("entries").download(path);
    if (error || !file) {
        return NextResponse.json({ error: "Couldn't read your photo." }, { status: 400 });
    }

    const { prompt: dailyPrompt } = getToday();
    const cleanHint = typeof hint === "string" ? hint.trim().slice(0, 100) : "";
    const aiPrompt = [
        "You write captions for a daily photo battle between Columbia University students in New York City.",
        `Today's prompt is: "${dailyPrompt}".`,
        cleanHint ? `The photographer's hint: "${cleanHint}".` : "",
        "Write ONE short, funny caption (under 20 words) for this photo. Be playful and clever, never mean. Reply with only the caption, no quotation marks.",
    ]
        .filter(Boolean)
        .join(" ");

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const data = Buffer.from(await file.arrayBuffer()).toString("base64");
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: [
                {
                    role: "user",
                    parts: [
                        { inlineData: { mimeType: file.type || "image/jpeg", data } },
                        { text: aiPrompt },
                    ],
                },
            ],
        });
        const caption = response.text?.trim().replace(/^"|"$/g, "");
        if (!caption) throw new Error("Empty caption");
        return NextResponse.json({ caption, aiPrompt });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "The AI got stumped. Try again." }, { status: 500 });
    }
}
