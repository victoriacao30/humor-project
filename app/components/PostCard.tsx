export default function PostCard({
                                     screenshot,
                                     selfie,
                                     caption,
                                     late = false,
                                     size = "lg",
                                 }: {
    screenshot: string;
    selfie: string;
    caption?: string;
    late?: boolean;
    size?: "sm" | "lg";
}) {
    return (
        <div className={`post post-${size}`}>
            <div className="post-media">
                <img src={screenshot} alt="Song screenshot" className="post-main" />
                <img src={selfie} alt="Selfie" className="post-selfie" />
                {late && <span className="late-tag">Late</span>}
            </div>
            {caption && <p className="caption-text">{caption}</p>}
        </div>
    );
}
