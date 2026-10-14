"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { getToday } from "@/lib/battle";
import Window from "@/app/components/Window";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const pad = (n: number) => String(n).padStart(2, "0");

type Post = { image_url: string; selfie_url: string; caption: string };
type Winner = Post & { name: string };
type Score = { entry_id: number; wins: number; matchups: number };

function prettyDate(date: string) {
    return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    });
}

export default function PostCalendar({ userId }: { userId: string }) {
    const [supabase] = useState(() => createClient());
    const [today] = useState(() => getToday().date);
    const [month, setMonth] = useState(() => {
        const [y, m] = today.split("-").map(Number);
        return { y, m };
    });
    const [posts, setPosts] = useState<Map<string, Post>>(new Map());
    const [wins, setWins] = useState<Set<string>>(new Set());
    const [selected, setSelected] = useState<string | null>(null);
    const [winner, setWinner] = useState<Winner | null | undefined>(undefined);
    const detailRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.rpc("winning_dates", { p_user: userId });
            setWins(new Set(((data ?? []) as { battle_date: string }[]).map((d) => d.battle_date)));
        })();
    }, [supabase, userId]);

    useEffect(() => {
        (async () => {
            const lastDay = new Date(Date.UTC(month.y, month.m, 0)).getUTCDate();
            const { data } = await supabase
                .from("entries")
                .select("battle_date, image_url, selfie_url, caption")
                .eq("user_id", userId)
                .gte("battle_date", `${month.y}-${pad(month.m)}-01`)
                .lte("battle_date", `${month.y}-${pad(month.m)}-${pad(lastDay)}`);
            setPosts(
                new Map(
                    (data ?? []).map((d) => [
                        d.battle_date,
                        { image_url: d.image_url, selfie_url: d.selfie_url, caption: d.caption },
                    ])
                )
            );
        })();
    }, [supabase, userId, month]);

    async function loadWinner(date: string) {
        setWinner(undefined);
        const [{ data: rows }, { data: scores }] = await Promise.all([
            supabase.from("entries").select("id, user_id, image_url, selfie_url, caption").eq("battle_date", date),
            supabase.rpc("battle_scores", { d: date }),
        ]);
        const scoreMap = new Map(((scores ?? []) as Score[]).map((s) => [s.entry_id, s]));
        const top = (rows ?? [])
            .map((e) => {
                const s = scoreMap.get(e.id);
                const wins = Number(s?.wins ?? 0);
                const matchups = Number(s?.matchups ?? 0);
                return { ...e, wins, matchups, rate: matchups ? wins / matchups : 0 };
            })
            .filter((e) => e.matchups > 0)
            .sort((a, b) => b.rate - a.rate || b.wins - a.wins)[0];

        if (!top) {
            setWinner(null);
            return;
        }
        const { data: person } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", top.user_id)
            .maybeSingle();
        setWinner({
            image_url: top.image_url,
            selfie_url: top.selfie_url,
            caption: top.caption,
            name: person?.first_name ?? "Someone",
        });
    }

    function openDay(date: string) {
        if (selected === date) {
            setSelected(null);
            return;
        }
        setSelected(date);
        if (date !== today && !wins.has(date)) loadWinner(date);
    }

    useEffect(() => {
        if (selected) detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [selected]);

    function shift(delta: number) {
        setSelected(null);
        setMonth(({ y, m }) => {
            const next = m + delta;
            if (next < 1) return { y: y - 1, m: 12 };
            if (next > 12) return { y: y + 1, m: 1 };
            return { y, m: next };
        });
    }

    const lastDay = new Date(Date.UTC(month.y, month.m, 0)).getUTCDate();
    const leadingBlanks = new Date(Date.UTC(month.y, month.m - 1, 1)).getUTCDay();
    const monthWins = [...wins].filter((d) => d.startsWith(`${month.y}-${pad(month.m)}`)).length;
    const post = selected ? posts.get(selected) : undefined;

    return (
        <Window url="www.humorproject.com/profile/calendar">
            <div className="cal-head">
                <button className="btn btn-sm" onClick={() => shift(-1)} aria-label="Previous month">←</button>
                <h2 className="label title cal-title">{MONTHS[month.m - 1]} {month.y}</h2>
                <button className="btn btn-sm" onClick={() => shift(1)} aria-label="Next month">→</button>
            </div>

            <div className="cal-grid">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <span key={i} className="cal-dow">{d}</span>
                ))}
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                    <span key={`blank-${i}`} />
                ))}
                {Array.from({ length: lastDay }).map((_, i) => {
                    const date = `${month.y}-${pad(month.m)}-${pad(i + 1)}`;
                    const dayPost = posts.get(date);
                    const classes = `cal-day${date === today ? " cal-today" : ""}${date === selected ? " cal-selected" : ""}`;
                    return dayPost ? (
                        <button key={date} className={`${classes} cal-day-btn`} onClick={() => openDay(date)} aria-label={`See your post from ${prettyDate(date)}`}>
                            <img src={dayPost.image_url} alt="" />
                            {wins.has(date) && <span className="cal-crown" aria-label="Won this day">👑</span>}
                        </button>
                    ) : (
                        <div key={date} className={classes}>{i + 1}</div>
                    );
                })}
            </div>

            <p className="cal-stats">
                🎵 {posts.size} {posts.size === 1 ? "day" : "days"} posted · 👑 {monthWins} {monthWins === 1 ? "win" : "wins"} this month
            </p>

            {selected && post && (
                <div className="cal-detail" ref={detailRef}>
                    <p className="label">{prettyDate(selected)}</p>
                    <div className="pair-photos">
                        <img src={post.image_url} alt="Your song screenshot" />
                        <img src={post.selfie_url} alt="Your selfie" />
                    </div>
                    <div className="frame caption-box">
                        <p className="caption-text">{post.caption}</p>
                    </div>

                    {selected === today ? (
                        <p className="hint">Voting is still open. Winner announced tomorrow!</p>
                    ) : wins.has(selected) ? (
                        <p className="label win-banner">👑 You won this day!</p>
                    ) : winner === undefined ? (
                        <p className="status">Loading the winner…</p>
                    ) : winner === null ? (
                        <p className="hint">Nobody voted that day, so there was no winner.</p>
                    ) : (
                        <div className="cal-winner">
                            <p className="label">Winner that day: {winner.name} 👑</p>
                            <div className="pair-photos">
                                <img src={winner.image_url} alt={`${winner.name}'s song screenshot`} />
                                <img src={winner.selfie_url} alt={`${winner.name}'s selfie`} />
                            </div>
                            <div className="frame caption-box">
                                <p className="caption-text">{winner.caption}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Window>
    );
}
