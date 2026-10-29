"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { runHostedExtraction, runLocalExtraction } from "@/app/actions/extraction";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DATASET_DESCRIPTION, DATASET_VERSION, INVOICE_CASES } from "@/lib/extraction/dataset";
import { CANDIDATES, createExperiment, makeRow, parseExperiment, STRATEGIES, summarize, type CandidateId, type Experiment, type Strategy } from "@/lib/extraction/experiment";
import { extractBaseline } from "@/lib/extraction/scoring";
import { customCandidate, isHosted, planCost, resolveCandidate } from "@/lib/extraction/models";
import { useApiKeys } from "@/hooks/use-api-keys";
import { ApiKeySettings } from "@/components/dashboard/api-key-settings";
import type { Provider } from "@/lib/api-keys";
import { getProviderKey } from "@/lib/api-keys";

const HISTORY_KEY = "modelLens_extraction_runs_v1";
function subscribe(listener: () => void) {
  window.addEventListener("modelLens:runs", listener);
  window.addEventListener("storage", listener);
  return () => { window.removeEventListener("modelLens:runs", listener); window.removeEventListener("storage", listener); };
}
function readHistory() { try { return localStorage.getItem(HISTORY_KEY) ?? "[]"; } catch { return "[]"; } }
function historyEntries(raw: string): Experiment[] {
  try { const value: unknown = JSON.parse(raw); return Array.isArray(value) ? value.filter(v => v && typeof v === "object" && typeof v.id === "string" && typeof v.createdAt === "string").slice(0, 8) : []; } catch { return []; }
}
function saveRun(run: Experiment) {
  const previous = historyEntries(readHistory()).filter(r => r.id !== run.id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([run, ...previous].slice(0, 8)));
  window.dispatchEvent(new Event("modelLens:runs"));
}
function download(name: string, content: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
function percent(value: number | null) { return value === null ? "—" : `${(value * 100).toFixed(1)}%`; }
function millis(value: number | null) { return value === null ? "—" : `${Math.round(value).toLocaleString()} ms`; }
const control = "rounded-md border bg-background px-3 py-2 text-sm";

export function ExtractionLab() {
  const { keys } = useApiKeys();
  const [customIds, setCustomIds] = useState<string[]>([]);
  const [customProvider, setCustomProvider] = useState<Provider>("gemini");
  const [customModel, setCustomModel] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [candidates, setCandidates] = useState<CandidateId[]>(["baseline"]);
  const [strategy, setStrategy] = useState<Strategy>("schema");
  const [repeats, setRepeats] = useState(1);
  const [minimumPass, setMinimumPass] = useState(90);
  const [latencyLimit, setLatencyLimit] = useState(30_000);
  const [run, setRun] = useState<Experiment | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const stop = useRef(false);
  const history = useSyncExternalStore(subscribe, readHistory, () => "[]");
  const summaries = run ? summarize(run) : [];
  const qualifying = summaries.filter(s => s.attempted === s.expected && s.coverage === 1 && s.passRate !== null && s.passRate >= minimumPass / 100 && s.p95Ms !== null && s.p95Ms <= latencyLimit);
  const winner = [...qualifying].sort((a,b) => (a.p95Ms ?? Infinity) - (b.p95Ms ?? Infinity))[0];
  const hostedCandidates = candidates.map(resolveCandidate).filter(c => c && isHosted(c.provider));
  const missingKeys = hostedCandidates.filter(c => !keys[c!.provider as Provider]?.trim());
  const estimate = planCost(candidates,strategy,repeats);
  const available = [...CANDIDATES,...customIds.map(id => resolveCandidate(id)!)];

  function checkpoint(next: Experiment) {
    setRun({ ...next, rows: [...next.rows] });
    try { saveRun(next); } catch { setMessage("Browser storage is unavailable or full. Export this run before leaving the page."); }
  }
  async function start() {
    if (hostedCandidates.length && (!acknowledged || missingKeys.length)) { setMessage("Add each selected provider key and acknowledge possible charges before running."); return; }
    setBusy(true); setMessage(""); stop.current = false;
    let current: Experiment | null = null;
    try {
      current = await createExperiment(candidates, strategy, repeats);
      checkpoint(current);
      // Sequential calls avoid model-swapping contention and keep local machines responsive.
      outer: for (const candidate of current.config.candidates) {
        for (let repeat = 0; repeat < current.config.repeats; repeat++) {
          for (const item of INVOICE_CASES) {
            if (stop.current) break outer;
            const started = performance.now();
            const generation = candidate === "baseline"
              ? { response: JSON.stringify(extractBaseline(item.text)), latencyMs: performance.now() - started, inputTokens: null, outputTokens: null, complete: true, finishReason: "rules", modelDigest: null }
              : isHosted(resolveCandidate(candidate)!.provider)
                ? await runHostedExtraction(candidate, item.id, current.config.strategy, getProviderKey(resolveCandidate(candidate)!.provider as Provider) ?? "")
                : await runLocalExtraction(candidate, item.id, current.config.strategy);
            current.rows.push(makeRow(item, candidate, repeat, generation));
            checkpoint(current);
            if (generation.error) { setMessage(`${candidate}: ${generation.error} Run stopped; completed results are preserved.`); stop.current = true; break outer; }
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }
      current.status = stop.current ? "stopped" : "completed";
      current.finishedAt = new Date().toISOString(); checkpoint(current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Experiment failed");
      if (current) { current.status = "stopped"; current.finishedAt = new Date().toISOString(); checkpoint(current); }
    } finally { setBusy(false); }
  }
  async function load(raw: string) {
    try { const value = await parseExperiment(raw); setRun(value); setMessage(""); }
    catch(error) { setMessage(error instanceof Error ? error.message : "Cannot import run"); }
  }

  return <div className="space-y-7">
    <div className="max-w-3xl space-y-2">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Workload evaluation · {DATASET_VERSION}</p>
      <h2 className="text-2xl font-semibold tracking-tight">Which model meets your extraction target?</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">Extract six invoice fields, measure correctness, and inspect the failures. Start with a free rules baseline, compare hosted Gemini, Anthropic, and OpenAI models with your own keys, or run local models through Ollama. Grading is deterministic: no extra judge calls.</p>
    </div>
    <div className="rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">A development benchmark with known answers</p>
      <p className="mt-1 text-muted-foreground">{DATASET_DESCRIPTION} Pass requires all six fields correct, valid schema, and a complete response. Missing and ambiguous values must be null.</p>
    </div>
    <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">Getting started: choose your path</summary><ol className="mt-3 list-inside list-decimal space-y-2 text-sm"><li>Try immediately: keep Rules baseline selected and click Run experiment. No account or key required.</li><li>Use hosted AI: open API Key Settings, create a provider key using the linked console, save it, then select a model below. Review potential charges before running.</li><li>Use local AI: choose an Ollama model and follow the local setup instructions. Local inference needs ModelLens running on your computer.</li></ol><div className="mt-3 max-w-xs"><ApiKeySettings /></div></details>
    <Card><CardHeader><CardTitle>Configure an experiment</CardTitle></CardHeader><CardContent className="space-y-5">
      <fieldset disabled={busy} className="space-y-4">
        <legend className="mb-2 text-sm font-medium">Candidates</legend>
        <div className="grid gap-3 lg:grid-cols-2">{available.map(candidate => <label key={candidate.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={candidates.includes(candidate.id)} onChange={event => { setCandidates(previous => event.target.checked ? [...previous, candidate.id] : previous.filter(c => c !== candidate.id)); setAcknowledged(false); }}/>
          <span><span className="block font-medium">{candidate.label}</span><span className="text-xs text-muted-foreground">{candidate.provider === "browser" ? "Runs immediately · no installation" : candidate.provider === "ollama" ? "Local Ollama · no per-request API fees" : `${candidate.provider} API · ${keys[candidate.provider]?.trim() ? "key available (unverified)" : "add key in Settings"}`}</span></span>
        </label>)}</div>
        <details className="rounded-md border p-3 text-sm"><summary className="cursor-pointer font-medium">Advanced: add a custom hosted model</summary><p className="mt-2 text-xs text-muted-foreground">Text-generation model IDs only. This uses OpenAI Chat Completions, Anthropic Messages, or Gemini generateContent. Access and supported settings vary; custom pricing is unknown. Unsupported requests stop with an error, without fallback.</p><div className="mt-3 flex flex-wrap items-end gap-2"><label>Provider<select className={`${control} block`} value={customProvider} onChange={e=>setCustomProvider(e.target.value as Provider)}><option value="gemini">Google Gemini</option><option value="anthropic">Anthropic</option><option value="openai">OpenAI</option></select></label><label>Model ID<input className={`${control} block`} placeholder="Exact model ID from provider" value={customModel} maxLength={120} onChange={e=>setCustomModel(e.target.value)}/></label><Button type="button" variant="outline" disabled={!customModel.trim() || candidates.length >= 8} onClick={()=>{try{const id=customCandidate(customProvider,customModel);setCustomIds(previous=>previous.includes(id)?previous:[...previous,id]);setCandidates(previous=>previous.includes(id)?previous:[...previous,id]);setCustomModel("");setAcknowledged(false);setMessage("");}catch(error){setMessage(error instanceof Error?error.message:"Invalid model ID");}}}>Add model</Button></div></details>
        <div className="flex flex-wrap gap-4">
          <label className="space-y-1 text-sm"><span className="block">Prompt strategy</span><select className={control} value={strategy} onChange={e => { setStrategy(e.target.value as Strategy); setAcknowledged(false); }}>{STRATEGIES.map(s => <option key={s} value={s}>{s === "plain" ? "Instructions only" : s === "few-shot" ? "Instructions + example" : "Instructions + JSON schema"}</option>)}</select></label>
          <label className="space-y-1 text-sm"><span className="block">Repeats per case</span><select className={control} value={repeats} onChange={e => { setRepeats(Number(e.target.value)); setAcknowledged(false); }}>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></label>
        </div>
      </fieldset>
      <p className="text-xs text-muted-foreground">{candidates.length * repeats * INVOICE_CASES.length} attempts · 512 output tokens maximum per call. Local models use temperature 0, seed 42, and 4,096 context tokens. Hosted settings vary by provider and are recorded with each result. Hardware and electricity costs are not measured.</p>
      {candidates.some(c => resolveCandidate(c)?.provider === "ollama") && <details className="rounded-md border p-3 text-sm"><summary className="cursor-pointer font-medium">Set up local models</summary><p className="my-2 text-muted-foreground">Install Ollama, pull the selected models, then start ModelLens on the same computer with local inference enabled. Downloads are manual; this app never pulls model weights.</p><pre className="overflow-auto rounded bg-muted p-3 text-xs">{"ollama pull llama3.2:3b\nollama pull qwen2.5:3b\n# Optional: ollama pull gemma2:9b\nollama serve\n# In another terminal:\nMODELLENS_ENABLE_OLLAMA=1 npm run dev"}</pre><p className="mt-2 text-xs text-muted-foreground">Do not enable local inference on a public deployment. Calls go to the app server’s loopback address.</p></details>}
      {hostedCandidates.length > 0 && <div className="space-y-3 rounded-md border p-4 text-sm"><p className="font-medium">Hosted calls may charge your provider accounts</p><p>Planning estimate for known model rates: ${estimate.usd.toFixed(4)}{estimate.unknown ? " plus unknown custom-model costs" : ""}. This uses approximate input counts and a full output budget; it is not a spending cap. Free-tier quotas, caching, reasoning, and billing adjustments can change actual charges.</p><p className="text-xs text-muted-foreground">Keys and synthetic invoice prompts pass through the ModelLens server to the selected provider. No automatic retries, model substitutions, or paid judge calls. Set hard spending limits in the provider console if available.</p><div className="max-w-xs"><ApiKeySettings /></div>{missingKeys.length > 0 && <p role="status">Missing key: {[...new Set(missingKeys.map(c=>c!.provider))].join(", ")}</p>}<label className="flex items-start gap-2"><input type="checkbox" checked={acknowledged} disabled={busy} onChange={e=>setAcknowledged(e.target.checked)}/><span>I understand these requests may use my paid balance or free quota.</span></label><details><summary className="cursor-pointer text-xs">Price sources (checked October 29, 2026)</summary>{hostedCandidates.map(c=>c!.pricing && <p key={c!.id} className="mt-1 text-xs"><a className="underline" href={c!.pricing.url} target="_blank" rel="noreferrer">{c!.label}: ${c!.pricing.input} input / ${c!.pricing.output} output per million tokens</a></p>)}</details></div>}
      <div className="flex flex-wrap gap-3"><Button disabled={busy || !candidates.length || candidates.length > 8 || missingKeys.length > 0 || (hostedCandidates.length > 0 && !acknowledged)} onClick={start}>{busy ? "Running experiment…" : "Run experiment"}</Button>{busy && <Button variant="outline" onClick={() => { stop.current = true; setMessage("Stopping after the current request finishes (up to 90 seconds)."); }}>Stop after current request</Button>}<label className={`${control} ${busy ? "opacity-50" : "cursor-pointer"}`}>Import run JSON<input type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={async e => { const file = e.target.files?.[0]; if (file) { if (file.size > 5_000_000) setMessage("Run file exceeds 5 MB"); else await load(await file.text()); } e.target.value = ""; }}/></label></div>
      {message && <p role="status" className="text-sm text-amber-800 dark:text-amber-300">{message}</p>}
    </CardContent></Card>
    {run && <>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Run results</h3><p className="text-xs text-muted-foreground">{run.status} · {run.rows.length}/{run.config.candidates.length * run.config.repeats * INVOICE_CASES.length} attempts · {new Date(run.createdAt).toLocaleString()} · {run.config.strategy}</p></div><Button variant="outline" onClick={() => download(`model-lens-${run.id}.json`, JSON.stringify(run,null,2))}>Export run JSON</Button></div>
      <div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><caption className="sr-only">Invoice extraction correctness and latency by candidate</caption><thead className="bg-muted/50"><tr>{["Candidate","Attempts","Exact pass","Field accuracy","Schema valid","Errors","Coverage","Est. API cost","Median / p95"].map(h => <th key={h} className="whitespace-nowrap p-3 font-medium">{h}</th>)}</tr></thead><tbody>{summaries.map(s => <tr className="border-t" key={s.candidate}><th scope="row" className="p-3 font-medium">{s.candidate}</th><td className="p-3">{s.attempted}/{s.expected}</td><td className="p-3">{percent(s.passRate)}</td><td className="p-3">{percent(s.fieldAccuracy)}</td><td className="p-3">{percent(s.schemaRate)}</td><td className="p-3">{s.errors}</td><td className="p-3">{percent(s.coverage)}</td><td className="p-3">{s.estimatedCostUsd === null ? "Unknown" : `$${s.estimatedCostUsd.toFixed(4)}`}</td><td className="whitespace-nowrap p-3 font-mono text-xs">{millis(s.medianMs)} / {millis(s.p95Ms)}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">Exact pass includes request failures in its denominator. Field accuracy and schema validity use responses received; coverage is completed generations / planned attempts. Latency includes model loading and local model lookup. Repeats with a fixed seed are stability checks, not independent samples.</p>
      <Card><CardHeader><CardTitle>Does any candidate meet your target?</CardTitle></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-4"><label className="text-sm">Minimum exact pass (%)<input className={`${control} ml-2 w-24`} type="number" min={0} max={100} value={minimumPass} onChange={e => setMinimumPass(Math.max(0, Math.min(100, Number(e.target.value))))}/></label><label className="text-sm">Maximum p95 latency (ms)<input className={`${control} ml-2 w-28`} type="number" min={1} value={latencyLimit} onChange={e => setLatencyLimit(Math.max(1, Number(e.target.value)))}/></label></div><p className="text-sm font-medium">{busy || run.status !== "completed" ? "Finish a complete experiment before selecting a candidate." : winner ? `${winner.candidate} is the fastest qualifying candidate on this run.` : "No candidate qualifies. Inspect failures before relaxing the target."}</p><p className="text-xs text-muted-foreground">Every planned generation must complete. Qualifying candidates are ordered by p95 latency; compare estimated costs separately. Unknown costs are not zero. List-price estimates do not establish actual billed charges. This small development set cannot establish production readiness.</p></CardContent></Card>
      <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">Run provenance</summary><pre className="mt-3 overflow-auto text-xs">{JSON.stringify({ id:run.id, dataset:run.datasetVersion, sha256:run.datasetHash, prompt:run.promptVersion, scorer:run.scorerVersion, config:run.config, modelDigests:[...new Set(run.rows.map(r=>r.modelDigest).filter(Boolean))] },null,2)}</pre><p className="mt-2 text-xs text-muted-foreground">Imported files are user-supplied evidence, not authenticated benchmarks. Verdicts are recomputed against this version’s expected answers.</p></details>
      <div className="space-y-3"><h3 className="text-lg font-semibold">Inspect the evidence</h3>{run.rows.map(row => { const item = INVOICE_CASES.find(c=>c.id===row.caseId)!; return <details key={`${row.caseId}/${row.candidate}/${row.repeat}`} className="rounded-lg border p-4"><summary className="cursor-pointer text-sm"><span className="font-mono">{row.caseId}</span> · {row.candidate} · repeat {row.repeat+1} · {row.error ? "Request error" : row.verdict?.pass ? "Pass" : "Fail"} · {item.category}</summary><div className="mt-4 grid gap-4 lg:grid-cols-2"><div><h4 className="text-xs font-semibold uppercase text-muted-foreground">Document</h4><pre className="mt-2 whitespace-pre-wrap rounded bg-muted/40 p-3 text-xs">{item.text}</pre><h4 className="mt-3 text-xs font-semibold uppercase text-muted-foreground">Expected answer</h4><pre className="mt-2 overflow-auto text-xs">{JSON.stringify(item.expected,null,2)}</pre></div><div><h4 className="text-xs font-semibold uppercase text-muted-foreground">Raw response</h4><pre className="mt-2 whitespace-pre-wrap break-words rounded bg-muted/40 p-3 text-xs">{row.error || row.response || "(empty response)"}</pre><p className="mt-2 text-xs text-muted-foreground">Finish: {row.finishReason} · tokens in/out: {row.inputTokens ?? "unmeasured"}/{row.outputTokens ?? "unmeasured"}</p>{row.hosted && <pre className="mt-2 overflow-auto text-xs">{JSON.stringify(row.hosted,null,2)}</pre>}{row.verdict && <><ul className="mt-2 list-inside list-disc text-xs">{row.verdict.errors.map(error=><li key={error}>{error}</li>)}</ul><ul className="mt-2 space-y-1 text-xs">{row.verdict.fields.map(f=><li key={f.field}><span className="font-mono">{f.field}</span>: {f.kind}{!f.correct && ` · expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`}</li>)}</ul></>}</div></div></details>; })}</div>
    </>}
    <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">Dataset cases and expected answers</summary><div className="mt-3 space-y-4">{INVOICE_CASES.map(item => <details key={item.id}><summary className="cursor-pointer text-sm">{item.id} · {item.category}</summary><div className="mt-2 grid gap-3 lg:grid-cols-2"><pre className="whitespace-pre-wrap text-xs">{item.text}</pre><pre className="text-xs">{JSON.stringify(item.expected,null,2)}</pre></div></details>)}</div></details>
    {historyEntries(history).length > 0 && <div className="space-y-3"><h3 className="text-lg font-semibold">Saved on this browser</h3><p className="text-xs text-muted-foreground">The eight most recent runs are saved after each attempt. Export JSON for a durable copy. Interrupted runs can be inspected and exported; rerun to repeat an experiment.</p><div className="flex flex-wrap gap-2">{historyEntries(history).map(saved=><Button key={saved.id} variant="outline" disabled={busy} onClick={()=>load(JSON.stringify(saved))}>{new Date(saved.createdAt).toLocaleString()} · {saved.status}</Button>)}</div></div>}
  </div>;
}
