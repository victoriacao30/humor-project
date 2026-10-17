"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";

// Only one snippet plays at a time across the whole page.
let nowPlaying: { id: symbol; stop: () => void } | null = null;

export default function SnippetButton({
                                          src,
                                          start = 0,
                                          length = 15,
                                          label = "",
                                          preload = false,
                                      }: {
    src: string;
    start?: number;
    length?: number;
    label?: string;
    preload?: boolean;
}) {
    const id = useRef(Symbol("snippet"));
    const audio = useRef<HTMLAudioElement | null>(null);
    const audioSrc = useRef<string | null>(null);
    const blobUrl = useRef<string | null>(null);
    const startRef = useRef(start);
    const [playing, setPlaying] = useState(false);
    startRef.current = start;

    // Download the 30-second clip once so we can jump to any spot in it.
    useEffect(() => {
        let cancelled = false;
        if (preload) {
            fetch(`/api/preview?url=${encodeURIComponent(src)}`)
                .then((r) => (r.ok ? r.blob() : null))
                .then((b) => {
                    if (b && !cancelled) blobUrl.current = URL.createObjectURL(b);
                })
                .catch(() => {});
        }
        return () => {
            cancelled = true;
            audio.current?.pause();
            audio.current = null;
            audioSrc.current = null;
            if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
            blobUrl.current = null;
        };
    }, [src, preload]);

    // Moving the slider while it plays jumps to the new spot.
    useEffect(() => {
        if (playing && audio.current) audio.current.currentTime = start;
    }, [start, playing]);

    function stop() {
        audio.current?.pause();
        setPlaying(false);
    }

    function toggle(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (playing) {
            stop();
            nowPlaying = null;
            return;
        }
        if (nowPlaying && nowPlaying.id !== id.current) nowPlaying.stop();

        const wanted = blobUrl.current ?? src;
        if (!audio.current || audioSrc.current !== wanted) {
            audio.current?.pause();
            const a = new Audio(wanted);
            a.addEventListener("timeupdate", () => {
                if (a.currentTime >= startRef.current + length) {
                    a.pause();
                    setPlaying(false);
                }
            });
            a.addEventListener("ended", () => setPlaying(false));
            audio.current = a;
            audioSrc.current = wanted;
        }

        const a = audio.current;
        const seek = () => {
            a.currentTime = startRef.current;
        };
        if (a.readyState >= 1) seek();
        else a.addEventListener("loadedmetadata", seek, { once: true });

        a.play()
            .then(() => setPlaying(true))
            .catch(() => setPlaying(false));
        nowPlaying = { id: id.current, stop };
    }

    return (
        <button
            type="button"
            className="btn btn-sm snippet-btn"
            onClick={toggle}
            aria-label={playing ? "Pause snippet" : "Play snippet"}
        >
            {playing ? "❚❚" : "▶"}
            {label && <span>{label}</span>}
        </button>
    );
}
