import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getToday, isLate } from "@/lib/battle";
import Window from "@/app/components/Window";
import PostCard from "@/app/components/PostCard";
import GroupActions from "@/app/components/GroupActions";

export const dynamic = "force-dynamic";

type Score = { entry_id: number; wins: number; matchups: number };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const groupId = Number(id);
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: group } = Number.isInteger(groupId)
        ? await supabase.from("groups").select("id, name, invite_code").eq("id", groupId).maybeSingle()
        : { data: null };

    if (!group) {
        return (
            <Window url="www.humorproject.com/groups" className="narrow">
                <p className="label">Group not found</p>
                <p>This group doesn&apos;t exist, or you&apos;re not in it. Ask a friend for the invite code!</p>
                <div className="actions">
                    <Link href="/groups" className="btn">← Your groups</Link>
                </div>
            </Window>
        );
    }

    const today = getToday();
    const dropped = Date.now() >= today.dropAt;
    const { data: memberRows } = await supabase.from("group_members").select("user_id").eq("group_id", groupId);
    const memberIds = (memberRows ?? []).map((m) => m.user_id);

    const [{ data: people }, { data: rows }, { data: scores }] = await Promise.all([
        supabase.from("profiles").select("id, first_name, avatar_url").in("id", memberIds),
        supabase
            .from("entries")
            .select("id, user_id, meme_url, caption, created_at, song_title")
            .eq("battle_date", today.date)
            .in("user_id", memberIds),
        supabase.rpc("group_scores", { g: groupId, d: today.date }),
    ]);

    const names = new Map((people ?? []).map((p) => [p.id, p.first_name ?? "Someone"]));
    const scoreMap = new Map(((scores ?? []) as Score[]).map((s) => [s.entry_id, s]));
    const ranked = (rows ?? [])
        .map((e) => {
            const s = scoreMap.get(e.id);
            const wins = Number(s?.wins ?? 0);
            const matchups = Number(s?.matchups ?? 0);
            return { ...e, wins, matchups, rate: matchups ? wins / matchups : 0 };
        })
        .sort((a, b) => b.rate - a.rate || b.wins - a.wins);
    const posted = ranked.some((e) => e.user_id === user.id);

    return (
        <div className="stack">
            <Window url={`www.humorproject.com/groups/${group.id}`}>
                <p className="label">Group:</p>
                <h1 className="prompt-text">{group.name}</h1>
                <GroupActions groupId={group.id} inviteCode={group.invite_code} />

                <p className="label">Members ({people?.length ?? 0}):</p>
                <ul className="member-chips">
                    {(people ?? []).map((p) => (
                        <li key={p.id} className="member-chip">
                            {p.avatar_url ? (
                                <img src={p.avatar_url} alt="" />
                            ) : (
                                <span className="chip-initial">{p.first_name?.[0] ?? "?"}</span>
                            )}
                            {p.first_name}
                            {p.id === user.id ? " (you)" : ""}
                        </li>
                    ))}
                </ul>

                <div className="actions">
                    {!dropped ? (
                        <p>Today&apos;s drop hasn&apos;t happened yet 👀</p>
                    ) : posted ? (
                        <Link href={`/groups/${group.id}/vote`} className="btn btn-primary">Vote in {group.name} →</Link>
                    ) : (
                        <Link href="/enter" className="btn btn-primary">Post today to play →</Link>
                    )}
                </div>
            </Window>

            <Window url={`www.humorproject.com/groups/${group.id}/leaderboard`}>
                <p className="label">Today&apos;s group leaderboard:</p>
                {!dropped || ranked.length === 0 ? (
                    <p>No posts from the group yet today.</p>
                ) : (
                    <ol className="stack">
                        {ranked.map((e, i) => (
                            <li key={e.id} className="frame leader-row">
                                <span className="rank">{i + 1}</span>
                                <PostCard meme={e.meme_url} late={isLate(e.created_at, today.date)} size="sm" />
                                <div>
                                    <Link href={`/p/${e.id}`} className="caption-text caption-link">“{e.caption}”</Link>
                                    <p className="leader-meta">
                                        ♫ {e.song_title} · by {names.get(e.user_id)}
                                        {e.user_id === user.id ? " (you)" : ""}
                                    </p>
                                </div>
                                <div className="score">
                                    {Math.round(e.rate * 100)}%
                                    <p className="leader-meta">{e.matchups} {e.matchups === 1 ? "matchup" : "matchups"}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                )}
                <p className="share-hint leader-meta">Scores here only count votes from group members.</p>
            </Window>
        </div>
    );
}