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
            .select("id, user_id, image_url, selfie_url, caption, created_at")
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
                    Once a day at a surprise time, share a screenshot of your song + a selfie of what you&apos;re doing.
                    AI writes the caption, then everyone votes.
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
                <Window url="www.humorproject.com/hall-of-fame">
                    <p className="label">Yesterday&apos;s champion 👑</p>
                    <div className="winner">
                        <PostCard screenshot={champ.image_url} selfie={champ.selfie_url} late={champ.late} />
                        <div>
                            <p className="caption-text">{champ.caption}</p>
                            <p className="leader-meta">by {champ.name} · {Math.round(champ.rate * 100)}% win rate</p>
                        </div>
                    </div>
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
                                    <PostCard screenshot={e.image_url} selfie={e.selfie_url} late={e.late} size="sm" />
                                    <div>
                                        <p className="caption-text">{e.caption}</p>
                                        <p className="leader-meta">by {e.name}{e.user_id === user.id ? " (you)" : ""}</p>
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

