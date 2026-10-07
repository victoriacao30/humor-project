import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Window from "@/app/components/Window";

export const dynamic = "force-dynamic";

export default async function Members() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/");

    const { data: members } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, registered_at")
        .not("first_name", "is", null)
        .order("registered_at");

    const me = members?.find((m) => m.id === user.id);

    return (
        <Window url="www.humorproject.com/members">
            <h1 className="label title">Members ★</h1>
            <p className="hint">
                Hi {me?.first_name}! Members so far ({members?.length ?? 0}):
            </p>
            <ul className="member-grid">
                {members?.map((m) => (
                    <li key={m.id} className="frame member-card">
                        {m.avatar_url ? (
                            <img src={m.avatar_url} alt="" className="member-photo" />
                        ) : (
                            <div className="member-photo label">
                                {m.first_name?.[0]}
                                {m.last_name?.[0]}
                            </div>
                        )}
                        <p className="label member-name">
                            {m.first_name} {m.last_name}
                        </p>
                        {m.id === user.id && <span className="you-tag">You</span>}
                        <p className="member-since">
                            Joined {new Date(m.registered_at).toLocaleDateString()}
                        </p>
                    </li>
                ))}
            </ul>
        </Window>
    );
}
