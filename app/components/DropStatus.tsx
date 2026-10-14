"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ON_TIME_MS } from "@/lib/battle";

function format(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h ? `${h}h ${m}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
}

export default function DropStatus({ dropAt }: { dropAt: number }) {
    const router = useRouter();
    const [now, setNow] = useState<number | null>(null);
    const startedBefore = useRef<boolean | null>(null);

    useEffect(() => {
        startedBefore.current = Date.now() < dropAt;
        setNow(Date.now());
        const timer = setInterval(() => {
            const t = Date.now();
            setNow(t);
            if (startedBefore.current && t >= dropAt) {
                startedBefore.current = false;
                router.refresh();
            }
        }, 1000);
        return () => clearInterval(timer);
    }, [dropAt, router]);

    if (now === null) return null;

    const dropTime = new Date(dropAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
    });

    if (now < dropAt) {
        return (
            <div className="drop">
                <p className="label">⏳ Waiting for today&apos;s drop…</p>
                <p className="hint">It&apos;s a surprise! Sometime between 10 AM and 10 PM. Keep checking 👀</p>
            </div>
        );
    }
    if (now < dropAt + ON_TIME_MS) {
        return (
            <div className="drop drop-live">
                <p className="label">🎵 It&apos;s time! Dropped at {dropTime}</p>
                <p>{format(dropAt + ON_TIME_MS - now)} left to post on time</p>
            </div>
        );
    }
    return (
        <div className="drop">
            <p className="label">Today&apos;s drop was at {dropTime}</p>
            <p className="hint">You can still post, but it&apos;ll be marked LATE.</p>
        </div>
    );
}
