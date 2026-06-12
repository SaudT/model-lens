# ModelLens

**LLM token analytics & model selection tooling** — a local-first dashboard for understanding how text tokenizes, comparing model outputs side by side, and estimating API spend before you ship.

ModelLens helps you make informed decisions about which model to use for a workload, how much it will cost, and how tokenization affects your bill. Two of the three tools run entirely in the browser with no API keys. Model Comparison calls provider APIs directly using keys you store locally.

## Features

### Token Analyzer
- Paste any text and visualize `cl100k_base` tokenization client-side (via `js-tiktoken`)
- Colored token chips, density benchmarks across prose/code/JSON/numeric samples
- **No API key required**

### Model Comparison
- Send the same prompt to **Claude Haiku 4.5**, **Claude Sonnet 4.6**, and **GPT-4o Mini** in parallel
- Task types: Summarization, Code Generation, Reasoning, Data Extraction
- Per-model metrics: output, input/output tokens, latency, estimated cost
- **LLM-as-judge** quality scoring (Sonnet 4.6 rates each output 1–10)
- **Best value** badge for highest cost-efficiency (quality ÷ cost)
- **Requires Anthropic and/or OpenAI API keys** (see below)

### Cost Calculator
- Sliders for daily requests, avg input tokens, avg output tokens
- Compare monthly cost across six models with a bar chart
- Task profiles preset realistic usage patterns
- **No API key required**

### Evals Dashboard
- Heatmap of average judge scores by model × task type
- Cost vs quality scatter plot from a committed eval snapshot
- Per-task-type model recommendations
- **No API key required** (displays snapshot data; re-run evals via CLI to refresh)

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No `.env` file is required for most users. Token Analyzer and Cost Calculator work out of the box.

---

## Adding API keys (no `.env` setup)

ModelLens stores keys **in your browser's localStorage** under the key `modelLens_keys`. They are never written to a server-side environment variable or database.

1. Open **API Key Settings** in the sidebar
2. Paste your **Anthropic** key (`sk-ant-…`) to enable Haiku, Sonnet, and quality judging
3. Paste your **OpenAI** key (`sk-…`) to enable GPT-4o Mini comparisons
4. Click **Save** per provider

Keys are sent only to the respective provider's API when you run Model Comparison. A dismissable onboarding banner appears on first load if no keys are configured.

> **Note:** Server actions receive your keys as parameters from the client for comparison runs. This keeps setup simple but means keys transit through your Next.js server during those requests. For local development this is acceptable; do not deploy this pattern to a multi-tenant production app without a proper secrets architecture.

---

## How token pricing works

Providers bill in **tokens**, not words or characters. Each request has two metered components:

| Component | What it includes | Typical price |
|-----------|------------------|---------------|
| **Input tokens** | Your prompt, system message, conversation history, tool definitions | Lower $/1M tokens |
| **Output tokens** | Everything the model generates | 3–5× higher $/1M tokens |

**Why output costs more:** generation is sequential — the model must sample and verify each token autoregressively, which uses more compute per token than reading input in parallel.

**What affects token count:**
- Text length and tokenizer choice (GPT/Claude/Gemini use different vocabularies)
- Formatting: code and JSON often use *more tokens per word* than prose
- Whitespace and punctuation (leading spaces are often part of a token)
- Images, PDFs, and long system prompts in agentic workflows

ModelLens uses **hardcoded per-million-token rates** in the Cost Calculator and Comparison view. These are estimates for planning — check provider pricing pages for current rates.

**Cost formula (per request):**

```
cost = (inputTokens / 1_000_000 × inputPrice) + (outputTokens / 1_000_000 × outputPrice)
```

**Monthly estimate (Cost Calculator):**

```
monthly = costPerRequest × dailyRequests × 30
```

---

## Cost-efficiency scoring

After a comparison run, ModelLens optionally judges output quality and computes **cost-efficiency**:

```
cost-efficiency = qualityScore / estimatedCostUsd
```

- **qualityScore** — integer 1–10 from the LLM judge (see below)
- **estimatedCostUsd** — computed from actual input/output token counts × hardcoded model pricing

The model with the highest cost-efficiency gets the **Best value** badge. This favors models that score well *relative to what you paid*, not just the highest absolute quality. A Haiku response scoring 7 at $0.0003 can beat a Sonnet response scoring 9 at $0.003.

If judging is skipped (no Anthropic key) or cost is zero, no badge is shown.

---

## LLM-as-judge scoring

When an Anthropic key is present and at least one model returns successfully, ModelLens sends a follow-up request to **Claude Sonnet 4.6** acting as an impartial evaluator.

The judge receives:
- The original prompt
- The selected task type (e.g. "code generation")
- All successful model outputs

It returns JSON mapping each model ID to a score from 1–10:

```json
{"claude-haiku-4-5": 7, "claude-sonnet-4-6": 9, "gpt-4o-mini": 8}
```

**Caveats:**
- Scores are subjective and non-deterministic — rerun comparisons may differ slightly
- The judge has its own API cost (included in the ~$0.01 comparison estimate)
- Sonnet 4.6 also competes as one of the three models, so it evaluates its own output alongside others

Judging is skipped entirely if no Anthropic key is configured.

---

## Evals system

ModelLens includes a batch eval pipeline for systematic model comparison across 20 curated prompts.

### What's in `/evals`

| File | Purpose |
|------|---------|
| `prompts.json` | 20 prompts (5 per task type) with `id`, `task_type`, `prompt`, and `success_criteria` |
| `run_evals.ts` | CLI script that runs all prompts against three models and judges each response |
| `results.csv` | Output from the last eval run (60 rows = 20 prompts × 3 models) |
| `env.eval.example` | Template for API keys — copy to `.env.eval` at project root |

### Methodology

1. **Prompt suite** — Each prompt has explicit success criteria (e.g. "must return valid JSON with fields X, Y, Z").
2. **Model execution** — For each prompt, models run **in sequence**: `claude-haiku-4-5` → `claude-sonnet-4-6` → `gpt-4o-mini`. Each uses the same task-type system instruction as Model Comparison.
3. **LLM-as-judge** — After each response, **Claude Sonnet 4.6** evaluates the output against the prompt's `success_criteria` and returns JSON: `{"score": 1-10, "pass": boolean}`. Pass defaults to `score >= 7` when criteria are substantially met.
4. **Metrics recorded** — Input/output tokens, estimated cost (hardcoded pricing), latency, score, pass/fail.
5. **Dashboard snapshot** — The Evals Dashboard reads a hardcoded CSV snapshot in `src/lib/evals-snapshot.ts` (kept in sync with `evals/results.csv`).

### How to re-run evals

```bash
# 1. Create .env.eval at project root (gitignored)
cp evals/env.eval.example .env.eval
# Edit .env.eval — add ANTHROPIC_API_KEY and OPENAI_API_KEY

# 2. Run the eval suite (~60 API calls; expect ~$0.50–2.00 depending on output length)
npm run evals

# 3. Refresh the dashboard snapshot
# Copy the contents of evals/results.csv into the SNAPSHOT_CSV constant
# in src/lib/evals-snapshot.ts
```

The eval runner writes progress to stdout and saves `evals/results.csv`. Re-running overwrites the previous results.

**Note:** Evals use `.env.eval` (CLI-only). This is separate from the browser localStorage keys used by Model Comparison — evals are intended for offline batch runs from your terminal.

### Reading the dashboard

- **Heatmap** — Average judge score per model and task type. Greener cells = higher scores.
- **Cost vs quality scatter** — Each point is a model's average across all 20 prompts. Ideal models sit top-left (high quality, low cost).
- **Recommendations** — Per task type, the model with the best cost-efficiency (`avgScore / avgCost`) in the snapshot, with a plain-language rationale.

---

## What I learned

Building ModelLens surfaced a few non-obvious patterns in token economics:

1. **Format matters more than length.** The same semantic content in JSON or TypeScript can consume 1.5–2× the tokens of equivalent prose because BPE tokenizers split symbols aggressively. Cost estimates based on word count alone will lie to you — always tokenize the actual payload.

2. **Output tokens dominate spend on chatty models.** Because output is priced several times higher than input, a model that rambles (or that you allow to generate long chain-of-thought) can cost more than a smarter model that answers concisely. Controlling `max_tokens` and prompt style often saves more than switching providers.

3. **The "best" model depends on the metric.** Sonnet consistently wins quality scores, but Haiku and GPT-4o Mini often win cost-efficiency on structured tasks like summarization and extraction. For high-volume simple workloads, the quality gap may not justify 10–20× the price.

4. **Small string changes change the bill.** `"fire truck"` and `"firetruck"` tokenize differently; adding a space or switching from camelCase to snake_case in a JSON schema can shift token counts enough to matter at scale. The Token Analyzer makes these invisible costs visible before they hit production traffic.

---

## Tech stack

- **Next.js 16** (App Router, Server Actions)
- **React 19**, **Tailwind CSS 4**
- **js-tiktoken** — client-side `cl100k_base` tokenization
- **recharts** — Cost Calculator bar chart
- **Radix UI** — accessible primitives

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint |
| `npm run evals` | Run batch eval suite (requires `.env.eval`) |

## License

Private project — see repository for license details.
