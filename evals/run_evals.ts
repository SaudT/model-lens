#!/usr/bin/env npx tsx
/**
 * ModelLens eval runner — reads prompts.json, calls models, judges with Sonnet 4.6.
 *
 * Usage:
 *   cp evals/env.eval.example .env.eval   # add your keys
 *   npm run evals
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { TASK_INSTRUCTIONS, type TaskType } from "../src/lib/comparison-types";
import {
  estimateCostUsd,
  type ComparisonModelId,
} from "../src/lib/model-pricing";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PROMPTS_PATH = join(ROOT, "evals", "prompts.json");
const ENV_PATH = join(ROOT, ".env.eval");
const RESULTS_PATH = join(ROOT, "evals", "results.csv");

const JUDGE_MODEL: ComparisonModelId = "claude-sonnet-4-6";

const EVAL_MODELS: ComparisonModelId[] = [
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  "gpt-4o-mini",
];

type EvalPrompt = {
  id: string;
  task_type: TaskType;
  prompt: string;
  success_criteria: string;
};

type JudgeVerdict = {
  score: number;
  pass: boolean;
};

type EvalRow = {
  prompt_id: string;
  task_type: TaskType;
  model: ComparisonModelId;
  score: number;
  pass: boolean;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
};

function loadEnvEval(): { anthropicKey: string; openaiKey: string } {
  let content: string;
  try {
    content = readFileSync(ENV_PATH, "utf-8");
  } catch {
    console.error(
      `Missing ${ENV_PATH}. Copy evals/env.eval.example to .env.eval and add your API keys.`
    );
    process.exit(1);
  }

  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  const anthropicKey = env.ANTHROPIC_API_KEY ?? env.anthropic_api_key ?? "";
  const openaiKey = env.OPENAI_API_KEY ?? env.openai_api_key ?? "";

  if (!anthropicKey) {
    console.error(".env.eval must include ANTHROPIC_API_KEY (required for judging).");
    process.exit(1);
  }
  if (!openaiKey) {
    console.error(".env.eval must include OPENAI_API_KEY (required for gpt-4o-mini).");
    process.exit(1);
  }

  return { anthropicKey, openaiKey };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAnthropic(
  model: ComparisonModelId,
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number
) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    content?: { type: string; text: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Anthropic error ${res.status}`);
  }

  const text =
    data.content?.[0]?.type === "text" ? data.content[0].text : "";

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

async function callOpenAI(
  apiKey: string,
  system: string,
  user: string,
  maxTokens: number
) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  const data = (await res.json()) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `OpenAI error ${res.status}`);
  }

  return {
    text: data.choices?.[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

async function runModel(
  model: ComparisonModelId,
  taskType: TaskType,
  prompt: string,
  keys: { anthropicKey: string; openaiKey: string }
) {
  const start = Date.now();
  const system = TASK_INSTRUCTIONS[taskType];

  const result =
    model === "gpt-4o-mini"
      ? await callOpenAI(keys.openaiKey, system, prompt, 1024)
      : await callAnthropic(model, keys.anthropicKey, system, prompt, 1024);

  return {
    ...result,
    latencyMs: Date.now() - start,
    costUsd: estimateCostUsd(model, result.inputTokens, result.outputTokens),
  };
}

async function judgeResponse(
  evalPrompt: EvalPrompt,
  response: string,
  anthropicKey: string
): Promise<JudgeVerdict> {
  const judgeUser = `Evaluate the model response against the success criteria.

Task type: ${evalPrompt.task_type}

Original prompt:
${evalPrompt.prompt}

Success criteria:
${evalPrompt.success_criteria}

Model response:
${response || "(empty response)"}

Return ONLY valid JSON with:
- "score": integer 1-10 (10 = fully meets criteria)
- "pass": boolean (true if score >= 7 AND criteria are substantially met)

Example: {"score": 8, "pass": true}`;

  const result = await callAnthropic(
    JUDGE_MODEL,
    anthropicKey,
    "You are a strict evaluator. Return JSON only.",
    judgeUser,
    128
  );

  const match = result.text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Judge returned no JSON");
  }

  const parsed = JSON.parse(match[0]) as { score?: number; pass?: boolean };
  const score =
    typeof parsed.score === "number"
      ? Math.min(10, Math.max(1, Math.round(parsed.score)))
      : 1;
  const pass =
    typeof parsed.pass === "boolean" ? parsed.pass : score >= 7;

  return { score, pass };
}

function escapeCsv(value: string | number | boolean): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(rows: EvalRow[]) {
  const header =
    "prompt_id,task_type,model,score,pass,input_tokens,output_tokens,cost_usd,latency_ms";
  const lines = rows.map(
    (r) =>
      [
        escapeCsv(r.prompt_id),
        escapeCsv(r.task_type),
        escapeCsv(r.model),
        r.score,
        r.pass,
        r.input_tokens,
        r.output_tokens,
        r.cost_usd.toFixed(6),
        r.latency_ms,
      ].join(",")
  );
  writeFileSync(RESULTS_PATH, [header, ...lines].join("\n") + "\n", "utf-8");
}

async function main() {
  const keys = loadEnvEval();
  const { prompts } = JSON.parse(readFileSync(PROMPTS_PATH, "utf-8")) as {
    prompts: EvalPrompt[];
  };

  console.log(`Running ${prompts.length} prompts × ${EVAL_MODELS.length} models…`);
  console.log(`Results → ${RESULTS_PATH}\n`);

  const rows: EvalRow[] = [];
  let done = 0;
  const total = prompts.length * EVAL_MODELS.length;

  for (const evalPrompt of prompts) {
    for (const model of EVAL_MODELS) {
      done++;
      process.stdout.write(
        `[${done}/${total}] ${evalPrompt.id} × ${model} … `
      );

      try {
        const run = await runModel(
          model,
          evalPrompt.task_type,
          evalPrompt.prompt,
          keys
        );
        await sleep(300);
        const verdict = await judgeResponse(
          evalPrompt,
          run.text,
          keys.anthropicKey
        );
        await sleep(300);

        rows.push({
          prompt_id: evalPrompt.id,
          task_type: evalPrompt.task_type,
          model,
          score: verdict.score,
          pass: verdict.pass,
          input_tokens: run.inputTokens,
          output_tokens: run.outputTokens,
          cost_usd: run.costUsd,
          latency_ms: run.latencyMs,
        });

        console.log(`score=${verdict.score} pass=${verdict.pass}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`ERROR: ${message}`);
        rows.push({
          prompt_id: evalPrompt.id,
          task_type: evalPrompt.task_type,
          model,
          score: 0,
          pass: false,
          input_tokens: 0,
          output_tokens: 0,
          cost_usd: 0,
          latency_ms: 0,
        });
      }
    }
  }

  writeCsv(rows);
  console.log(`\nDone. Wrote ${rows.length} rows to ${RESULTS_PATH}`);
  console.log(
    "Refresh the Evals Dashboard: copy evals/results.csv into SNAPSHOT_CSV in src/lib/evals-snapshot.ts"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
