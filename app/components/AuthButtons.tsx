"use client";
import { createClient } from "@/lib/supabase-browser";

export function SignInButton() {
    return (
        <button
            className="border rounded px-3 py-1"
            onClick={() =>
                createClient().auth.signInWithOAuth({
                    provider: "google",
                    options: { redirectTo: `${window.location.origin}/auth/callback` },
                })
            }
        >
            Sign in with Google
        </button>
    );
}

export function SignOutButton() {
    return (
        <button
            className="border rounded px-3 py-1"
            onClick={async () => {
                await createClient().auth.signOut();
                window.location.href = "/";
            }}
        >
            Sign out
        </button>
    );
}
