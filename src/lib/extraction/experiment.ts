import { DATASET_VERSION, INVOICE_CASES, PROMPT_VERSION, SCORER_VERSION, type InvoiceCase } from "./dataset";
import { scoreInvoice, type Verdict } from "./scoring";

import { resolveCandidate, estimatedCost } from "./models";
import type { HostedMetadata } from "./hosted";
export { CANDIDATES } from "./models";
export type CandidateId = string;
export const STRATEGIES = ["plain", "few-shot", "schema"] as const;
export type Strategy = (typeof STRATEGIES)[number];
export type Generation = { response: string; latencyMs: number; inputTokens: number | null; outputTokens: number | null; complete: boolean; finishReason: string; modelDigest: string | null; hosted?: HostedMetadata; error?: string };
export type ExtractionRow = Generation & { caseId: string; candidate: CandidateId; repeat: number; verdict: Verdict | null };
export type Experiment = {
  formatVersion: 1; id: string; createdAt: string; finishedAt: string | null;
  datasetVersion: string; datasetHash: string; scorerVersion: string; promptVersion: string;
  config: { candidates: CandidateId[]; strategy: Strategy; repeats: number; temperature: number; seed: number; maxTokens: number; contextTokens: number };
  status: "running" | "completed" | "stopped"; rows: ExtractionRow[];
};

export async function createExperiment(candidates: CandidateId[], strategy: Strategy, repeats: number): Promise<Experiment> {
  if (!candidates.length || new Set(candidates).size !== candidates.length || candidates.length > 8 || candidates.some(c => !resolveCandidate(c)) || !STRATEGIES.includes(strategy) || !Number.isInteger(repeats) || repeats < 1 || repeats > 5) throw new Error("Invalid experiment configuration");
  const bytes = new TextEncoder().encode(JSON.stringify(INVOICE_CASES));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return { formatVersion: 1, id: crypto.randomUUID(), createdAt: new Date().toISOString(), finishedAt: null, datasetVersion: DATASET_VERSION, datasetHash: Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join(""), scorerVersion: SCORER_VERSION, promptVersion: PROMPT_VERSION, config: { candidates, strategy, repeats, temperature: 0, seed: 42, maxTokens: 512, contextTokens: 4096 }, status: "running", rows: [] };
}

export function makeRow(item: InvoiceCase, candidate: CandidateId, repeat: number, generation: Generation): ExtractionRow {
  return { ...generation, caseId: item.id, candidate, repeat, verdict: generation.error ? null : scoreInvoice(generation.response, item.expected, generation.complete) };
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}

export function summarize(experiment: Experiment) {
  return experiment.config.candidates.map(candidate => {
    const rows = experiment.rows.filter(r => r.candidate === candidate);
    const judged = rows.filter(r => r.verdict !== null);
    const complete = rows.filter(r => !r.error && r.complete);
    const passed = rows.filter(r => r.verdict?.pass).length;
    const expected = INVOICE_CASES.length * experiment.config.repeats;
    return { candidate, attempted: rows.length, expected, passed, errors: rows.filter(r => r.error).length,
      passRate: rows.length ? passed / rows.length : null,
      fieldAccuracy: judged.length ? judged.reduce((s,r) => s + r.verdict!.fieldAccuracy,0) / judged.length : null,
      schemaRate: judged.length ? judged.filter(r => r.verdict!.schemaValid).length / judged.length : null,
      coverage: complete.length / expected,
      medianMs: percentile(complete.map(r => r.latencyMs), .5), p95Ms: percentile(complete.map(r => r.latencyMs), .95),
      estimatedCostUsd: rows.some(r => r.hosted ? r.hosted.estimatedCostUsd === null : estimatedCost(resolveCandidate(candidate)!, null, null) === null) ? null : rows.reduce((sum,r) => sum + (r.hosted?.estimatedCostUsd ?? 0), 0),
      eligible: rows.length === expected && passed === expected,
    };
  });
}

/** Refuse incompatible artifacts and recompute verdicts rather than trusting imported scores. */
export async function parseExperiment(text: string): Promise<Experiment> {
  if (text.length > 5_000_000) throw new Error("Run file exceeds 5 MB");
  const value = JSON.parse(text) as Experiment;
  if (!value || value.formatVersion !== 1 || !value.config || !Array.isArray(value.config.candidates)) throw new Error("Unsupported run format");
  const reference = await createExperiment(value.config.candidates, value.config.strategy, value.config.repeats);
  if (value.datasetVersion !== DATASET_VERSION || value.datasetHash !== reference.datasetHash || value.scorerVersion !== SCORER_VERSION || value.promptVersion !== PROMPT_VERSION) throw new Error("Run uses a different dataset, prompt, or scorer version");
  const settings = ["temperature", "seed", "maxTokens", "contextTokens"] as const;
  if (Object.keys(value.config).length !== Object.keys(reference.config).length || settings.some(key => value.config[key] !== reference.config[key])) throw new Error("Run configuration does not match this experiment version");
  if (typeof value.id !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || !["running", "completed", "stopped"].includes(value.status) || !Array.isArray(value.rows) || value.rows.length > value.config.candidates.length * INVOICE_CASES.length * value.config.repeats) throw new Error("Invalid run metadata");
  const seen = new Set<string>();
  value.rows = value.rows.map(row => {
    const item = INVOICE_CASES.find(c => c.id === row.caseId);
    const key = `${row.caseId}/${row.candidate}/${row.repeat}`;
    if (!item || !value.config.candidates.includes(row.candidate) || !Number.isInteger(row.repeat) || row.repeat < 0 || row.repeat >= value.config.repeats || seen.has(key) || typeof row.response !== "string" || row.response.length > 100_000 || typeof row.complete !== "boolean" || typeof row.finishReason !== "string" || !Number.isFinite(row.latencyMs) || row.latencyMs < 0 || (row.error !== undefined && typeof row.error !== "string") || (row.modelDigest !== null && typeof row.modelDigest !== "string")) throw new Error("Invalid or duplicate result row");
    for (const count of [row.inputTokens, row.outputTokens]) if (count !== null && (!Number.isInteger(count) || count < 0)) throw new Error("Invalid token count");
    let hosted: HostedMetadata | undefined;
    if (row.hosted !== undefined) {
      const h = row.hosted;
      const candidate = resolveCandidate(row.candidate)!;
      if (!h || h.provider !== candidate.provider || h.requestedModel !== candidate.model || h.adapterVersion !== "hosted-v1" || typeof h.actualModel !== "string" || h.actualModel.length > 160 || h.outputBudget !== 512 || (h.temperature !== null && h.temperature !== 0) || h.seed !== null || (h.reasoning !== null && typeof h.reasoning !== "string")) throw new Error("Invalid hosted provenance");
      hosted = { provider: h.provider, requestedModel: h.requestedModel, actualModel: h.actualModel, adapterVersion: "hosted-v1", outputBudget: 512, temperature: h.temperature, seed: null, reasoning: h.reasoning, estimatedCostUsd: estimatedCost(candidate,row.inputTokens,row.outputTokens), priceSource: candidate.pricing?.url ?? null, priceChecked: candidate.pricing?.checked ?? null };
    }
    seen.add(key);
    return makeRow(item, row.candidate, row.repeat, { response: row.response, latencyMs: row.latencyMs, inputTokens: row.inputTokens, outputTokens: row.outputTokens, complete: row.complete, finishReason: row.finishReason, modelDigest: row.modelDigest, ...(hosted ? { hosted } : {}), ...(row.error ? { error: row.error } : {}) });
  });
  if (value.status === "completed" && value.rows.length !== reference.config.candidates.length * INVOICE_CASES.length * reference.config.repeats) throw new Error("Completed run is missing results");
  return { ...reference, id: value.id, createdAt: value.createdAt, finishedAt: typeof value.finishedAt === "string" ? value.finishedAt : null, status: value.status, rows: value.rows };
}
