import { NextResponse } from "next/server";

type ItunesTrack = {
    trackId: number;
    trackName?: string;
    artistName?: string;
    artworkUrl100?: string;
    previewUrl?: string;
};

export async function GET(request: Request) {
    const q = new URL(request.url).searchParams.get("q")?.trim();
    if (!q) return NextResponse.json({ songs: [] });

    const params = new URLSearchParams({ term: q, media: "music", entity: "song", limit: "10", country: "US" });
    try {
        const res = await fetch(`https://itunes.apple.com/search?${params}`);
        if (!res.ok) throw new Error(`iTunes ${res.status}`);
        const data = await res.json();
        const songs = ((data.results ?? []) as ItunesTrack[])
            .filter((r) => r.trackName && r.artistName && r.artworkUrl100)
            .map((r) => ({
                id: r.trackId,
                title: r.trackName!,
                artist: r.artistName!,
                cover: r.artworkUrl100!.replace("100x100bb", "600x600bb"),
                preview: r.previewUrl ?? null,
            }));
        return NextResponse.json({ songs });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Song search is down. Try again." }, { status: 502 });
    }
}
