import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: jokes, error } = await supabase
      .from("jokes")
      .select("*")
      .order("id");

  if (error) return <p>Error: {error.message}</p>;

  return (
      <main style={{ padding: 24 }}>
        <h1>Jokes</h1>
        <ul>
          {jokes?.map((joke) => (
              <li key={joke.id} style={{ marginBottom: 12 }}>
                <strong>{joke.setup}</strong>
                <br />
                {joke.punchline}
              </li>
          ))}
        </ul>
      </main>
  );
}
