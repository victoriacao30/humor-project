"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { getToday } from "@/lib/battle";
import Window from "@/app/components/Window";
import PostCard from "@/app/components/PostCard";
import SnippetButton from "@/app/components/SnippetButton";
import ShareButton from "@/app/components/ShareButton";

type Song = { id: number; title: string; artist: string; cover: string; preview: string | null };
type Meme = { url: string; templateId: string };
type Posted = {
    meme_url: string;
    image_url: string;
    caption: string;
    song_title: string;
    song_artist: string;
    song_preview: string | null;
    snippet_start: number;
    id: number;
};

const time = (s: number) => `0:${String(s).padStart(2, "0")}`;

export default function Enter() {
    const [supabase] = useState(() => createClient());
    const [{ date, prompt, dropAt }] = useState(getToday);
    const [userId, setUserId] = useState<string | null>(null);
    const [posted, setPosted] = useState<Posted | null>(null);

    const [query, setQuery] = useState("");
    const [results, setResults] = useState<Song[]>([]);
    const [searching, setSearching] = useState(false);
    const [song, setSong] = useState<Song | null>(null);
    const [snippetStart, setSnippetStart] = useState(0);

    const [moment, setMoment] = useState("");
    const [memes, setMemes] = useState<Meme[]>([]);
    const [memeIndex, setMemeIndex] = useState(0);
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
                .select("id, meme_url, image_url, caption, song_title, song_artist, song_preview, snippet_start")
                .eq("user_id", user.id)
                .eq("battle_date", date)
                .maybeSingle();
            if (data) setPosted(data);
        })();
    }, [supabase, date]);

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            setSearching(true);
            const res = await fetch(`/api/songs?q=${encodeURIComponent(query.trim())}`);
            const body = await res.json();
            if (cancelled) return;
            setSearching(false);
            if (!res.ok) setError(body.error);
            else setResults(body.songs);
        }, 350);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query]);

    async function makeMeme(fresh = false) {
        if (!song || !moment.trim()) return;
        if (!fresh && memeIndex + 1 < memes.length) {
            setMemeIndex(memeIndex + 1);
            return;
        }
        setError("");
        setBusy("AI is cooking up your memes…");
        const res = await fetch("/api/meme", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ songTitle: song.title, songArtist: song.artist, moment }),
        });
        const body = await res.json();
        setBusy("");
        if (!res.ok) {
            setError(body.detail ? `${body.error} (${body.detail})` : body.error);
            return;
        }
        setMemes(body.memes);
        setMemeIndex(0);
        setAiPrompt(body.aiPrompt);
    }

    function chooseSong(s: Song) {
        setSong(s);
        setQuery("");
        setResults([]);
        setSnippetStart(0);
        setMemes([]);
    }

    async function submit() {
        const meme = memes[memeIndex];
        if (!song || !meme || !userId) return;
        setBusy("Posting…");
        const { error } = await supabase.from("entries").insert({
            user_id: userId,
            battle_date: date,
            daily_prompt: prompt,
            image_url: song.cover,
            song_title: song.title,
            song_artist: song.artist,
            song_preview: song.preview,
            snippet_start: snippetStart,
            caption: moment.trim(),
            meme_url: meme.url,
            ai_prompt: aiPrompt,
        });
        if (error) {
            setBusy("");
            setError(error.code === "23505" ? "You already posted today!" : error.message);
            return;
        }
        window.location.href = "/";
    }

    const meme = memes[memeIndex];
    const moreReady = memes.length - memeIndex - 1;

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
                    <PostCard
                        meme={posted.meme_url}
                        cover={posted.image_url}
                        caption={posted.caption}
                        song={{ title: posted.song_title, artist: posted.song_artist, preview: posted.song_preview, start: posted.snippet_start }}
                    />
                    <p>You posted today! New drop tomorrow.</p>
                    <ShareButton id={posted.id} label="Share my post" />
                    <Link href="/vote" className="btn btn-primary">Go vote →</Link>
                </div>
            ) : (
                <div className="form">
                    <span className="label">1. Pick your song:</span>
                    {song ? (
                        <>
                            <div className="frame song-picked">
                                <img src={song.cover} alt="" />
                                <div className="song-meta">
                                    <p className="song-title">{song.title}</p>
                                    <p className="song-artist">{song.artist}</p>
                                </div>
                                <button type="button" className="btn btn-sm" onClick={() => setSong(null)}>Change</button>
                            </div>
                            {song.preview ? (
                                <div className="frame snippet-box">
                                    <p className="label">Choose your snippet:</p>
                                    <input
                                        type="range"
                                        min={0}
                                        max={15}
                                        step={1}
                                        value={snippetStart}
                                        onChange={(e) => setSnippetStart(Number(e.target.value))}
                                        className="snippet-slider"
                                        aria-label="Snippet start time"
                                    />
                                    <div className="snippet-row">
                                        <span>Plays {time(snippetStart)} – {time(snippetStart + 15)}</span>
                                        <SnippetButton src={song.preview} start={snippetStart} label="Preview" preload />
                                    </div>
                                </div>
                            ) : (
                                <p className="hint">No preview available for this song, but you can still post it.</p>
                            )}
                        </>
                    ) : (
                        <>
                            <input
                                className="field song-search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search a song or artist"
                                autoFocus
                            />
                            {searching && <p className="status">Searching…</p>}
                            {results.length > 0 && (
                                <ul className="song-results">
                                    {results.map((s) => (
                                        <li key={s.id} className="frame song-row">
                                            <button type="button" className="song-choose" onClick={() => chooseSong(s)}>
                                                <img src={s.cover} alt="" />
                                                <span className="song-meta">
                          <span className="song-title">{s.title}</span>
                          <span className="song-artist">{s.artist}</span>
                        </span>
                                            </button>
                                            {s.preview && <SnippetButton src={s.preview} />}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )}

                    <label>
                        <span className="label">2. What&apos;s happening right now?</span>
                        <textarea
                            className="field moment-field"
                            value={moment}
                            onChange={(e) => {
                                setMoment(e.target.value);
                                setMemes([]);
                            }}
                            placeholder="cramming orgo in Butler at 2am"
                            maxLength={150}
                            rows={2}
                        />
                    </label>

                    {!meme && (
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => makeMeme(true)}
                            disabled={!song || !moment.trim() || !!busy}
                        >
                            ✨ Make my meme
                        </button>
                    )}

                    {meme && (
                        <div className="frame meme-box">
                            <p className="label">Your AI meme:</p>
                            <img src={meme.url} alt="Your AI-generated meme" />
                        </div>
                    )}
                    {busy && <p className="status">{busy}</p>}
                    {error && <p className="error">{error}</p>}
                    {meme && (
                        <button type="button" className="btn" onClick={() => makeMeme()} disabled={!!busy}>
                            {moreReady > 0 ? `↻ New meme (${moreReady} more ready)` : "↻ New memes"}
                        </button>
                    )}
                    {meme && (
                        <button type="button" className="btn btn-primary" onClick={submit} disabled={!!busy}>
                            Post it →
                        </button>
                    )}
                </div>
            )}
        </Window>
    );
}