export async function GET(request: Request) {
    const raw = new URL(request.url).searchParams.get("url") ?? "";
    let target: URL;
    try {
        target = new URL(raw);
    } catch {
        return new Response("Bad url", { status: 400 });
    }
    const allowed =
        target.protocol === "https:" &&
        (target.hostname.endsWith(".apple.com") || target.hostname.endsWith(".mzstatic.com"));
    if (!allowed) return new Response("Not allowed", { status: 400 });

    const res = await fetch(target);
    if (!res.ok || !res.body) return new Response("Preview unavailable", { status: 502 });

    return new Response(res.body, {
        headers: {
            "Content-Type": res.headers.get("content-type") ?? "audio/mp4",
            "Cache-Control": "public, max-age=86400",
        },
    });
}
