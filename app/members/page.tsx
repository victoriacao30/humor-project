import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

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
        <main className="p-6">
            <h1 className="text-xl font-bold mb-2">Members only</h1>
            <p>Hi {profile?.first_name}! Only signed-in users can see this page.</p>
        </main>
    );
}

