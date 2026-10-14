"use client";
import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { getToday } from "@/lib/battle";
import Window from "@/app/components/Window";
import PostCard from "@/app/components/PostCard";

type Upload = { path: string; url: string };

// Shrinks a photo to max 1080px and saves it as a JPEG, so uploads and AI captions are fast.
async function shrink(file: File, maxSize = 1080): Promise<Blob> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process photo"))), "image/jpeg", 0.85)
    );
}

export default function Enter() {
    const [supabase] = useState(() => createClient());
    const [{ date, prompt, dropAt }] = useState(getToday);
    const [userId, setUserId] = useState<string | null>(null);
    const [posted, setPosted] = useState<{ image_url: string; selfie_url: string; caption: string } | null>(null);
    const [shot, setShot] = useState<Upload | null>(null);
    const [selfie, setSelfie] = useState<Upload | null>(null);
    const [hint, setHint] = useState("");
    const [options, setOptions] = useState<string[]>([]);
    const [optionIndex, setOptionIndex] = useState(0);
    const [caption, setCaption] = useState("");
    const [aiPrompt, setAiPrompt] = useState("");
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const notYet = Date.now() < dropAt;

    useEffect(() => {
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);
            const { data } = await supabase
                .from("entries")
                .select("image_url, selfie_url, caption")
                .eq("user_id", user.id)
                .eq("battle_date", date)
                .maybeSingle();
            if (data) setPosted(data);
        })();
    }, [supabase, date]);

    async function generate(s = shot, f = selfie, fresh = false) {
        if (!s || !f) return;

        // Show the next caption we already have, instantly.
        if (!fresh && optionIndex + 1 < options.length) {
            const next = optionIndex + 1;
            setOptionIndex(next);
            setCaption(options[next]);
            return;
        }

        setError("");
        setBusy("AI is listening… writing your captions");
        const res = await fetch("/api/caption", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ screenshotPath: s.path, selfiePath: f.path, hint }),
        });
        const body = await res.json();
        setBusy("");
        if (!res.ok) {
            setError(body.error);
            return;
        }
        setOptions(body.captions);
        setOptionIndex(0);
        setCaption(body.captions[0]);
        setAiPrompt(body.aiPrompt);
    }

    async function upload(kind: "shot" | "selfie", e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !userId) return;
        setError("");
        setCaption("");
        setOptions([]);
        setBusy(kind === "shot" ? "Uploading screenshot…" : "Uploading selfie…");

        let small: Blob;
        try {
            small = await shrink(file);
        } catch {
            setBusy("");
            setError("Couldn't read that photo. Try a JPG or PNG.");
            return;
        }

        const path = `${userId}/${date}-${kind}-${Date.now()}.jpg`;
        const { error } = await supabase.storage
            .from("entries")
            .upload(path, small, { contentType: "image/jpeg" });
        if (error) {
            setBusy("");
            setError(error.message);
            return;
        }
        const up = { path, url: supabase.storage.from("entries").getPublicUrl(path).data.publicUrl };
        setBusy("");
        if (kind === "shot") {
            setShot(up);
            await generate(up, selfie, true);
        } else {
            setSelfie(up);
            await generate(shot, up, true);
        }
    }

    async function submit() {
        if (!shot || !selfie || !caption || !userId) return;
        setBusy("Posting…");
        const { error } = await supabase.from("entries").insert({
            user_id: userId,
            battle_date: date,
            daily_prompt: prompt,
            image_url: shot.url,
            image_path: shot.path,
            selfie_url: selfie.url,
            selfie_path: selfie.path,
            caption,
            ai_prompt: aiPrompt,
        });
        if (error) {
            setBusy("");
            setError(error.code === "23505" ? "You already posted today!" : error.message);
            return;
        }
        window.location.href = "/";
    }

    const moreReady = options.length - optionIndex - 1;

    return (
        <Window url="www.humorproject.com/post" className="narrow">
            <p className="label">Today&apos;s drop:</p>
            <h1 className="prompt-text">{prompt}</h1>

            {notYet ? (
                <div className="form">
                    <p>Not time yet! Today&apos;s drop hasn&apos;t happened. Check back later 👀</p>
                    <Link href="/" className="btn">← Back</Link>
                </div>
            ) : posted ? (
                <div className="form">
                    <PostCard screenshot={posted.image_url} selfie={posted.selfie_url} caption={posted.caption} />
                    <p>You posted today! New drop tomorrow.</p>
                    <Link href="/vote" className="btn btn-primary">Go vote →</Link>
                </div>
            ) : (
                <div className="form">
                    <div className="upload-row">
                        <label className="frame upload-slot">
                            {shot ? (
                                <img src={shot.url} alt="Your song screenshot" />
                            ) : (
                                <span className="photo-empty">
                  <span className="slot-plus">＋</span>
                  Upload song screenshot
                </span>
                            )}
                            {shot && <span className="slot-change">Tap to change</span>}
                            <input type="file" accept="image/png, image/jpeg, image/webp" onChange={(e) => upload("shot", e)} hidden />
                        </label>
                        <label className="frame upload-slot">
                            {selfie ? (
                                <img src={selfie.url} alt="Your selfie" />
                            ) : (
                                <span className="photo-empty">
                  <span className="slot-plus">＋</span>
                  Take selfie
                </span>
                            )}
                            {selfie && <span className="slot-change">Tap to retake</span>}
                            <input
                                type="file"
                                accept="image/png, image/jpeg, image/webp"
                                capture="user"
                                onChange={(e) => upload("selfie", e)}
                                hidden
                            />
                        </label>
                    </div>

                    <label>
                        <span className="label">Hint for the AI (optional):</span>
                        <input
                            className="field"
                            value={hint}
                            onChange={(e) => {
                                setHint(e.target.value);
                                setOptions([]);
                            }}
                            placeholder="cramming for orgo"
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
                    {shot && selfie && (
                        <button className="btn" onClick={() => generate()} disabled={!!busy}>
                            {!caption ? "Generate caption" : moreReady > 0 ? `↻ New caption (${moreReady} more ready)` : "↻ New captions"}
                        </button>
                    )}
                    {caption && (
                        <button className="btn btn-primary" onClick={submit} disabled={!!busy}>
                            Post it →
                        </button>
                    )}
                </div>
            )}
        </Window>
    );
}
