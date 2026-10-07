"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { getToday } from "@/lib/battle";
import Window from "@/app/components/Window";

export default function Enter() {
    const [supabase] = useState(() => createClient());
    const [{ date, prompt }] = useState(getToday);
    const [userId, setUserId] = useState<string | null>(null);
    const [alreadyEntered, setAlreadyEntered] = useState(false);
    const [photo, setPhoto] = useState<{ path: string; url: string } | null>(null);
    const [hint, setHint] = useState("");
    const [caption, setCaption] = useState("");
    const [aiPrompt, setAiPrompt] = useState("");
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);
            const { data } = await supabase
                .from("entries")
                .select("id")
                .eq("user_id", user.id)
                .eq("battle_date", date)
                .maybeSingle();
            if (data) setAlreadyEntered(true);
        })();
    }, [supabase, date]);

    async function generate(path = photo?.path) {
        if (!path) return;
        setError("");
        setBusy("AI is thinking of a caption…");
        const res = await fetch("/api/caption", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path, hint }),
        });
        const body = await res.json();
        setBusy("");
        if (!res.ok) {
            setError(body.error);
            return;
        }
        setCaption(body.caption);
        setAiPrompt(body.aiPrompt);
    }

    async function choosePhoto(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !userId) return;
        setError("");
        setCaption("");
        setBusy("Uploading photo…");
        const ext = file.name.split(".").pop();
        const path = `${userId}/${date}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("entries").upload(path, file);
        if (error) {
            setBusy("");
            setError(error.message);
            return;
        }
        const { data } = supabase.storage.from("entries").getPublicUrl(path);
        setPhoto({ path, url: data.publicUrl });
        await generate(path);
    }

    async function submit() {
        if (!photo || !caption || !userId) return;
        setBusy("Submitting…");
        const { error } = await supabase.from("entries").insert({
            user_id: userId,
            battle_date: date,
            daily_prompt: prompt,
            image_url: photo.url,
            image_path: photo.path,
            caption,
            ai_prompt: aiPrompt,
        });
        if (error) {
            setBusy("");
            setError(error.code === "23505" ? "You already entered today's battle!" : error.message);
            return;
        }
        window.location.href = "/";
    }

    return (
        <Window url="www.humorproject.com/enter" className="narrow">
            <p className="label">Today&apos;s prompt:</p>
            <h1 className="prompt-text">{prompt}</h1>

            {alreadyEntered ? (
                <div className="form">
                    <p>You already entered today. New prompt at midnight!</p>
                    <Link href="/vote" className="btn btn-primary">Go vote →</Link>
                </div>
            ) : (
                <div className="form">
                    <div className="frame photo">
                        {photo ? <img src={photo.url} alt="Your entry" /> : <span className="photo-empty">No photo yet</span>}
                    </div>
                    <label className="btn">
                        {photo ? "Change photo" : "Upload photo"}
                        <input type="file" accept="image/png, image/jpeg, image/webp" onChange={choosePhoto} hidden />
                    </label>
                    <label>
                        <span className="label">Hint for the AI (optional):</span>
                        <input
                            className="field"
                            value={hint}
                            onChange={(e) => setHint(e.target.value)}
                            placeholder="my roommate made this"
                            maxLength={100}
                        />
                    </label>
                    {caption && (
                        <div className="frame caption-box">
                            <p className="label">AI caption:</p>
                            <p className="caption-text">{caption}</p>
                        </div>
                    )}
                    {busy && <p className="status">{busy}</p>}
                    {error && <p className="error">{error}</p>}
                    {photo && (
                        <button className="btn" onClick={() => generate()} disabled={!!busy}>
                            {caption ? "↻ New caption" : "Generate caption"}
                        </button>
                    )}
                    {caption && (
                        <button className="btn btn-primary" onClick={submit} disabled={!!busy}>
                            Submit entry →
                        </button>
                    )}
                </div>
            )}
        </Window>
    );
}
