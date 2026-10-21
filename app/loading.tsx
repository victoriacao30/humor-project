import Window from "@/app/components/Window";

export default function Loading() {
    return (
        <Window url="loading…">
            <p className="label loading-pulse">Loading…</p>
            <div className="skeleton" />
            <div className="skeleton skeleton-short" />
        </Window>
    );
}
