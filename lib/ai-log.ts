import type { createClient } from "@/lib/supabase-server";
import type { Attempt } from "@/lib/gemini";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadAiConfig(supabase: Supabase, chainSlug: string) {
    const [{ data: models }, { data: terms }, { data: examples }, { data: chain }] = await Promise.all([
        supabase.from("llm_models").select("model_name").eq("is_active", true).order("priority"),
        supabase.from("terms").select("term, meaning").eq("is_active", true),
        supabase.from("ai_generation_examples").select("song, moment, template_name, meme_text").eq("is_active", true).limit(5),
        supabase.from("prompt_chains").select("id").eq("slug", chainSlug).maybeSingle(),
    ]);

    let enabled = true;
    if (chain) {
        const { data: mix } = await supabase.from("prompt_chain_mix").select("is_enabled").eq("chain_id", chain.id).maybeSingle();
        enabled = mix?.is_enabled ?? true;
    }

    return {
        enabled,
        models: (models ?? []).map((m) => m.model_name as string),
        terms: (terms ?? []) as { term: string; meaning: string }[],
        examples: (examples ?? []) as { song: string; moment: string; template_name: string | null; meme_text: string }[],
    };
}

export async function startRequest(
    supabase: Supabase,
    userId: string,
    chainSlug: string,
    input: Record<string, unknown>
) {
    const { data, error } = await supabase
        .from("generation_requests")
        .insert({ user_id: userId, chain_slug: chainSlug, input })
        .select("id")
        .single();
    if (error) console.error("Couldn't log request:", error.message);
    return data?.id as number | undefined;
}

export async function logResponse(supabase: Supabase, requestId: number | undefined, a: Attempt) {
    if (!requestId) return;
    const { error } = await supabase.from("llm_responses").insert({
        request_id: requestId,
        model_name: a.model,
        prompt: a.prompt,
        response_text: a.ok ? a.text : a.error,
        latency_ms: a.latencyMs,
        succeeded: a.ok,
    });
    if (error) console.error("Couldn't log response:", error.message);
}

export async function finishRequest(
    supabase: Supabase,
    requestId: number | undefined,
    startedAt: number,
    status: "succeeded" | "failed",
    error?: string
) {
    if (!requestId) return;
    await supabase
        .from("generation_requests")
        .update({ status, error: error ?? null, duration_ms: Date.now() - startedAt })
        .eq("id", requestId);
}
