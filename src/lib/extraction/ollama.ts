import { INVOICE_SCHEMA } from "./dataset";
import { CANDIDATES, type CandidateId, type Generation, type Strategy, STRATEGIES } from "./experiment";

import { INSTRUCTIONS, EXAMPLE } from "./prompt";

export async function runOllama(candidate: CandidateId, text: string, strategy: Strategy, fetcher: typeof fetch = fetch): Promise<Generation> {
  if (candidate === "baseline" || !CANDIDATES.some(c => c.id === candidate && c.provider === "ollama") || typeof text !== "string" || text.length > 20_000 || !STRATEGIES.includes(strategy)) throw new Error("Invalid local model request");
  const started = performance.now();
  const signal = AbortSignal.timeout(90_000);
  const tags = await fetcher("http://127.0.0.1:11434/api/tags", { signal, cache: "no-store" });
  if (!tags.ok) throw new Error("Cannot list local Ollama models");
  const installed = await tags.json() as { models?: { name: string; digest: string }[] };
  const model = installed.models?.find(m => m.name === candidate);
  if (!model?.digest) throw new Error(`Install ${candidate} first: ollama pull ${candidate}`);
  const response = await fetcher("http://127.0.0.1:11434/api/chat", {
    method: "POST", signal, cache: "no-store", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: candidate, stream: false,
      messages: [{ role: "system", content: INSTRUCTIONS }, { role: "user", content: (strategy === "few-shot" ? EXAMPLE + "\n\n" : "") + "Invoice document:\n" + text }],
      ...(strategy === "schema" ? { format: INVOICE_SCHEMA } : {}),
      options: { temperature: 0, seed: 42, num_predict: 512, num_ctx: 4096 },
    }),
  });
  if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}`);
  const data = await response.json() as { message?: { content?: string }; done?: boolean; done_reason?: string; prompt_eval_count?: number; eval_count?: number; error?: string };
  if (data.error || typeof data.message?.content !== "string") throw new Error("Ollama returned an invalid generation");
  return { response: data.message.content, latencyMs: Math.round(performance.now() - started), inputTokens: data.prompt_eval_count ?? null, outputTokens: data.eval_count ?? null, complete: data.done === true && data.done_reason === "stop", finishReason: data.done_reason ?? "unknown", modelDigest: model.digest };
}
