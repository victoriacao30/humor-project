export function addDays(date: string, n: number) {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

// The Monday that starts the week containing this date.
export function mondayOf(date: string) {
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
    return addDays(date, -((dayOfWeek + 6) % 7));
}

export function weekLabel(weekStart: string) {
    const fmt = (d: string) =>
        new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return `${fmt(weekStart)} – ${fmt(addDays(weekStart, 6))}`;
}
