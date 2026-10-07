"use client";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Window from "@/app/components/Window";

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
        setStatus(error ? error.message : "Saved!");
    }

    async function uploadPhoto(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !userId) return;
        setStatus("Uploading…");

        const ext = file.name.split(".").pop();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file);
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
        setStatus("Photo updated!");
        router.refresh();
    }

    return (
        <Window url="www.humorproject.com/profile">
            <div className="profile-grid">
                <form onSubmit={saveNames} className="form">
                    <h1 className="label title">About me:</h1>
                    <label>
                        <span className="label">First name:</span>
                        <input className="field" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                    </label>
                    <label>
                        <span className="label">Last name:</span>
                        <input className="field" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                    </label>
                    <button className="btn btn-primary">Save changes</button>
                    {status && <p className="status">{status}</p>}
                    {registeredAt && (
                        <p className="hint">Member since {new Date(registeredAt).toLocaleDateString()}</p>
                    )}
                </form>

                <div className="photo-col">
                    <div className="frame photo">
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Profile photo" />
                        ) : (
                            <span className="photo-empty">No photo yet</span>
                        )}
                    </div>
                    <label className="btn">
                        Upload photo
                        <input
                            type="file"
                            accept="image/png, image/jpeg, image/webp, image/gif"
                            onChange={uploadPhoto}
                            hidden
                        />
                    </label>
                </div>
            </div>
        </Window>
    );
}

