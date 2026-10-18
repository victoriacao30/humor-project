import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getToday } from "@/lib/battle";
import Window from "@/app/components/Window";

export const dynamic = "force-dynamic";

export default async function VoteHub() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const today = getToday();
    const dropped = Date.now() >= today.dropAt;

    const [{ data: groups }, { data: todays }] = await Promise.all([
        supabase.from("groups").select("id, name").order("created_at"),
        supabase.from("entries").select("user_id").eq("battle_date", today.date),
    ]);
    const posters = new Set((todays ?? []).map((e) => e.user_id));
    const groupIds = (groups ?? []).map((g) => g.id);
    const { data: members } = groupIds.length
        ? await supabase.from("group_members").select("group_id, user_id").in("group_id", groupIds)
        : { data: [] as { group_id: number; user_id: string }[] };

    const stats = new Map<number, { members: number; posted: number }>();
    (members ?? []).forEach((m) => {
        const s = stats.get(m.group_id) ?? { members: 0, posted: 0 };
        s.members++;
        if (posters.has(m.user_id)) s.posted++;
        stats.set(m.group_id, s);
    });
    const iPosted = posters.has(user.id);

    return (
        <Window url="www.humorproject.com/vote" className="narrow">
            <h1 className="label title">Where do you want to vote?</h1>

            {!dropped ? (
                <p className="vote-hub-note">Today&apos;s drop hasn&apos;t happened yet 👀 Voting opens once people start posting.</p>
            ) : !iPosted ? (
                <div className="form vote-hub-note">
                    <p>Post today first, then you can vote everywhere you&apos;re a member.</p>
                    <Link href="/enter" className="btn btn-primary">Post now →</Link>
                </div>
            ) : null}

            <ul className="stack">
                <li>
                    <Link href="/vote/everyone" className="frame group-row">
                        <span className="group-name">🌍 Everyone</span>
                        <span className="leader-meta">
              {posters.size} {posters.size === 1 ? "post" : "posts"} today
            </span>
                        <span className="group-go">→</span>
                    </Link>
                </li>
                {(groups ?? []).map((g) => {
                    const s = stats.get(g.id) ?? { members: 1, posted: 0 };
                    return (
                        <li key={g.id}>
                            <Link href={`/groups/${g.id}/vote`} className="frame group-row">
                                <span className="group-name">{g.name}</span>
                                <span className="leader-meta">
                  {s.posted} of {s.members} {s.members === 1 ? "member" : "members"} posted
                </span>
                                <span className="group-go">→</span>
                            </Link>
                        </li>
                    );
                })}
            </ul>

            {(groups ?? []).length === 0 && (
                <div className="actions">
                    <p>Want to battle just your friends?</p>
                    <Link href="/groups" className="btn btn-sm">Create or join a group →</Link>
                </div>
            )}
        </Window>
    );
}
