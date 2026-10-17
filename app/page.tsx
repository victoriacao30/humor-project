import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getToday, getYesterday, isLate } from "@/lib/battle";
import Window from "@/app/components/Window";
import PostCard from "@/app/components/PostCard";
import DropStatus from "@/app/components/DropStatus";
import { SignInButton } from "@/app/components/AuthButtons";

export const dynamic = "force-dynamic";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Score = { entry_id: number; wins: number; matchups: number };

async function rankedEntries(supabase: Supabase, date: string) {
    const [{ data: rows }, { data: scores }] = await Promise.all([
        supabase
            .from("entries")
            .select("id, user_id, meme_url, image_url, caption, created_at, song_title, song_artist, song_preview, snippet_start")
            .eq("battle_date", date),
        supabase.rpc("battle_scores", { d: date }),
    ]);
    const entries = rows ?? [];
    const ids = [...new Set(entries.map((e) => e.user_id))];
    const { data: people } = ids.length
        ? await supabase.from("profiles").select("id, first_name").in("id", ids)
        : { data: [] as { id: string; first_name: string | null }[] };
    const names = new Map((people ?? []).map((p) => [p.id, p.first_name]));
    const scoreMap = new Map(((scores ?? []) as Score[]).map((s) => [s.entry_id, s]));

    return entries
        .map((e) => {
            const s = scoreMap.get(e.id);
            const wins = Number(s?.wins ?? 0);
            const matchups = Number(s?.matchups ?? 0);
            return {
                ...e,
                name: names.get(e.user_id) ?? "Someone",
                late: isLate(e.created_at, date),
                wins,
                matchups,
                rate: matchups ? wins / matchups : 0,
            };
        })
        .sort((a, b) => b.rate - a.rate || b.wins - a.wins);
}

export default async function Home() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const today = getToday();
    const dropped = Date.now() >= today.dropAt;

    const todayRanked = user && dropped ? await rankedEntries(supabase, today.date) : [];
    const yesterdayRanked = user ? await rankedEntries(supabase, getYesterday().date) : [];
    const champ = yesterdayRanked.find((e) => e.matchups > 0);
    const myEntry = todayRanked.find((e) => e.user_id === user?.id);

    return (
        <div className="stack">
            <Window url="www.humorproject.com/now-playing">
                <p className="label">Today&apos;s drop:</p>
                <h1 className="prompt-text">{today.prompt}</h1>
                <p className="hint">
                    Once a day at a surprise time, share your song and what you&apos;re doing. AI turns it into a meme,
                    then everyone votes on the best one.
                </p>
                <DropStatus dropAt={today.dropAt} />
                {!user ? (
                    <div className="actions">
                        <SignInButton />
                    </div>
                ) : dropped ? (
                    <div className="actions">
                        {myEntry ? (
                            <>
                                <span className="you-tag">Posted ✓</span>
                                <Link href="/vote" className="btn btn-primary">Start voting →</Link>
                            </>
                        ) : (
                            <Link href="/enter" className="btn btn-primary">Post now →</Link>
                        )}
                    </div>
                ) : null}
            </Window>

            {user && champ && (
                <Window url="www.humorproject.com/hall-of-fame" className="narrow">
                    <p className="label">Yesterday&apos;s champion 👑</p>
                    <PostCard
                        meme={champ.meme_url}
                        cover={champ.image_url}
                        caption={champ.caption}
                        name={champ.name}
                        late={champ.late}
                        song={{ title: champ.song_title, artist: champ.song_artist, preview: champ.song_preview, start: champ.snippet_start }}
                    />
                    <p className="leader-meta">{Math.round(champ.rate * 100)}% win rate</p>
                </Window>
            )}

            {user && dropped && (
                <Window url="www.humorproject.com/leaderboard">
                    <p className="label">Today&apos;s leaderboard:</p>
                    {todayRanked.length === 0 ? (
                        <p className="hint">No posts yet. Be the first!</p>
                    ) : (
                        <ol className="stack">
                            {todayRanked.map((e, i) => (
                                <li key={e.id} className="frame leader-row">
                                    <span className="rank">{i + 1}</span>
                                    <PostCard meme={e.meme_url} late={e.late} size="sm" />
                                    <div>
                                        <Link href={`/p/${e.id}`} className="caption-text caption-link">“{e.caption}”</Link>
                                        <p className="leader-meta">♫ {e.song_title} · by {e.name}{e.user_id === user.id ? " (you)" : ""}</p>
                                    </div>
                                    <div className="score">
                                        {Math.round(e.rate * 100)}%
                                        <p className="leader-meta">{e.matchups} {e.matchups === 1 ? "matchup" : "matchups"}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </Window>
            )}
        </div>
    );
}
