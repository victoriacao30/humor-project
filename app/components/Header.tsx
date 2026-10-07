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
        <header className="topbar">
            <Link href="/" className="logo">☁ Humor Project</Link>
            {user ? (
                <nav className="topbar-nav">
                    <Link href="/vote" className="btn btn-sm">Vote</Link>
                    <Link href="/members" className="btn btn-sm">Members</Link>
                    <Link href="/profile" className="btn btn-sm">Profile</Link>
                    {avatarUrl && <img src={avatarUrl} alt="" className="avatar" />}
                    <SignOutButton />
                </nav>
            ) : (
                <SignInButton />
            )}
        </header>
    );
}

