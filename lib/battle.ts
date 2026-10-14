export const DAILY_PROMPT = "What are you listening to right now?";
export const ON_TIME_MS = 2 * 60 * 60 * 1000;

function nyDate(offsetDays = 0) {
    return new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
    });
}

function dayNumber(date: string) {
    return Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
}

function nyOffsetHours(date: string) {
    const label =
        new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", timeZoneName: "shortOffset" })
            .formatToParts(new Date(`${date}T12:00:00Z`))
            .find((p) => p.type === "timeZoneName")?.value ?? "GMT-5";
    return Number(label.replace("GMT", "")) || 0;
}

// A surprise time between 10 AM and 10 PM New York time, different every day.
export function dropTimeFor(date: string) {
    if (process.env.NEXT_PUBLIC_DROP_NOW === "true" && date === nyDate(0)) {
        return Date.now() - 10 * 60 * 1000;
    }
    const random = Math.abs(Math.sin(dayNumber(date) * 12.9898) * 43758.5453) % 1;
    const nyMinutes = 600 + Math.floor(random * 720);
    return Date.parse(`${date}T00:00:00Z`) + (nyMinutes - nyOffsetHours(date) * 60) * 60_000;
}

export function getToday() {
    const date = nyDate(0);
    return { date, prompt: DAILY_PROMPT, dropAt: dropTimeFor(date) };
}

export function getYesterday() {
    return { date: nyDate(-1) };
}

export function isLate(createdAt: string, date: string) {
    return new Date(createdAt).getTime() > dropTimeFor(date) + ON_TIME_MS;
}
