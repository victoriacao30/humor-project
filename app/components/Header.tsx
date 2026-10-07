import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { SignInButton, SignOutButton } from "./AuthButtons";

export default async function Header() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    let avatarUrl: string | null = null;
    if (user) {
        const { data } = await supabase
            .from("profiles")
            .select("avatar_url")
            .eq("id", user.id)
            .single();
        avatarUrl = data?.avatar_url ?? null;
    }

    return (
        <header className="flex items-center justify-between p-4 border-b">
            <Link href="/" className="font-bold">
                Humor Project
            </Link>
            {user ? (
                <nav className="flex items-center gap-4">
                    <Link href="/members">Members</Link>
                    <Link href="/profile">Profile</Link>
                    {avatarUrl && (
                        <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                    )}
                    <SignOutButton />
                </nav>
            ) : (
                <SignInButton />
            )}
        </header>
    );
}
