"use client";
import { useState } from "react";

export default function ShareButton({ id, label = "Share" }: { id: number; label?: string }) {
    const [copied, setCopied] = useState(false);

    async function share() {
        const url = `${window.location.origin}/p/${id}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: "My song + meme on Humor Project", url });
                return;
            } catch (e) {
                if (e instanceof DOMException && e.name === "AbortError") return;
            }
        }
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    return (
        <button type="button" className="btn" onClick={share}>
            {copied ? "Link copied! ✓" : `↗ ${label}`}
        </button>
    );
}
