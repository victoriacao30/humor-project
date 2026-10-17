import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import Window from "@/app/components/Window";
import PostCard from "@/app/components/PostCard";
import ShareButton from "@/app/components/ShareButton";
import { SignInButton } from "@/app/components/AuthButtons";

type SharedPost = {
    id: number;
    battle_date: string;
    meme_url: string;
    image_url: string;
    caption: string;
    song_title: string;
    song_artist: string;
    song_preview: string | null;
    snippet_start: number;
    first_name: string | null;
};

async function getPost(id: string) {
    if (!/^\d+$/.test(id)) return null;
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_post", { p_id: Number(id) });
    return ((data ?? []) as SharedPost[])[0] ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const { id } = await params;
    const post = await getPost(id);
    if (!post) return { title: "Post not found" };
    const title = `${post.first_name ?? "Someone"} is listening to ${post.song_title}`;
    const description = `“${post.caption}” · Vote on today's memes on Humor Project`;
    return {
        title,
        description,
        openGraph: { title, description, images: [post.meme_url] },
        twitter: { card: "summary_large_image", title, description, images: [post.meme_url] },
    };
}

export default async function SharedPostPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const post = await getPost(id);
    if (!post) notFound();

    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const day = new Date(`${post.battle_date}T12:00:00Z`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    });

    return (
        <Window url={`www.humorproject.com/p/${post.id}`} className="narrow">
            <p className="label">{post.first_name ?? "Someone"}&apos;s drop · {day}</p>
            <PostCard
                meme={post.meme_url}
                cover={post.image_url}
                caption={post.caption}
                song={{ title: post.song_title, artist: post.song_artist, preview: post.song_preview, start: post.snippet_start }}
            />
            <div className="actions">
                <ShareButton id={post.id} />
                {user ? (
                    <Link href="/" className="btn btn-primary">Join today&apos;s battle →</Link>
                ) : (
                    <SignInButton />
                )}
            </div>
            {!user && (
                <p className="hint share-hint">Sign in to post your own song + AI meme and vote on everyone else&apos;s.</p>
            )}
        </Window>
    );
}
