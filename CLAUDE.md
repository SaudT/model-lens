# ModelLens

LLM token analytics & model selection tooling (Next.js 16, React 19).

## Agent instructions

**Read [AGENTS.md](./AGENTS.md) before editing code.** It covers architecture, API key handling, server actions, evals, and conventions.

## Quick reference

| Tool | API keys | Key files |
|------|----------|-----------|
| Token Analyzer | None | `src/lib/tokenizer.ts`, `src/components/views/token-analyzer.tsx` |
| Model Comparison | localStorage → server actions | `src/app/actions/model-comparison.ts`, `src/components/views/model-comparison.tsx` |
| Cost Calculator | None | `src/lib/cost-models.ts`, `src/components/views/cost-calculator.tsx` |
| Evals Dashboard | None (CSV snapshot) | `src/lib/evals-snapshot.ts`, `evals/run_evals.ts` |

```bash
npm install && npm run dev    # UI at localhost:3000
npm run build                 # verify before done
npm run evals                 # batch evals; needs .env.eval at project root
```

## Critical rules

1. **Next.js 16** — check `node_modules/next/dist/docs/` if APIs differ from training data (see AGENTS.md).
2. **Model Comparison keys** — client localStorage only; pass to server actions as params. Never `process.env` for provider keys in that flow.
3. **Single-page dashboard** — views switch via React state, not App Router segments.
4. **Evals snapshot** — dashboard uses hardcoded `SNAPSHOT_CSV` in `evals-snapshot.ts`; update after `npm run evals`.

User docs: [README.md](./README.md)
