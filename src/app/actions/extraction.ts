"use server";

import { INVOICE_CASES } from "@/lib/extraction/dataset";
import { runOllama } from "@/lib/extraction/ollama";
import type { CandidateId, Generation, Strategy } from "@/lib/extraction/experiment";

export async function runLocalExtraction(candidate: CandidateId, caseId: string, strategy: Strategy): Promise<Generation> {
  const started = Date.now();
  try {
    // Explicit opt-in: a publicly hosted deployment must not expose its loopback services.
    if (process.env.MODELLENS_ENABLE_OLLAMA !== "1") throw new Error("Local models are disabled. Start your local app with MODELLENS_ENABLE_OLLAMA=1 npm run dev and run Ollama on the same computer.");
    const item = INVOICE_CASES.find(c => c.id === caseId);
    if (!item) throw new Error("Unknown invoice case");
    return await runOllama(candidate, item.text, strategy);
  } catch (error) {
    const message = error instanceof Error && error.name === "TimeoutError" ? "Ollama timed out after 90 seconds" : error instanceof Error ? error.message : "Local model failed";
    return { response: "", latencyMs: Date.now() - started, inputTokens: null, outputTokens: null, complete: false, finishReason: "error", modelDigest: null, error: message === "fetch failed" ? "Cannot reach Ollama. Start ollama serve on the app server’s computer." : message };
  }
}
