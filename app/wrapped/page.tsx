"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { getToday } from "@/lib/battle";
import { addDays, mondayOf, weekLabel } from "@/lib/week";
import Window from "@/app/components/Window";
import SnippetButton from "@/app/components/SnippetButton";

type Post = {
    id: number;
    battle_date: string;
    image_url: string;
    song_title: string;
    song_artist: string;
    song_preview: string | null;
    snippet_start: number;
    caption: string;
};
type Wrapped = { title: string; vibe: string; summary: string; funFact: string; prediction: string };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function WrappedPage() {
    const [supabase] = useState(() => createClient());
    const [thisMonday] = useState(() => mondayOf(getToday().date));
    const [offset, setOffset] = useState(0);
    const weekStart = addDays(thisMonday, offset * 7);
    const weekEnd = addDays(weekStart, 6);

    const [posts, setPosts] = useState<Post[]>([]);
    const [wins, setWins] = useState<Set<string>>(new Set());
    const [wrapped, setWrapped] = useState<Wrapped | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            setLoading(true);
            setWrapped(null);
            setError("");
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            const [{ data: rows }, { data: winRows }, { data: saved }] = await Promise.all([
                supabase
                    .from("entries")
                    .select("id, battle_date, image_url, song_title, song_artist, song_preview, snippet_start, caption")
                    .eq("user_id", user.id)
                    .gte("battle_date", weekStart)
                    .lte("battle_date", weekEnd)
                    .order("battle_date"),
                supabase.rpc("winning_dates", { p_user: user.id }),
                supabase.from("wrapped").select("content").eq("user_id", user.id).eq("week_start", weekStart).maybeSingle(),
            ]);
            setPosts((rows ?? []) as Post[]);
            setWins(new Set(((winRows ?? []) as { battle_date: string }[]).map((d) => d.battle_date)));
            setWrapped((saved?.content as Wrapped) ?? null);
            setLoading(false);
        })();
    }, [supabase, weekStart, weekEnd]);

    async function generate() {
        setBusy(true);
        setError("");
        const res = await fetch("/api/wrapped", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ weekStart }),
        });
        const body = await res.json();
        setBusy(false);
        if (!res.ok) {
            setError(body.error);
            return;
        }
        setWrapped(body.content);
    }

    const byDate = new Map(posts.map((p) => [p.battle_date, p]));
    const artistCounts = new Map<string, number>();
    posts.forEach((p) => artistCounts.set(p.song_artist, (artistCounts.get(p.song_artist) ?? 0) + 1));
    const topArtist = [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
    const weekWins = posts.filter((p) => wins.has(p.battle_date)).length;

    return (
        <div className="stack">
            <Window url="www.humorproject.com/wrapped">
                <div className="cal-head">
                    <button className="btn btn-sm" onClick={() => setOffset((o) => o - 1)} aria-label="Previous week">←</button>
                    <h1 className="label title cal-title">{weekLabel(weekStart)}</h1>
                    <button className="btn btn-sm" onClick={() => setOffset((o) => o + 1)} disabled={offset === 0} aria-label="Next week">→</button>
                </div>

                {loading ? (
                    <p className="status">Loading your week…</p>
                ) : (
                    <>
                        <div className="stat-grid">
                            <div className="frame stat-tile">
                                <span className="stat-num">{posts.length}/7</span>
                                <span className="stat-label">days posted</span>
                            </div>
                            <div className="frame stat-tile">
                                <span className="stat-num stat-small">{topArtist}</span>
                                <span className="stat-label">top artist</span>
                            </div>
                            <div className="frame stat-tile">
                                <span className="stat-num">{weekWins}</span>
                                <span className="stat-label">👑 crowns</span>
                            </div>
                        </div>

                        <p className="label">Your week in songs:</p>
                        <div className="week-strip">
                            {DAYS.map((d, i) => {
                                const date = addDays(weekStart, i);
                                const p = byDate.get(date);
                                return (
                                    <div key={date} className="week-day">
                                        <span className="cal-dow">{d}</span>
                                        <div className="cal-day">
                                            {p ? <img src={p.image_url} alt={`${p.song_title} by ${p.song_artist}`} /> : "·"}
                                            {p && wins.has(date) && <span className="cal-crown">👑</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {posts.length > 0 && (
                            <ul className="stack">
                                {posts.map((p) => (
                                    <li key={p.id} className="frame song-row">
                                        <img src={p.image_url} alt="" />
                                        <span className="song-meta">
                      <span className="song-title">{p.song_title}</span>
                      <span className="song-artist">{p.song_artist} · “{p.caption}”</span>
                    </span>
                                        {p.song_preview && (
                                            <SnippetButton src={p.song_preview} start={p.snippet_start} preload={p.snippet_start > 0} />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </Window>

            {!loading && (
                <Window url="www.humorproject.com/wrapped/ai-recap">
                    {posts.length === 0 ? (
                        <div className="form">
                            <p className="label">✨ Your AI Wrapped</p>
                            <p>No posts this week yet. Post to unlock your AI Wrapped!</p>
                            {offset === 0 && <Link href="/enter" className="btn btn-primary">Post now →</Link>}
                        </div>
                    ) : wrapped ? (
                        <div className="form">
                            <p className="label">✨ Your AI Wrapped</p>
                            <h2 className="prompt-text">{wrapped.title}</h2>
                            <span className="you-tag wrapped-vibe">{wrapped.vibe}</span>
                            <p className="caption-text">{wrapped.summary}</p>
                            <div className="frame caption-box">
                                <p className="label">Fun fact:</p>
                                <p className="caption-text">{wrapped.funFact}</p>
                            </div>
                            <div className="frame caption-box">
                                <p className="label">🔮 Next week:</p>
                                <p className="caption-text">{wrapped.prediction}</p>
                            </div>
                            {error && <p className="error">{error}</p>}
                            <button className="btn" onClick={generate} disabled={busy}>
                                {busy ? "Rewriting your week…" : "↻ Regenerate"}
                            </button>
                        </div>
                    ) : (
                        <div className="form">
                            <p className="label">✨ Your AI Wrapped</p>
                            <p>Let AI look at everything you listened to this week, and everything you were doing, and sum it all up.</p>
                            {error && <p className="error">{error}</p>}
                            <button className="btn btn-primary" onClick={generate} disabled={busy}>
                                {busy ? "AI is listening to your week…" : "✨ Generate my Wrapped"}
                            </button>
                        </div>
                    )}
                </Window>
            )}
        </div>
    );
}
