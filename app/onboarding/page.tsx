"use client";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function Onboarding() {
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [error, setError] = useState("");

    async function save(e: FormEvent) {
        e.preventDefault();
        if (!firstName.trim() || !lastName.trim()) {
            setError("Enter both your first and last name.");
            return;
        }
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from("profiles")
            .update({ first_name: firstName.trim(), last_name: lastName.trim() })
            .eq("id", user.id);
        if (error) {
            setError(error.message);
            return;
        }
        window.location.href = "/";
    }

    return (
        <main className="p-6 max-w-sm">
            <h1 className="text-xl font-bold mb-1">Welcome! What&apos;s your name?</h1>
            <p className="mb-4 opacity-70">You&apos;ll need this before using the site.</p>
            <form onSubmit={save} className="flex flex-col gap-3">
                <input
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="border rounded px-2 py-1 bg-transparent"
                />
                <input
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="border rounded px-2 py-1 bg-transparent"
                />
                {error && <p className="text-red-500">{error}</p>}
                <button className="border rounded px-3 py-1">Continue</button>
            </form>
        </main>
    );
}
