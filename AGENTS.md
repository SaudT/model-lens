<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ModelLens — Agent Guide

ModelLens is a **local-first Next.js dashboard** for LLM token analytics and model selection. Four tools share one shell: Token Analyzer, Model Comparison, Cost Calculator, and Evals Dashboard.

Read `README.md` for user-facing docs. This file is for agents editing the codebase.

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS 4, shadcn/ui (`new-york`, CSS variables) |
| Icons | lucide-react |
| Charts | recharts |
| Tokenization | js-tiktoken (`cl100k_base`) — client-side only |
| Eval runner | tsx CLI (`evals/run_evals.ts`) |

## Architecture

Single-page app pattern: `src/app/page.tsx` renders `<Dashboard />`. Navigation is **client-side state** in `dashboard.tsx` / `sidebar.tsx` — not separate Next.js routes.

```
src/app/page.tsx → Dashboard
  ├── Sidebar (view switcher, API key settings)
  └── ViewContent
        ├── TokenAnalyzer      (no API keys)
        ├── ModelComparison    (server actions + localStorage keys)
        ├── CostCalculator     (no API keys)
        └── EvalsDashboard     (hardcoded CSV snapshot)
```

Shared layout header: **ModelLens** + subtitle. Onboarding banner shows when no keys are in localStorage.

## Directory map

```
src/
  app/
    page.tsx                 # Entry — Dashboard only
    layout.tsx               # Root layout, fonts, metadata
    actions/
      model-comparison.ts    # Server actions for compare + judge
  components/
    dashboard/               # Shell: sidebar, settings, onboarding
    views/                   # One file per tool view
    ui/                      # shadcn primitives (button, card, slider, …)
  hooks/
    use-api-keys.ts          # localStorage sync for browser keys
  lib/
    api-keys.ts              # STORAGE_KEY, get/save/mask helpers
    api-errors.ts            # classifyApiError (invalid_key, rate_limit, network)
    tokenizer.ts             # cl100k_base tokenize + content samples
    model-pricing.ts         # Single pricing registry (6 models + sources)
    cost-models.ts           # Cost calculator profiles + computeModelCosts
    comparison-types.ts      # TaskType, instructions, result types
    evals-snapshot.ts        # Hardcoded CSV snapshot for Evals Dashboard
    onboarding.ts            # Banner dismiss persistence
evals/
  prompts.json               # 20 eval prompts + success_criteria
  run_evals.ts               # Batch eval CLI
  results.csv                # Last eval output (60 rows)
  env.eval.example           # Template → copy to `.env.eval` at root
```

## API keys — two systems, do not conflate

| Context | Source | Used by |
|---------|--------|---------|
| **Browser UI** | `localStorage` key `modelLens_keys` via `useApiKeys()` | Model Comparison, API Key Settings |
| **Eval CLI** | `.env.eval` at project root (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) | `npm run evals` only |

**Model Comparison rules:**
- Keys are read on the **client** and passed as **parameters** to server actions.
- **Never** read provider keys from `process.env` in comparison code.
- Server actions live in `src/app/actions/model-comparison.ts`.

**Views without keys:** Token Analyzer, Cost Calculator, Evals Dashboard.

## Server actions (Model Comparison)

- `runComparisonModel({ modelId, prompt, taskType, apiKey })` — calls Anthropic or OpenAI via `fetch`
- `judgeComparisonOutputs({ prompt, taskType, apiKey, outputs })` — Sonnet 4.6 judge; returns `JudgeResult` with `scores` (1–10) and `reasons` (one sentence per model)

Models: `claude-haiku-4-5`, `claude-sonnet-4-6`, `gpt-4o-mini`.

Errors return structured `errorKind`: `invalid_key` | `rate_limit` | `network` | `unknown` via `classifyApiError`.

Best quality: highest judge score. Best value: cheapest model within 1 point of the top score (`src/lib/comparison-scoring.ts`).

## Task types

Shared across Model Comparison and evals:

`summarization` | `code-generation` | `reasoning` | `data-extraction`

System instructions: `TASK_INSTRUCTIONS` in `src/lib/comparison-types.ts`.

## Pricing

Hardcoded per-million-token **list prices** in `src/lib/model-pricing.ts` — not live from providers.

- **`MODEL_PRICING`** — single registry with `source.url`, `source.lastVerified`, and rates for all 6 models
- **`COMPARISON_MODELS`** — subset with `keyProvider` (3 models for comparison + evals)
- **`cost-models.ts`** — derives `COST_MODELS` from `MODEL_PRICING`; task profiles and monthly math only

When provider pricing changes: update rates in `MODEL_PRICING`, bump `source.lastVerified`, and reconcile `PRICING_LAST_REVIEWED`. Standard tier only (no batch/cache discounts).

## Evals system

1. Prompts in `evals/prompts.json` (20 total, 5 per task type).
2. `npm run evals` runs models **sequentially**, judges each response with Sonnet 4.6 against `success_criteria`.
3. Output: `evals/results.csv` with columns `prompt_id, task_type, model, score, pass, input_tokens, output_tokens, cost_usd, latency_ms`.
4. Dashboard reads **`SNAPSHOT_CSV`** string in `src/lib/evals-snapshot.ts` — must be updated manually after re-running evals (copy from `results.csv`).

## UI conventions

- Views are `"use client"` components in `src/components/views/`.
- Match existing patterns: Card-based layout, `Badge variant="success"` for "No API key required", mono font for token/cost numbers.
- Use `@/components/ui/*` shadcn components; `cn()` from `@/lib/utils`.
- Sliders: Radix via `@/components/ui/slider`. Loading: `@/components/ui/skeleton`.
- Add new views: extend `View` type in `sidebar.tsx`, add nav item, wire in `dashboard.tsx` `ViewContent`.

## Legacy / unused

- `src/lib/api-clients.ts` — older client-side fetch helpers; Model Comparison uses server actions instead. Do not extend unless intentionally migrating back.

## Commands

```bash
npm run dev      # http://localhost:3000
npm run build    # Must pass before finishing
npm run lint
npm run evals    # Requires .env.eval with Anthropic + OpenAI keys
```

No Python venv. Node/npm only.

## Do

- Keep diffs focused; match naming and patterns in neighboring files.
- Use server actions for Model Comparison API calls (keys as params).
- Run `npm run build` to verify TypeScript after changes.
- Document user-facing behavior in `README.md` when adding features.

## Don't

- Don't commit `.env.eval`, `.env.local`, or real API keys.
- Don't use `process.env` for Model Comparison provider keys.
- Don't add separate Next.js routes for tools — use the Dashboard view switcher unless explicitly requested.
- Don't parse `evals/results.csv` at runtime in the app — bundle snapshot in `evals-snapshot.ts`.
- Don't over-engineer abstractions for one-off helpers.

## Adding a new dashboard view

1. Create `src/components/views/<name>.tsx` (`"use client"` if interactive).
2. Add id to `View` type and `NAV_ITEMS` in `sidebar.tsx`.
3. Add case in `dashboard.tsx` `ViewContent` and `VIEW_TITLES`.
4. Update `README.md` features section if user-facing.
