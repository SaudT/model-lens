# ModelLens — Session Handoff

Use this doc to start a new chat and continue work without re-explaining context.

---

## Project summary

**ModelLens** is a local-first Next.js dashboard for LLM token analytics and model selection.

- **Stack:** Next.js 16, React 19, Tailwind 4, shadcn/ui, js-tiktoken, recharts, tsx (eval CLI)
- **Entry:** `src/app/page.tsx` → `<Dashboard />` (single-page app; sidebar switches views, not routes)
- **Agent docs:** `AGENTS.md` (full guide), `CLAUDE.md` (quick reference), `README.md` (user docs)

---

## Four dashboard views

| View | API keys? | Purpose |
|------|-----------|---------|
| **Token Analyzer** | No | Client-side `cl100k_base` tokenization (js-tiktoken); colored chips, density benchmarks |
| **Model Comparison** | Anthropic and/or OpenAI (localStorage → server actions) | Parallel compare Haiku 4.5, Sonnet 4.6, GPT-4o Mini; judge + Best value |
| **Cost Calculator** | No | Sliders + 6-model pricing estimates + bar chart + task profiles |
| **Evals Dashboard** | No (static snapshot) | Heatmap, cost vs quality scatter, recommendations from baked CSV |

**Gemini key** is in Settings and Cost Calculator pricing only — **not** used in Model Comparison or `npm run evals`.

---

## API keys — two separate systems

| Context | Storage | Used by |
|---------|---------|---------|
| Browser UI | `localStorage` key `modelLens_keys` via **API Key Settings** | Model Comparison |
| Eval CLI | `.env.eval` at project root (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) | `npm run evals` |

**Model Comparison rule:** keys read on client, passed as **parameters** to server actions — **never** `process.env` for provider keys in that flow.

Get keys:
- OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys) (`sk-...`)
- Anthropic: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) (`sk-ant-...`)
- Gemini (optional): [Google AI Studio](https://aistudio.google.com/apikey) (`AIza...`)

---

## Model Comparison — how it works

### Flow
1. User picks **task type** (card UI with checkmark / “Active” / “Selected: …” label)
2. User enters prompt → **Compare Models**
3. Server actions call each model with `TASK_INSTRUCTIONS[taskType]` as system prompt
4. If Anthropic key present: **Sonnet 4.6 judges** all successful outputs → JSON scores 1–10
5. **Best value** badge = highest `qualityScore / costUsd` (efficiency)

### Task types
`summarization` | `code-generation` | `reasoning` | `data-extraction`

### Quality scoring
- **LLM-as-judge** (Sonnet 4.6), subjective, not ground truth
- Sees: original prompt, task type, all model outputs
- Returns: `{"claude-haiku-4-5": 7, ...}` (1–10)
- Skipped if no Anthropic key
- Sonnet also competes (potential bias)

### Cost
- From API `usage` tokens × **hardcoded** rates in `src/lib/model-pricing.ts`
- Not live provider billing

### Efficiency
```
efficiency = judgeScore / costUsd   → displayed as "pts/$"
Best value = max(efficiency) among models with score, no error, cost > 0
```

### Key files
- `src/components/views/model-comparison.tsx`
- `src/app/actions/model-comparison.ts`
- `src/lib/comparison-types.ts` (task instructions)
- `src/lib/api-errors.ts` (invalid_key, rate_limit, network)

---

## Token Analyzer — key concepts

- Uses **`cl100k_base`** (OpenAI-style: GPT-4, GPT-3.5-turbo) — **not** identical to Anthropic’s tokenizer
- Each chip = one BPE **token** (subword), not one word
- `#index · id N` tooltip = position in sequence + vocabulary ID
- **3–5× output pricing** = **dollars per token**, not token count; input often > output tokens in real prompts

---

## Cost Calculator

- 6 models in `src/lib/cost-models.ts` (includes Gemini 1.5 Flash, Opus 4.6)
- Task profiles preset sliders (High Volume Simple, Balanced, Complex Reasoning, Agentic)
- UI polish: clickable profile cards, draggable sliders (dark thumb + grip lines), pricing callout clarifies 3–5× is **price** not count

---

## Evals system

### Files
- `evals/prompts.json` — 20 prompts (5 × 4 task types) with `success_criteria`
- `evals/run_evals.ts` — CLI: sequential runs, Sonnet judge per response, writes CSV
- `evals/results.csv` — 60 rows (20 prompts × 3 models)
- `src/lib/evals-snapshot.ts` — **`SNAPSHOT_CSV`** string hardcoded for Evals Dashboard UI

### Run evals
```bash
cp evals/env.eval.example .env.eval   # add keys
npm run evals
# Then copy evals/results.csv into SNAPSHOT_CSV in evals-snapshot.ts to refresh dashboard
```

### Trust / limitations
- **Evals Dashboard does NOT call APIs** — shows committed snapshot only
- Prompts **not visible in UI** — only in `evals/prompts.json`
- Custom prompts → use **Model Comparison**, not Evals
- Initial snapshot may be representative/demo data until user runs `npm run evals` with real keys

---

## UI polish done this session

- App header: **ModelLens** + subtitle; onboarding banner (dismissable, `modelLens_onboarding_dismissed`)
- Model Comparison: loading skeletons, typed API errors, copy prompt, **task type cards** (clear selection)
- Cost Calculator: profile cards, slider affordances, pricing callout fix
- Evals Dashboard view + sidebar nav
- Fixed **Maximum update depth** loop (Recharts debounce, stable `useApiKeys`, onboarding effect)

---

## Commands

```bash
npm install
npm run dev          # http://localhost:3000 — no .venv, Node only
npm run build
npm run evals        # needs .env.eval
npm run lint
```

---

## Important file map

```
src/
  app/actions/model-comparison.ts   # Server actions (compare + judge)
  components/views/                 # token-analyzer, model-comparison, cost-calculator, evals-dashboard
  components/dashboard/             # shell, sidebar, api-key-settings, onboarding-banner
  hooks/use-api-keys.ts             # localStorage sync
  lib/tokenizer.ts                  # cl100k_base client tokenization
  lib/model-pricing.ts              # 3 comparison models
  lib/cost-models.ts                # 6 calculator models + task profiles
  lib/evals-snapshot.ts             # Dashboard CSV snapshot
evals/
  prompts.json, run_evals.ts, results.csv, env.eval.example
AGENTS.md, CLAUDE.md, README.md
```

---

## Git / resume context

- Commits include Token Analyzer, Model Comparison, Cost Calculator, evals, polish, `AGENTS.md` updates
- **Resume:** ModelLens as AI eval tool; Anthropic + OpenAI APIs; 20-prompt eval harness; judge scoring; cost-efficiency
- **Skills:** list Python/FastAPI from work; TypeScript on project header only if you can discuss it — don’t claim TS in Skills if not comfortable
- **Removed from resume:** Assistive Bocce Ball; NASA kept in certs/awards only
- **Anthropic Fellows:** Economics / AI Safety workstreams fit best; eval methodology + token economics narrative

---

## Testing checklist (no keys)

- [x] Token Analyzer — paste text, see chips + stats
- [x] Cost Calculator — sliders, profiles, chart, table
- [x] Evals Dashboard — heatmap, scatter hover, recommendation cards (read-only)
- [ ] Model Comparison — needs keys in Settings; smoke prompt: one-sentence summarization

## Testing with keys

- Settings → Anthropic + OpenAI → Compare Models → check cards, judge row, Best value
- `.env.eval` → `npm run evals` → update `SNAPSHOT_CSV` if refreshing Evals Dashboard

---

## Known limitations / future improvements

- Server actions receive keys from client (OK for local tool; not multi-tenant production pattern)
- Evals Dashboard: no prompt list, no provenance date, no in-app re-run
- Model Comparison judge has no explicit `success_criteria` (evals CLI does)
- `src/lib/api-clients.ts` — legacy, unused by Model Comparison
- Optional: port `run_evals.ts` to Python for Fellows; public GitHub + blog post on findings

---

## Concepts explained in session (for interviews)

1. **Vocab size (~100k)** vs **prompt token count** vs **3–5× output price**
2. BPE tokenization: deterministic, not word-based; spaces matter (`fire truck` vs `firetruck`)
3. **Best model depends on metric** — Sonnet on quality, Haiku/Mini on cost-efficiency for structured tasks
4. Format (JSON/code) affects token count more than word count

---

*Last updated: session handoff after Model Comparison task UI fix, Cost Calculator slider polish, evals trust discussion, and API key setup guidance.*
