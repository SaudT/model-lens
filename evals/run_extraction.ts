#!/usr/bin/env npx tsx
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { INVOICE_CASES } from "../src/lib/extraction/dataset";
import { createExperiment, makeRow, summarize, type CandidateId, type Strategy } from "../src/lib/extraction/experiment";
import { runOllama } from "../src/lib/extraction/ollama";
import { extractBaseline } from "../src/lib/extraction/scoring";

async function main() {
  const args = process.argv.slice(2);
  const options: Record<string,string> = {};
  if (args.includes("--help")) { console.log("npm run evals:extraction -- --models baseline,llama3.2:3b,qwen2.5:3b --strategy schema --repeats 1 --out evals/runs\nDefaults: baseline only, schema, 1 repeat. No API keys or paid calls. Pull Ollama models before selecting them."); return; }
  for (let i=0;i<args.length;i+=2) {
    if (!["--models","--strategy","--repeats","--out"].includes(args[i]) || !args[i+1] || args[i+1].startsWith("--")) throw new Error(`Invalid option ${args[i]}. Use --help.`);
    options[args[i]] = args[i+1];
  }
  const run = await createExperiment((options["--models"] ?? "baseline").split(",") as CandidateId[], (options["--strategy"] ?? "schema") as Strategy, Number(options["--repeats"] ?? 1));
  const directory = options["--out"] ?? "evals/runs";
  mkdirSync(directory,{recursive:true});
  const output = join(directory, `${run.id}.json`);
  function checkpoint() { writeFileSync(output+".tmp", JSON.stringify(run,null,2)+"\n"); renameSync(output+".tmp",output); }
  let stopped = false;
  process.on("SIGINT",()=>{ stopped=true; console.log("Stopping after the current request finishes; partial results will be saved."); });
  checkpoint();
  outer: for (const candidate of run.config.candidates) {
    for (let repeat=0;repeat<run.config.repeats;repeat++) {
      for (const item of INVOICE_CASES) {
        if (stopped) break outer;
        const started = performance.now();
        let generation;
        try {
          generation = candidate === "baseline"
            ? { response: JSON.stringify(extractBaseline(item.text)), latencyMs: performance.now()-started, inputTokens:null, outputTokens:null, complete:true, finishReason:"rules", modelDigest:null }
            : await runOllama(candidate,item.text,run.config.strategy);
        } catch(error) {
          generation = { response:"", latencyMs:performance.now()-started, inputTokens:null, outputTokens:null, complete:false, finishReason:"error", modelDigest:null, error:error instanceof Error ? error.message : "Local inference failed" };
        }
        const row = makeRow(item,candidate,repeat,generation);
        run.rows.push(row); checkpoint();
        console.log(`${candidate} ${item.id} repeat ${repeat+1}: ${generation.error ?? (row.verdict?.pass ? "PASS" : "FAIL")}`);
        if (generation.error) { stopped=true; break outer; }
      }
    }
  }
  run.status=stopped ? "stopped" : "completed"; run.finishedAt=new Date().toISOString(); checkpoint();
  const summaries = summarize(run);
  const report = `# Invoice extraction findings\n\nRun: ${run.id}\nStatus: ${run.status}\nDate: ${run.createdAt}\nDataset: ${run.datasetVersion}\nSHA-256: ${run.datasetHash}\nPrompt/scorer: ${run.promptVersion} / ${run.scorerVersion}\nStrategy: ${run.config.strategy}; repeats: ${run.config.repeats}; temperature: 0; seed: 42; output budget: 512; context: 4096.\n\n` + summaries.map(s=>`- ${s.candidate}: ${s.passed}/${s.attempted} exact passes out of ${s.expected} planned attempts; ${s.errors} request errors; ${s.fieldAccuracy === null ? "unmeasured" : (s.fieldAccuracy*100).toFixed(1)+"%"} field accuracy on responses received; median ${s.medianMs?.toFixed(1) ?? "unmeasured"} ms, p95 ${s.p95Ms?.toFixed(1) ?? "unmeasured"} ms.\n`).join("") + `\n## Observed failures\n\n` + run.rows.filter(r=>!r.verdict?.pass).map(r=>`- ${r.candidate} / ${r.caseId}: ${r.error ?? [...(r.verdict?.errors ?? []), ...(r.verdict?.fields.filter(f=>!f.correct).map(f=>f.field+": "+f.kind) ?? [])].join("; ")}\n`).join("") + `\n## Interpretation limits\n\nThese are measured results on 12 synthetic development cases, not a representative production sample. Fixed-seed repeats are stability checks, not independent trials. The rules baseline ignores prompt strategy. Local model latency includes lookup and cold loading. API fees are zero; hardware and electricity are unmeasured. Expected answers are never passed to the model. Raw outputs and per-field verdicts are in the companion JSON. No paid model judge was used.\n`;
  writeFileSync(join(directory,`${run.id}.md`),report);
  console.log(`Saved ${output}. Import this JSON in the Extraction Lab.`);
  if (stopped) process.exitCode=1;
}
main().catch(error=>{console.error(error instanceof Error ? error.message : error);process.exitCode=1;});
