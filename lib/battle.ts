const PROMPTS = [
    "Your most chaotic dining hall plate",
    "The weirdest thing you saw on the subway",
    "Your dorm room right now. No cleaning allowed",
    "Your study spot, honestly",
    "A pigeon living its best life",
    "Your outfit vs. today's NYC weather",
    "The view from exactly where you're sitting",
    "Your snack haul",
    "Something only a New Yorker would understand",
    "Your laptop desktop (be brave)",
    "Your weekend adventure in one photo",
    "The longest line you waited in this week",
    "Your 'I'm being productive' setup",
    "The best storefront sign you've seen",
];

function nyDate(offsetDays = 0) {
    return new Date(Date.now() + offsetDays * 86_400_000).toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
    });
}

export function promptFor(date: string) {
    const dayNumber = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
    return PROMPTS[dayNumber % PROMPTS.length];
}

export function getToday() {
    const date = nyDate(0);
    return { date, prompt: promptFor(date) };
}

export function getYesterday() {
    const date = nyDate(-1);
    return { date, prompt: promptFor(date) };
}
