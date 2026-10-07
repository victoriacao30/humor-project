"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { getToday } from "@/lib/battle";
import Window from "@/app/components/Window";

type Entry = { id: number; image_url: string; caption: string };

function pairKey(a: number, b: number) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export default function Vote() {
    const [supabase] = useState(() => createClient());
    const [{ date, prompt }] = useState(getToday);
    const [userId, setUserId] = useState<string | null>(null);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [seen, setSeen] = useState<Set<string>>(new Set());
    const [pair, setPair] = useState<[Entry, Entry] | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasEntry, setHasEntry] = useState(false);
    const [error, setError] = useState("");

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
                supabase.from("entries").select("id, image_url, caption").eq("battle_date", date).neq("user_id", user.id),
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
            <p className="label">Today&apos;s prompt:</p>
            <h1 className="prompt-text">{prompt}</h1>

            {loading ? (
                <p className="status">Loading matchups…</p>
            ) : !hasEntry ? (
                <div className="form">
                    <p>Enter today&apos;s battle first! Upload your photo, then come back to judge everyone else&apos;s.</p>
                    <Link href="/enter" className="btn btn-primary">Enter the battle →</Link>
                </div>
            ) : entries.length < 2 ? (
                <div className="form">
                    <p>Not enough entries yet! Voting opens once at least 2 other people enter. Invite your friends.</p>
                    <Link href="/" className="btn">← Back to battle</Link>
                </div>
            ) : !pair ? (
                <div className="form">
                    <p className="label">You judged every matchup today ★</p>
                    <Link href="/" className="btn btn-primary">See the leaderboard →</Link>
                </div>
            ) : (
                <>
                    <p className="hint">Which one is funnier? Tap it. ({seen.size} judged so far)</p>
                    <div className="versus">
                        <button className="frame vs-card" onClick={() => choose(pair[0], pair[1])}>
                            <img src={pair[0].image_url} alt="" />
                            <p className="caption-text">{pair[0].caption}</p>
                        </button>
                        <span className="vs-badge">VS</span>
                        <button className="frame vs-card" onClick={() => choose(pair[1], pair[0])}>
                            <img src={pair[1].image_url} alt="" />
                            <p className="caption-text">{pair[1].caption}</p>
                        </button>
                    </div>
                    {error && <p className="error">{error}</p>}
                </>
            )}
        </Window>
    );
}
