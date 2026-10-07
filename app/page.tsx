import { supabase } from "@/lib/supabase";
import Window from "@/app/components/Window";

export const dynamic = "force-dynamic";

export default async function Home() {
    const { data: jokes, error } = await supabase
        .from("jokes")
        .select("*")
        .order("id");

    return (
        <Window url="www.humorproject.com/jokes">
            <h1 className="label title">Today&apos;s jokes:</h1>
            {error ? (
                <p className="error">Couldn&apos;t load jokes: {error.message}</p>
            ) : (
                <ul className="stack">
                    {jokes?.map((joke) => (
                        <li key={joke.id} className="frame joke">
                            <p className="joke-setup">{joke.setup}</p>
                            <p className="joke-punch">{joke.punchline}</p>
                        </li>
                    ))}
                </ul>
            )}
        </Window>
    );
}

