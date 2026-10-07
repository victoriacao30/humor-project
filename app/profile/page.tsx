"use client";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function Profile() {
    const router = useRouter();
    const [supabase] = useState(() => createClient());
    const [userId, setUserId] = useState<string | null>(null);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [registeredAt, setRegisteredAt] = useState<string | null>(null);
    const [status, setStatus] = useState("");

    useEffect(() => {
        (async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            setUserId(user.id);
            const { data } = await supabase
                .from("profiles")
                .select("first_name, last_name, avatar_url, registered_at")
                .eq("id", user.id)
                .single();
            if (data) {
                setFirstName(data.first_name ?? "");
                setLastName(data.last_name ?? "");
                setAvatarUrl(data.avatar_url);
                setRegisteredAt(data.registered_at);
            }
        })();
    }, [supabase]);

    async function saveNames(e: FormEvent) {
        e.preventDefault();
        if (!userId) return;
        if (!firstName.trim() || !lastName.trim()) {
            setStatus("First and last name can't be empty.");
            return;
        }
        const { error } = await supabase
            .from("profiles")
            .update({ first_name: firstName.trim(), last_name: lastName.trim() })
            .eq("id", userId);
        setStatus(error ? error.message : "Saved");
    }

    async function uploadPhoto(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !userId) return;
        setStatus("Uploading…");

        const ext = file.name.split(".").pop();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(path, file);
        if (uploadError) {
            setStatus(uploadError.message);
            return;
        }

        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        const { error } = await supabase
            .from("profiles")
            .update({ avatar_url: data.publicUrl })
            .eq("id", userId);
        if (error) {
            setStatus(error.message);
            return;
        }
        setAvatarUrl(data.publicUrl);
        setStatus("Photo updated");
        router.refresh();
    }

    return (
        <main className="p-6 max-w-sm">
            <h1 className="text-xl font-bold mb-4">Your profile</h1>

            <div className="flex items-center gap-4 mb-6">
                {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile photo" className="w-20 h-20 rounded-full object-cover" />
                ) : (
                    <div className="w-20 h-20 rounded-full border flex items-center justify-center opacity-60">
                        No photo
                    </div>
                )}
                <label className="border rounded px-3 py-1 cursor-pointer">
                    Upload photo
                    <input type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
                </label>
            </div>

            <form onSubmit={saveNames} className="flex flex-col gap-3">
                <label>
                    First name
                    <input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="border rounded px-2 py-1 bg-transparent w-full"
                    />
                </label>
                <label>
                    Last name
                    <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="border rounded px-2 py-1 bg-transparent w-full"
                    />
                </label>
                <button className="border rounded px-3 py-1">Save changes</button>
            </form>

            {status && <p className="mt-3">{status}</p>}
            {registeredAt && (
                <p className="mt-6 opacity-60 text-sm">
                    Member since {new Date(registeredAt).toLocaleDateString()}
                </p>
            )}
        </main>
    );
}

