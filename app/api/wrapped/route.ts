import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { addDays } from "@/lib/week";
import { generateJsonText } from "@/lib/gemini";
import { finishRequest, loadAiConfig, logResponse, startRequest } from "@/lib/ai-log";

export const maxDuration = 30;

type Wrapped = { title: string; vibe: string; summary: string; funFact: string; prediction: string };

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Sign in to see your Wrapped." }, { status: 401 });
    }

    const { weekStart } = await request.json();
    if (typeof weekStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
        return NextResponse.json({ error: "Invalid week." }, { status: 400 });
    }
    const weekEnd = addDays(weekStart, 6);

    const [{ data: posts }, { data: profile }] = await Promise.all([
        supabase
            .from("entries")
            .select("battle_date, song_title, song_artist, caption")
            .eq("user_id", user.id)
            .gte("battle_date", weekStart)
            .lte("battle_date", weekEnd)
            .order("battle_date"),
        supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle(),
    ]);
    if (!posts?.length) {
        return NextResponse.json({ error: "Post at least once this week to unlock your Wrapped." }, { status: 400 });
    }

    const config = await loadAiConfig(supabase, "weekly-wrapped");
    if (!config.enabled) {
        return NextResponse.json({ error: "Wrapped is paused by an admin right now. Try again later." }, { status: 503 });
    }

    const startedAt = Date.now();
    const requestId = await startRequest(supabase, user.id, "weekly-wrapped", { weekStart, posts: posts.length });

    const lines = posts
        .map((p) => {
            const day = new Date(`${p.battle_date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
            return `${day}: "${p.song_title}" by ${p.song_artist}, while ${p.caption}`;
        })
        .join("\n");

    const aiPrompt = [
        "You write a playful weekly 'Wrapped' recap for a music check-in app used by Columbia University students in New York City.",
        `Student's first name: ${profile?.first_name ?? "friend"}.`,
        `Their posts this week (${weekStart} to ${weekEnd}): each line is a day, the song they were listening to, and what they were doing.`,
        lines,
        "Write a fun, specific recap based on their actual songs and activities. Be witty and warm, never mean.",
        'Reply with only JSON: {"title": "a funny name for their week, max 8 words", "vibe": "3 to 5 words describing their musical mood", "summary": "2 or 3 sentences about their week", "funFact": "one playful observation about a pattern in their week", "prediction": "a funny prediction for their next week"}',
    ].join("\n");

    try {
        const { text: raw } = await generateJsonText(aiPrompt, {
            models: config.models,
            onAttempt: (a) => logResponse(supabase, requestId, a),
        });
        const text = raw.replace(/```(json)?/g, "").trim();
        const parsed = JSON.parse(text) as Partial<Wrapped>;
        const keys: (keyof Wrapped)[] = ["title", "vibe", "summary", "funFact", "prediction"];
        if (!keys.every((k) => typeof parsed[k] === "string" && parsed[k]!.trim())) {
            throw new Error(`Incomplete wrapped: ${text.slice(0, 200)}`);
        }
        const content = Object.fromEntries(keys.map((k) => [k, parsed[k]!.trim()])) as Wrapped;

        const { error } = await supabase
            .from("wrapped")
            .upsert({ user_id: user.id, week_start: weekStart, content, ai_prompt: aiPrompt }, { onConflict: "user_id,week_start" });
        if (error) console.error("Wrapped save error:", error);

        await finishRequest(supabase, requestId, startedAt, "succeeded");
        return NextResponse.json({ content });
    } catch (e) {
        console.error("Wrapped error:", e);
        const message = String(e);
        await finishRequest(supabase, requestId, startedAt, "failed", message.slice(0, 500));
        if (message.includes("429") || message.includes("RESOURCE_EXHAUSTED")) {
            return NextResponse.json({ error: "The AI is busy right now. Wait a minute and try again." }, { status: 429 });
        }
        if (message.includes("503") || message.includes("UNAVAILABLE") || message.includes("high demand")) {
            return NextResponse.json({ error: "Google's AI is overloaded right now. Wait a few seconds and try again." }, { status: 503 });
        }
        return NextResponse.json({ error: "The AI got stumped. Try again." }, { status: 500 });
    }
}
