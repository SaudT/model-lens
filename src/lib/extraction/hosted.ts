import { INVOICE_FIELDS } from "./dataset";
import { INSTRUCTIONS, EXAMPLE } from "./prompt";
import { estimatedCost, isHosted, resolveCandidate } from "./models";
import { STRATEGIES, type Generation, type Strategy } from "./experiment";

export const HOSTED_SCHEMA = { type: "object", additionalProperties: false, required: [...INVOICE_FIELDS], properties: Object.fromEntries(INVOICE_FIELDS.map(field => [field, { type: [field === "total" ? "number" : "string", "null"] }])) };
export type HostedMetadata = { provider: string; requestedModel: string; actualModel: string; adapterVersion: "hosted-v1"; outputBudget: number; temperature: number | null; seed: null; reasoning: string | null; estimatedCostUsd: number | null; priceSource: string | null; priceChecked: string | null };
function count(value: unknown): number | null { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null; }
function providerError(status: number): string {
  if (status === 401 || status === 403) return "Provider rejected the key or model access. Check your key permissions and account access.";
  if (status === 429) return "Provider quota or rate limit reached. No retry or paid fallback was attempted.";
  if (status === 400 || status === 404 || status === 422) return "Provider rejected the model or settings. Verify the model ID and try Instructions only if structured output is unsupported.";
  return `Provider request failed (HTTP ${status}). No retry was attempted.`;
}

/** No provider error bodies or caught exception messages are returned: either can contain credentials. */
export async function runHosted(candidateId: string, text: string, strategy: Strategy, apiKey: string, fetcher: typeof fetch = fetch): Promise<Generation> {
  const started = performance.now();
  const failure = (error: string): Generation => ({ response: "", latencyMs: Math.round(performance.now()-started), inputTokens: null, outputTokens: null, complete: false, finishReason: "error", modelDigest: null, error });
  const candidate = resolveCandidate(candidateId);
  if (!candidate || !isHosted(candidate.provider) || !candidate.model || typeof text !== "string" || text.length > 20_000 || !STRATEGIES.includes(strategy) || typeof apiKey !== "string" || !apiKey.trim() || apiKey.length > 512 || /[\r\n]/.test(apiKey)) return failure("Invalid provider, model, key, or request settings.");
  const model = candidate.model;
  const custom = candidate.id.startsWith("custom:");
  const user = (strategy === "few-shot" ? EXAMPLE + "\n\n" : "") + "Invoice document:\n" + text;
  let url: string;
  let headers: Record<string,string>;
  let body: Record<string, unknown>;
  if (candidate.provider === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    headers = { Authorization: `Bearer ${apiKey.trim()}` };
    body = { model, store: false, max_completion_tokens: 512, messages: [{ role: "system", content: INSTRUCTIONS }, { role: "user", content: user }], ...(!custom ? { reasoning_effort: "none" } : {}), ...(strategy === "schema" ? { response_format: { type: "json_schema", json_schema: { name: "invoice", strict: true, schema: HOSTED_SCHEMA } } } : {}) };
  } else if (candidate.provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers = { "x-api-key": apiKey.trim(), "anthropic-version": "2023-06-01" };
    body = { model, max_tokens: 512, system: INSTRUCTIONS, messages: [{ role: "user", content: user }], ...(!custom ? { temperature: 0 } : {}), ...(strategy === "schema" ? { output_config: { format: { type: "json_schema", schema: HOSTED_SCHEMA } } } : {}) };
  } else {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    headers = { "x-goog-api-key": apiKey.trim() };
    body = { systemInstruction: { parts: [{ text: INSTRUCTIONS }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { maxOutputTokens: 512, ...(!custom ? { temperature: 0, thinkingConfig: { thinkingBudget: 0 } } : {}), ...(strategy === "schema" ? { responseMimeType: "application/json", responseJsonSchema: HOSTED_SCHEMA } : {}) } };
  }
  try {
    const res = await fetcher(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(25_000), cache: "no-store", redirect: "error" });
    if (!res.ok) return failure(providerError(res.status));
    // Parse only fields needed for grading/accounting; never persist headers, keys or request bodies.
    const data = await res.json();
    let response = ""; let input: number | null = null; let output: number | null = null; let reason = "unknown"; let actual = model;
    if (candidate.provider === "openai") {
      const choice = data.choices?.[0];
      response = typeof choice?.message?.content === "string" ? choice.message.content : "";
      reason = choice?.message?.refusal ? "refusal" : choice?.finish_reason ?? "unknown";
      input = count(data.usage?.prompt_tokens); output = count(data.usage?.completion_tokens); actual = typeof data.model === "string" ? data.model : model;
    } else if (candidate.provider === "anthropic") {
      response = Array.isArray(data.content) ? data.content.filter((c: { type?: string; text?: string }) => c.type === "text" && typeof c.text === "string").map((c: { text: string }) => c.text).join("") : "";
      reason = data.stop_reason ?? "unknown";
      input = count(data.usage?.input_tokens); output = count(data.usage?.output_tokens); actual = typeof data.model === "string" ? data.model : model;
    } else {
      const choice = data.candidates?.[0];
      response = Array.isArray(choice?.content?.parts) ? choice.content.parts.filter((p: { text?: string; thought?: boolean }) => typeof p.text === "string" && !p.thought).map((p: { text: string }) => p.text).join("") : "";
      reason = choice?.finishReason ?? (data.promptFeedback?.blockReason ? "blocked" : "unknown");
      input = count(data.usageMetadata?.promptTokenCount);
      const candidates = count(data.usageMetadata?.candidatesTokenCount); const thoughts = count(data.usageMetadata?.thoughtsTokenCount);
      output = candidates === null ? null : candidates + (thoughts ?? 0); actual = typeof data.modelVersion === "string" ? data.modelVersion : model;
    }
    // A provider response should never contain the bearer credential. Do not save it if it does.
    if (response.includes(apiKey.trim()) || actual.includes(apiKey.trim()) || (typeof reason === "string" && reason.includes(apiKey.trim()))) return failure("Provider returned credential-like content; response was discarded.");
    const metadata: HostedMetadata = { provider: candidate.provider, requestedModel: model, actualModel: actual.slice(0,160), adapterVersion: "hosted-v1", outputBudget: 512, temperature: custom || candidate.provider === "openai" ? null : 0, seed: null, reasoning: custom ? null : candidate.provider === "openai" ? "none" : candidate.provider === "gemini" ? "thinkingBudget=0" : null, estimatedCostUsd: estimatedCost(candidate,input,output), priceSource: candidate.pricing?.url ?? null, priceChecked: candidate.pricing?.checked ?? null };
    return { response: response.slice(0,100_000), latencyMs: Math.round(performance.now()-started), inputTokens: input, outputTokens: output, complete: ["stop", "end_turn", "STOP"].includes(reason) && response.length > 0 && response.length <= 100_000, finishReason: typeof reason === "string" ? reason.slice(0,100) : "unknown", modelDigest: null, hosted: metadata };
  } catch {
    return failure("Provider connection failed or exceeded 25 seconds. No automatic retry was attempted; check provider usage before retrying.");
  }
}
