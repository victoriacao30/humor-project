"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function GroupActions({ groupId, inviteCode }: { groupId: number; inviteCode: string }) {
    const router = useRouter();
    const [copied, setCopied] = useState(false);

    async function copy() {
        await navigator.clipboard.writeText(inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    async function leave() {
        if (!confirm("Leave this group? You can rejoin later with the invite code.")) return;
        const supabase = createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
        router.push("/groups");
        router.refresh();
    }

    return (
        <div className="frame invite-box">
            <span className="label">Invite code:</span>
            <span className="invite-code">{inviteCode}</span>
            <button type="button" className="btn btn-sm" onClick={copy}>{copied ? "Copied ✓" : "Copy"}</button>
            <button type="button" className="btn btn-sm leave-btn" onClick={leave}>Leave group</button>
        </div>
    );
}