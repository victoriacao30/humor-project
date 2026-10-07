import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Window from "@/app/components/Window";

export default async function Members() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/");

    const { data: profile } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("id", user.id)
        .single();

    return (
        <Window url="www.humorproject.com/members-only" className="narrow">
            <h1 className="label title">Members only ★</h1>
            <p>Hi {profile?.first_name}! Only signed-in users can see this page.</p>
        </Window>
    );
}

