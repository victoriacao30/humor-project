"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { getToday, isLate } from "@/lib/battle";
import Window from "@/app/components/Window";
import PostCard from "@/app/components/PostCard";

type Entry = {
    id: number;
    meme_url: string;
    image_url: string;
    caption: string;
    created_at: string;
    song_title: string;
    song_artist: string;
    song_preview: string | null;
    snippet_start: number;
};

function pairKey(a: number, b: number) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

export default function VoteBoard({ groupId }: { groupId?: number }) {
    const [supabase] = useState(() => createClient());
    const [{ date, prompt, dropAt }] = useState(getToday);
    const [userId, setUserId] = useState<string | null>(null);
    const [groupName, setGroupName] = useState<string | null>(null);
    const [notMember, setNotMember] = useState(false);
    const [entries, setEntries] = useState<Entry[]>([]);
    const [seen, setSeen] = useState<Set<string>>(new Set());
    const [pair, setPair] = useState<[Entry, Entry] | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasEntry, setHasEntry] = useState(false);
    const [error, setError] = useState("");
    const notYet = Date.now() < dropAt;
    const backHref = groupId ? `/groups/${groupId}` : "/";

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

            let memberIds: string[] | null = null;
            if (groupId) {
                const [{ data: group }, { data: members }] = await Promise.all([
                    supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
                    supabase.from("group_members").select("user_id").eq("group_id", groupId),
                ]);
                if (!group) {
                    setNotMember(true);
                    setLoading(false);
                    return;
                }
                setGroupName(group.name);
                memberIds = (members ?? []).map((m) => m.user_id);
            }

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

            let entryQuery = supabase
                .from("entries")
                .select("id, meme_url, image_url, caption, created_at, song_title, song_artist, song_preview, snippet_start")
                .eq("battle_date", date)
                .neq("user_id", user.id);
            if (memberIds) entryQuery = entryQuery.in("user_id", memberIds);

            const [{ data: entryRows }, { data: voteRows }] = await Promise.all([
                entryQuery,
                supabase.from("votes").select("winner_id, loser_id").eq("voter_id", user.id).eq("battle_date", date),
            ]);
            const list = (entryRows ?? []) as Entry[];
            const seenPairs = new Set((voteRows ?? []).map((v) => pairKey(v.winner_id, v.loser_id)));
            setEntries(list);
            setSeen(seenPairs);
            pickPair(list, seenPairs);
            setLoading(false);
        })();
    }, [supabase, date, groupId, pickPair]);

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
        <Window url={groupId ? `www.humorproject.com/groups/${groupId}/vote` : "www.humorproject.com/vote"}>
            {groupName && <p className="label">Voting in {groupName} ★</p>}
            <p className="label">Today&apos;s drop:</p>
            <h1 className="prompt-text">{prompt}</h1>

            {notMember ? (
                <div className="form">
                    <p>You&apos;re not in this group. Ask a friend for the invite code!</p>
                    <Link href="/groups" className="btn">← Your groups</Link>
                </div>
            ) : notYet ? (
                <div className="form">
                    <p>Today&apos;s drop hasn&apos;t happened yet. Voting opens once people start posting 👀</p>
                    <Link href={backHref} className="btn">← Back</Link>
                </div>
            ) : loading ? (
                <p className="status">Loading matchups…</p>
            ) : !hasEntry ? (
                <div className="form">
                    <p>Post today first! Pick your song and make your meme, then come back to judge everyone else.</p>
                    <Link href="/enter" className="btn btn-primary">Post now →</Link>
                </div>
            ) : entries.length < 2 ? (
                <div className="form">
                    <p>
                        {groupId
                            ? "Not enough friends have posted yet. Voting opens once 2 other members post. Share your invite code!"
                            : "Not enough posts yet! Voting opens once at least 2 other people post. Invite your friends."}
                    </p>
                    <Link href={backHref} className="btn">← Back</Link>
                </div>
            ) : !pair ? (
                <div className="form">
                    <p className="label">You judged every matchup today ★</p>
                    <Link href={backHref} className="btn btn-primary">See the leaderboard →</Link>
                </div>
            ) : (
                <>
                    <p className="hint">Which meme wins? Tap ▶ to hear their song. ({seen.size} judged so far)</p>
                    <div className="versus">
                        {[0, 1].map((i) => {
                            const entry = pair[i];
                            const other = pair[1 - i];
                            return (
                                <div key={entry.id} className="frame vs-card">
                                    <PostCard
                                        meme={entry.meme_url}
                                        cover={entry.image_url}
                                        caption={entry.caption}
                                        late={isLate(entry.created_at, date)}
                                        song={{ title: entry.song_title, artist: entry.song_artist, preview: entry.song_preview, start: entry.snippet_start }}
                                    />
                                    <button type="button" className="btn btn-primary" onClick={() => choose(entry, other)}>
                                        This one wins ★
                                    </button>
                                </div>
                            );
                        })}
                        <span className="vs-badge">VS</span>
                    </div>
                    {error && <p className="error">{error}</p>}
                </>
            )}
        </Window>
    );
}