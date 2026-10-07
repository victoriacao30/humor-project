"use client";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase-browser";
import Window from "@/app/components/Window";

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
        <Window url="www.humorproject.com/hello" className="narrow">
            <h1 className="label title">Welcome! Who are you?</h1>
            <p className="hint">You&apos;ll need a name before exploring the site.</p>
            <form onSubmit={save} className="form">
                <label>
                    <span className="label">First name:</span>
                    <input className="field" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </label>
                <label>
                    <span className="label">Last name:</span>
                    <input className="field" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </label>
                {error && <p className="error">{error}</p>}
                <button className="btn btn-primary">Continue →</button>
            </form>
        </Window>
    );
}

