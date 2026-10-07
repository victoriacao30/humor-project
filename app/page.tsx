import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getToday, getYesterday } from "@/lib/battle";
import Window from "@/app/components/Window";
import { SignInButton } from "@/app/components/AuthButtons";

export const dynamic = "force-dynamic";

type Supabase = Awaited<ReturnType<typeof createClient>>;
type Score = { entry_id: number; wins: number; matchups: number };

async function rankedEntries(supabase: Supabase, date: string) {
    const [{ data: rows }, { data: scores }] = await Promise.all([
        supabase.from("entries").select("id, user_id, image_url, caption").eq("battle_date", date),
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
            return { ...e, name: names.get(e.user_id) ?? "Someone", wins, matchups, rate: matchups ? wins / matchups : 0 };
        })
        .sort((a, b) => b.rate - a.rate || b.wins - a.wins);
}

export default async function Home() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    const today = getToday();

    const todayRanked = user ? await rankedEntries(supabase, today.date) : [];
    const yesterdayRanked = user ? await rankedEntries(supabase, getYesterday().date) : [];
    const champ = yesterdayRanked.find((e) => e.matchups > 0);
    const myEntry = todayRanked.find((e) => e.user_id === user?.id);

    return (
        <div className="stack">
            <Window url="www.humorproject.com/battle">
                <p className="label">Today&apos;s prompt:</p>
                <h1 className="prompt-text">{today.prompt}</h1>
                <p className="hint">Upload a photo, let AI caption it, and battle your friends. New prompt every day at midnight.</p>
                {!user ? (
                    <div className="actions">
                        <SignInButton />
                    </div>
                ) : (
                    <div className="actions">
                        {myEntry ? (
                            <span className="you-tag">You&apos;re in today ✓</span>
                        ) : (
                            <Link href="/enter" className="btn btn-primary">Enter the battle →</Link>
                        )}
                        {myEntry && <Link href="/vote" className="btn">Start voting →</Link>}
                    </div>
                )}
            </Window>

            {user && champ && (
                <Window url="www.humorproject.com/hall-of-fame">
                    <p className="label">Yesterday&apos;s champion ★</p>
                    <div className="winner">
                        <img src={champ.image_url} alt="" />
                        <div>
                            <p className="caption-text">{champ.caption}</p>
                            <p className="leader-meta">by {champ.name} · {Math.round(champ.rate * 100)}% win rate</p>
                        </div>
                    </div>
                </Window>
            )}

            {user && (
                <Window url="www.humorproject.com/leaderboard">
                    <p className="label">Today&apos;s leaderboard:</p>
                    {todayRanked.length === 0 ? (
                        <p className="hint">No entries yet. Be the first!</p>
                    ) : (
                        <ol className="stack">
                            {todayRanked.map((e, i) => (
                                <li key={e.id} className="frame leader-row">
                                    <span className="rank">{i + 1}</span>
                                    <img src={e.image_url} alt="" className="thumb" />
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
