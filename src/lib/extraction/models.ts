import type { Provider } from "../api-keys";
import { INVOICE_CASES } from "./dataset";
import { INSTRUCTIONS, EXAMPLE } from "./prompt";

export type Candidate = { id: string; label: string; provider: "browser" | "ollama" | Provider; model?: string; pricing?: { input: number; output: number; url: string; checked: string } };
export const CANDIDATES: readonly Candidate[] = [
  { id: "baseline", label: "Rules baseline", provider: "browser" },
  { id: "llama3.2:3b", label: "Llama 3.2 · 3B", provider: "ollama" },
  { id: "qwen2.5:3b", label: "Qwen 2.5 · 3B", provider: "ollama" },
  { id: "gemma2:9b", label: "Gemma 2 · 9B", provider: "ollama" },
  { id: "openai:gpt-5.6-terra", label: "GPT-5.6 Terra", provider: "openai", model: "gpt-5.6-terra", pricing: { input: 2, output: 12, url: "https://developers.openai.com/api/docs/models/gpt-5.6-terra", checked: "2026-10-29" } },
  { id: "anthropic:claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic", model: "claude-haiku-4-5", pricing: { input: 1, output: 5, url: "https://platform.claude.com/docs/en/about-claude/pricing", checked: "2026-10-29" } },
  { id: "gemini:gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", model: "gemini-2.5-flash", pricing: { input: .3, output: 2.5, url: "https://ai.google.dev/gemini-api/docs/pricing", checked: "2026-10-29" } },
];
export function isHosted(provider: string): provider is Provider { return ["openai", "anthropic", "gemini"].includes(provider); }
export function resolveCandidate(id: string): Candidate | undefined {
  if (typeof id !== "string") return undefined;
  const known = CANDIDATES.find(c => c.id === id);
  if (known) return known;
  const match = /^custom:(openai|anthropic|gemini):([a-zA-Z0-9][a-zA-Z0-9._:-]{0,119})$/.exec(id);
  if (!match || /^(sk-|AIza)/.test(match[2])) return undefined;
  return { id, label: match[2], provider: match[1] as Provider, model: match[2] };
}
export function customCandidate(provider: Provider, model: string): string {
  const id = `custom:${provider}:${model.trim()}`;
  if (!resolveCandidate(id)) throw new Error("Use a model ID (letters, numbers, dots, dashes, underscores, colons), not a URL. Maximum 120 characters.");
  return id;
}
export function estimatedCost(candidate: Candidate, input: number | null, output: number | null): number | null {
  if (!isHosted(candidate.provider)) return 0;
  if (!candidate.pricing || input === null || output === null) return null;
  return (input * candidate.pricing.input + output * candidate.pricing.output) / 1_000_000;
}
/** Planning estimate only: approximate input tokens plus a full 512-token output. */
export function planCost(ids: string[], strategy: string, repeats: number): { usd: number; unknown: boolean } {
  let usd = 0; let unknown = false;
  for (const id of ids) {
    const candidate = resolveCandidate(id);
    if (!candidate) { unknown = true; continue; }
    if (!isHosted(candidate.provider)) continue;
    if (!candidate.pricing) { unknown = true; continue; }
    for (const item of INVOICE_CASES) {
      const input = Math.ceil((INSTRUCTIONS.length + item.text.length + (strategy === "few-shot" ? EXAMPLE.length : 0)) / 4) + 256;
      usd += estimatedCost(candidate, input, 512)! * repeats;
    }
  }
  return { usd, unknown };
}
