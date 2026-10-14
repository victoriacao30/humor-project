"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { getToday, isLate } from "@/lib/battle";
import Window from "@/app/components/Window";
import PostCard from "@/app/components/PostCard";

type Entry = { id: number; image_url: string; selfie_url: string; caption: string; created_at: string };

function pairKey(a: number, b: number) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export default function Vote() {
    const [supabase] = useState(() => createClient());
    const [{ date, prompt, dropAt }] = useState(getToday);
    const [userId, setUserId] = useState<string | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [seen, setSeen] = useState<Set<string>>(new Set());
    const [pair, setPair] = useState<[Entry, Entry] | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasEntry, setHasEntry] = useState(false);
    const [error, setError] = useState("");
    const notYet = Date.now() < dropAt;

    const pickPair = useCallback((list: Entry[], seenPairs: Set<string>) => {
        const options: [Entry, Entry][] = [];
        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                if (!seenPairs.has(pairKey(list[i].id, list[j].id))) {
                    options.push(Math.random() < 0.5 ? [list[i], list[j]] : [list[j], list[i]]);
                }
            }
        }
        setPair(options.length ? options[Math.floor(Math.random() * options.length)] : null);
    }, []);

    useEffect(() => {
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);
            const { data: mine } = await supabase
                .from("entries")
                .select("id")
                .eq("user_id", user.id)
                .eq("battle_date", date)
                .maybeSingle();
            if (!mine) {
                setLoading(false);
                return;
            }
            setHasEntry(true);
            const [{ data: entryRows }, { data: voteRows }] = await Promise.all([
                supabase
                    .from("entries")
                    .select("id, image_url, selfie_url, caption, created_at")
                    .eq("battle_date", date)
                    .neq("user_id", user.id),
                supabase.from("votes").select("winner_id, loser_id").eq("voter_id", user.id).eq("battle_date", date),
            ]);
            const list = entryRows ?? [];
            const seenPairs = new Set((voteRows ?? []).map((v) => pairKey(v.winner_id, v.loser_id)));
            setEntries(list);
            setSeen(seenPairs);
            pickPair(list, seenPairs);
            setLoading(false);
        })();
    }, [supabase, date, pickPair]);

    async function choose(winner: Entry, loser: Entry) {
        if (!userId) return;
        setError("");
        const { error } = await supabase.from("votes").insert({
            voter_id: userId,
            winner_id: winner.id,
            loser_id: loser.id,
            battle_date: date,
        });
        if (error && error.code !== "23505") {
            setError(error.message);
            return;
        }
        const next = new Set(seen);
        next.add(pairKey(winner.id, loser.id));
        setSeen(next);
        pickPair(entries, next);
    }

    return (
        <Window url="www.humorproject.com/vote">
            <p className="label">Today&apos;s drop:</p>
            <h1 className="prompt-text">{prompt}</h1>

            {notYet ? (
                <div className="form">
                    <p>Today&apos;s drop hasn&apos;t happened yet. Voting opens once people start posting 👀</p>
                    <Link href="/" className="btn">← Back</Link>
                </div>
            ) : loading ? (
                <p className="status">Loading matchups…</p>
            ) : !hasEntry ? (
                <div className="form">
                    <p>Post today first! Share your song + selfie, then come back to judge everyone else.</p>
                    <Link href="/enter" className="btn btn-primary">Post now →</Link>
                </div>
            ) : entries.length < 2 ? (
                <div className="form">
                    <p>Not enough posts yet! Voting opens once at least 2 other people post. Invite your friends.</p>
                    <Link href="/" className="btn">← Back</Link>
                </div>
            ) : !pair ? (
                <div className="form">
                    <p className="label">You judged every matchup today ★</p>
                    <Link href="/" className="btn btn-primary">See the leaderboard →</Link>
                </div>
            ) : (
                <>
                    <p className="hint">Which post wins? Tap it. ({seen.size} judged so far)</p>
                    <div className="versus">
                        <button className="frame vs-card" onClick={() => choose(pair[0], pair[1])}>
                            <PostCard
                                screenshot={pair[0].image_url}
                                selfie={pair[0].selfie_url}
                                caption={pair[0].caption}
                                late={isLate(pair[0].created_at, date)}
                            />
                        </button>
                        <span className="vs-badge">VS</span>
                        <button className="frame vs-card" onClick={() => choose(pair[1], pair[0])}>
                            <PostCard
                                screenshot={pair[1].image_url}
                                selfie={pair[1].selfie_url}
                                caption={pair[1].caption}
                                late={isLate(pair[1].created_at, date)}
                            />
                        </button>
                    </div>
                    {error && <p className="error">{error}</p>}
                </>
            )}
        </Window>
    );
}
