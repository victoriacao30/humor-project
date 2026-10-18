"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Window from "@/app/components/Window";

type Group = { id: number; name: string; invite_code: string; count: number };

export default function Groups() {
    const router = useRouter();
    const [supabase] = useState(() => createClient());
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        (async () => {
            const { data: rows } = await supabase
                .from("groups")
                .select("id, name, invite_code")
                .order("created_at", { ascending: false });
            const ids = (rows ?? []).map((g) => g.id);
            const { data: members } = ids.length
                ? await supabase.from("group_members").select("group_id").in("group_id", ids)
                : { data: [] as { group_id: number }[] };
            const counts = new Map<number, number>();
            (members ?? []).forEach((m) => counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1));
            setGroups((rows ?? []).map((g) => ({ ...g, count: counts.get(g.id) ?? 1 })));
            setLoading(false);
        })();
    }, [supabase]);

    async function create(e: FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        setError("");
        const { data, error } = await supabase.rpc("create_group", { p_name: name.trim() });
        setBusy(false);
        if (error) {
            setError(error.message);
            return;
        }
        router.push(`/groups/${data}`);
    }

    async function join(e: FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError("");
        const { data, error } = await supabase.rpc("join_group", { p_code: code.trim() });
        setBusy(false);
        if (error) {
            setError(error.message.includes("Invalid") ? "That code doesn't match any group." : error.message);
            return;
        }
        router.push(`/groups/${data}`);
    }

    return (
        <div className="stack">
            <Window url="www.humorproject.com/groups">
                <h1 className="label title">Your groups:</h1>
                {loading ? (
                    <p className="status">Loading…</p>
                ) : groups.length === 0 ? (
                    <p>You&apos;re not in any groups yet. Create one for your friends, or join with their code!</p>
                ) : (
                    <ul className="stack">
                        {groups.map((g) => (
                            <li key={g.id}>
                                <Link href={`/groups/${g.id}`} className="frame group-row">
                                    <span className="group-name">{g.name}</span>
                                    <span className="leader-meta">
                    {g.count} {g.count === 1 ? "member" : "members"} · code {g.invite_code}
                  </span>
                                    <span className="group-go">→</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </Window>

            <div className="group-forms">
                <Window url="www.humorproject.com/groups/new">
                    <form onSubmit={create} className="form">
                        <label>
                            <span className="label">Create a group:</span>
                            <input
                                className="field"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Carman 9th floor"
                                maxLength={40}
                            />
                        </label>
                        <button className="btn btn-primary" disabled={busy || !name.trim()}>Create →</button>
                    </form>
                </Window>
                <Window url="www.humorproject.com/groups/join">
                    <form onSubmit={join} className="form">
                        <label>
                            <span className="label">Join with a code:</span>
                            <input
                                className="field"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder="ABC123"
                                maxLength={6}
                            />
                        </label>
                        <button className="btn" disabled={busy || code.trim().length < 6}>Join →</button>
                    </form>
                </Window>
            </div>
            {error && <p className="error">{error}</p>}
        </div>
    );
}
