import type { ReactNode } from "react";

export default function Window({
                                   url,
                                   children,
                                   className = "",
                               }: {
    url: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={`window ${className}`}>
            <div className="window-bar" aria-hidden="true">
                <span className="hide-sm">←</span>
                <span className="hide-sm">→</span>
                <span className="hide-sm">↻</span>
                <div className="url">
                    <span>{url}</span>
                    <span>☆</span>
                </div>
                <span>–</span>
                <span className="hide-sm">❐</span>
                <span>✕</span>
            </div>
            <div className="window-body">{children}</div>
        </section>
    );
}
