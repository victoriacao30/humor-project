import SnippetButton from "./SnippetButton";

export default function PostCard({
                                     meme,
                                     cover,
                                     caption,
                                     name,
                                     late = false,
                                     size = "lg",
                                     song,
                                 }: {
    meme: string;
    cover?: string;
    caption?: string;
    name?: string;
    late?: boolean;
    size?: "sm" | "lg";
    song?: { title: string; artist: string; preview?: string | null; start?: number };
}) {
    if (size === "sm") {
        return (
            <div className="post post-sm">
                <div className="post-media">
                    <img src={meme} alt="AI meme" className="post-main" />
                    {late && <span className="late-tag">Late</span>}
                </div>
            </div>
        );
    }

    return (
        <div className="post post-lg">
            <div className="post-media">
                <img src={meme} alt={caption ? `AI meme about: ${caption}` : "AI meme"} className="post-meme" />
                {late && <span className="late-tag">Late</span>}
            </div>
            {song && (
                <div className="post-song">
                    {cover && <img src={cover} alt="" className="post-cover" />}
                    <div className="song-meta">
                        <p className="song-title">♫ {song.title}</p>
                        <p className="song-artist">{song.artist}</p>
                    </div>
                    {song.preview && (
                        <SnippetButton src={song.preview} start={song.start ?? 0} preload={(song.start ?? 0) > 0} />
                    )}
                </div>
            )}
            {caption && (
                <p className="post-caption">
                    “{caption}”{name && <span className="leader-meta"> by {name}</span>}
                </p>
            )}
        </div>
    );
}
