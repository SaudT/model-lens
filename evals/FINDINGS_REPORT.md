# ModelLens Evaluation Findings Report

**Author:** Saud Tahir  
**Date:** June 12, 2026  
**Data source:** `evals/results.csv` (full eval suite run via `npm run evals`)  
**Models evaluated:** Claude Haiku 4.5, Claude Sonnet 4.6, GPT-4o Mini

---

## Executive Summary

ModelLens is a local-first dashboard for LLM token analytics and model selection. This report summarizes findings from a structured evaluation of three frontier models across **20 curated prompts** in **four workload categories**: summarization, code generation, reasoning, and structured data extraction.

**Headline result:** Quality scores were tightly clustered (9.25–9.65 average on a 1–10 scale), but **cost and latency diverged sharply**. GPT-4o Mini delivered the **highest or tied-highest quality on 16 of 20 prompts** at roughly **1/37th the total cost** of Claude Sonnet 4.6 across the full suite. Sonnet justified its premium primarily on **code generation**, where it achieved the highest average score (9.6) and won more head-to-head quality comparisons than any other model. Haiku 4.5 occupied a practical middle tier: **within 0.4 quality points of Sonnet overall**, at ~3.6× lower cost, with the **fastest latency on extraction tasks**.

**Practical recommendation:** Route by workload, not by a single “best model.” Use GPT-4o Mini for high-volume summarization and JSON extraction; use Sonnet for complex code generation where output completeness matters; use Haiku when staying in the Anthropic ecosystem with balanced cost and speed.

---

## 1. Methodology

### 1.1 Prompt suite

Each of the 20 prompts includes explicit **success criteria** (e.g., “must return valid JSON with fields X, Y, Z” or “correct answer is $0.05, not $0.10”). Prompts span realistic enterprise scenarios: meeting summaries, executive report compression, Python/TypeScript/SQL/React/Bash generation, classic reasoning puzzles, and structured extraction from invoices, resumes, events, and logs.

| Task type | Prompts | Example workloads |
|-----------|---------|-------------------|
| Summarization | 5 | Article bullets, meeting notes, earnings summaries, debate summaries, changelog for stakeholders |
| Code generation | 5 | Palindrome function, debounce hook, SQL window query, React `useLocalStorage`, Bash security scan |
| Reasoning | 5 | Bat-and-ball puzzle, jug problem, three switches, syllogism, river crossing |
| Data extraction | 5 | Emails/phones, invoice line items, resume parsing, event metadata, log parsing |

### 1.2 Execution and scoring

For each prompt, all three models ran sequentially with the same task-type system instruction. **Claude Sonnet 4.6** served as an **LLM-as-judge**, scoring each response 1–10 against the prompt’s success criteria and assigning pass/fail (pass threshold: score ≥ 7 when criteria are substantially met).

### 1.3 Metrics captured

- **Quality:** Judge score (1–10) and pass/fail  
- **Cost:** Estimated USD from actual input/output token counts × list prices in `src/lib/model-pricing.ts` (verified June 12, 2026)  
- **Latency:** End-to-end response time in milliseconds  
- **Cost-efficiency:** `qualityScore / costUsd` (quality points per dollar)

### 1.4 Pricing basis (per 1M tokens)

| Model | Input | Output |
|-------|------:|-------:|
| Claude Haiku 4.5 | $1.00 | $5.00 |
| Claude Sonnet 4.6 | $3.00 | $15.00 |
| GPT-4o Mini | $0.15 | $0.60 |

Output tokens are priced **3–5× higher** than input tokens across providers, meaning verbose models can cost disproportionately more even when quality is similar.

---

## 2. Overall Results

### 2.1 Aggregate performance

| Model | Avg score | Pass rate | Avg cost / request | Total suite cost | Avg latency | Cost-efficiency (pts/$) |
|-------|----------:|----------:|-------------------:|-----------------:|------------:|------------------------:|
| **GPT-4o Mini** | **9.65** | 100% | $0.000149 | **$0.0030** | 4,096 ms | **64,592** |
| Claude Sonnet 4.6 | 9.60 | 100% | $0.005531 | $0.1106 | 6,371 ms | 1,736 |
| Claude Haiku 4.5 | 9.35 | 100% | $0.001533 | $0.0307 | 2,581 ms | 6,099 |

All models passed every prompt in this run (minimum score: 8). The quality gap between the cheapest and most expensive model was **0.30 points** on average — far smaller than the **37× cost gap** between Sonnet and GPT-4o Mini for the full 20-prompt suite.

### 2.2 Head-to-head quality wins

When comparing highest judge score per prompt:

| Model | Prompts with highest score |
|-------|---------------------------:|
| GPT-4o Mini | **16** |
| Claude Sonnet 4.6 | 15 |
| Claude Haiku 4.5 | 12 |

*(Ties are counted for each tied model; many prompts had multiple models at the same top score.)*

---

## 3. When Each Model Performs Best

### 3.1 GPT-4o Mini — best default for volume and structured output

**Best for:** Summarization, data extraction, and any high-throughput workload where cost-efficiency dominates.

| Task type | Avg score | Avg cost | Cost-efficiency | Verdict |
|-----------|----------:|---------:|----------------:|---------|
| Summarization | **9.8** | $0.000069 | 142,857 pts/$ | Highest quality *and* lowest cost |
| Data extraction | **10.0** | $0.000069 | 144,092 pts/$ | Perfect average; ideal for JSON/entity parsing |
| Code generation | 9.2 | $0.000194 | 47,472 pts/$ | Matches Haiku quality at ~1/15th of Sonnet cost |
| Reasoning | 9.6 | $0.000266 | 36,117 pts/$ | Tied for top quality; 23× cheaper than Sonnet |

**Why it wins:** GPT-4o Mini consistently produced **concise, criteria-aligned outputs** — especially JSON and bullet summaries — keeping output token counts low (227 avg vs. 351 for Sonnet). On extraction tasks it achieved a **perfect 10.0 average** across all five prompts.

**Projected cost example:** At 10,000 summarization requests per day using this suite’s average token profile, GPT-4o Mini would cost roughly **$21/month** vs. **$585/month** for Sonnet — a **28× difference** for comparable quality on these prompts.

**Caveat:** On `code-05` (Bash script with `find`, depth limits, and security warnings), Mini scored 8/10 — tied with Sonnet but below Haiku (9/10). For multi-step shell scripts with edge-case handling, Mini is not clearly superior.

---

### 3.2 Claude Sonnet 4.6 — best for complex code generation

**Best for:** Production code tasks where completeness and correctness matter more than unit economics.

| Task type | Avg score | Avg cost | Cost-efficiency | Verdict |
|-----------|----------:|---------:|----------------:|---------|
| Code generation | **9.6** | $0.011125 | 863 pts/$ | **Highest quality**; 3× cost of Haiku, 57× cost of Mini |
| Data extraction | 9.8 | $0.002939 | 3,335 pts/$ | Strong quality; 43× more expensive than Mini per request |
| Summarization | 9.4 | $0.001950 | 4,821 pts/$ | Solid but never beat Mini on average |
| Reasoning | 9.6 | $0.006110 | 1,571 pts/$ | Tied quality; slowest avg latency in category |

**Why it wins:** Sonnet produced the most **complete code artifacts** on harder prompts — TypeScript generics with `.cancel()`, SQL window functions, React hooks with error handling. It won the most outright quality comparisons on code-generation prompts.

**Critical finding — output verbosity tax:** On `code-04` (React `useLocalStorage` hook) and `code-05` (Bash security script), Sonnet hit **1,024 output tokens** — likely at or near the configured max — producing **$0.0156 per request** (~81× more than Mini on the same Bash prompt) with **16.3 seconds latency** and a score of only **8/10**. Haiku scored **9/10** on the same Bash prompt at **$0.0029** with 569 output tokens.

**Implication:** For code tasks, Sonnet’s higher list price is compounded by longer outputs. Setting explicit `max_tokens` and concise-output instructions may reduce spend more than switching models in some cases.

---

### 3.3 Claude Haiku 4.5 — best balance in the Anthropic stack

**Best for:** Anthropic-only environments, latency-sensitive extraction, and workloads needing near-Sonnet quality at lower cost.

| Task type | Avg score | Avg cost | Cost-efficiency | Verdict |
|-----------|----------:|---------:|----------------:|---------|
| Data extraction | 9.6 | $0.000710 | 13,529 pts/$ | **Fastest latency** (1,083 ms avg); 10× cheaper than Sonnet |
| Reasoning | 9.6 | $0.001847 | 5,199 pts/$ | Tied top quality; 3.3× cheaper than Sonnet |
| Code generation | 9.2 | $0.002921 | 3,149 pts/$ | Beat Sonnet on `code-05`; lost on longest outputs |
| Summarization | 9.0 | $0.000655 | 13,740 pts/$ | Lowest summarization quality of the three; still passed all prompts |

**Why it matters:** Haiku delivered **within 0.25 points of Sonnet** on reasoning and extraction while costing **~3.6× less** overall. On data extraction it was **2× faster than Mini** (1,083 ms vs. 2,030 ms) — the only category where Haiku led on latency.

**Weak spots:** Haiku scored lowest on `sum-01` (8/10, tied with Sonnet) and `ext-02` (invoice line-item extraction, 8/10 vs. Mini’s 10/10). Structured extraction with nuanced field mapping slightly favored Mini.

---

## 4. Cross-Cutting Findings

### 4.1 Quality is converging; economics are not

On this prompt suite, all three models achieved **100% pass rate** with average scores above 9.2. The decision axis is not “can the model do the task?” but **“what does it cost to do it at scale, and how fast?”** A 0.3-point quality difference may not justify a 37× cost multiplier for bulk summarization or extraction pipelines.

### 4.2 Output length drives cost more than input length

Code-generation tasks showed the widest cost spread. Sonnet’s average output (351 tokens overall; up to 1,024 on code tasks) combined with **$15/1M output pricing** made it the most expensive model by far ($0.1106 total vs. $0.0030 for Mini). Models that “over-explain” or hit token ceilings pay a double penalty: more output tokens at a higher rate.

### 4.3 Task type strongly affects model ranking

| If your workload is… | Recommended model | Rationale |
|----------------------|-------------------|-----------|
| High-volume summarization | GPT-4o Mini | 9.8 avg score, $0.00007/request |
| JSON / entity extraction | GPT-4o Mini | 10.0 avg score; lowest cost |
| Complex TypeScript / React / SQL | Claude Sonnet 4.6 | Highest code-gen score (9.6) |
| Bash / ops scripting | Claude Haiku 4.5 | Beat Sonnet on `code-05` at 5× lower cost |
| Reasoning (puzzles, logic) | Any of the three | All averaged 9.6; Mini is 23× cheaper than Sonnet |
| Latency-critical extraction | Claude Haiku 4.5 | 1,083 ms avg vs. 2,030 ms (Mini) and 3,214 ms (Sonnet) |
| Anthropic-only compliance | Haiku → Sonnet tiered | Haiku for bulk; Sonnet for hard code |

### 4.4 Tokenization and billing (from Token Analyzer)

Separate from the eval run, ModelLens’s client-side `cl100k_base` tokenization surfaced additional billing insights relevant to model selection:

1. **Format beats word count.** Identical semantic content in JSON or code can consume **1.5–2× the tokens** of equivalent prose because BPE tokenizers split symbols aggressively.
2. **Small string changes change the bill.** `"fire truck"` vs. `"firetruck"`, camelCase vs. snake_case in schemas, and leading whitespace can shift token counts enough to matter at scale.
3. **Always tokenize the actual payload.** Cost estimates based on word count alone systematically under- or over-estimate API spend.

These effects are tokenizer-specific (`cl100k_base` approximates OpenAI-style billing; Anthropic’s tokenizer differs slightly) but the directional finding holds: **measure tokens on representative payloads**, not approximations.

### 4.5 LLM-as-judge limitations

Scores in this report are **subjective and non-deterministic**. The judge (Sonnet 4.6) also competed as an evaluated model, introducing potential self-favor bias. Scores reflect adherence to stated success criteria, not ground-truth correctness verified by human review or unit tests. Rerunning the suite may shift individual scores by ±1 point.

---

## 5. Notable Edge Cases

| Prompt | Observation |
|--------|-------------|
| **sum-01** | Lowest scores in the suite (8/10) for both Haiku and Sonnet; Mini scored 10/10 on the JWST article summarization task. |
| **code-04** | Haiku generated 1,006 output tokens ($0.0051) — verbose for a React hook; Sonnet hit 1,024 tokens ($0.0156). Mini completed in 406 tokens ($0.00025). |
| **code-05** | Sonnet scored **lowest** (8/10) despite highest cost and longest latency; Haiku won on quality (9/10) and cost. |
| **ext-02** | Invoice line-item extraction: Mini 10, Sonnet 9, Haiku 8 — structured parsing with implicit shipping quantity favored Mini. |
| **reas-03** | Haiku scored 8/10 on the three-switches puzzle; Sonnet and Mini scored 10/10. Classic reasoning trap. |

---

## 6. Recommendations

### 6.1 Model routing strategy

```
                    ┌─────────────────────────────────────┐
                    │         Incoming LLM request         │
                    └─────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
        Summarization /          Code generation         Data extraction
        high-volume text         (complex)               (JSON / entities)
              │                       │                       │
              ▼                       ▼                       ▼
         GPT-4o Mini            Claude Sonnet 4.6         GPT-4o Mini
         (quality + cost)       (+ max_tokens cap)       (perfect avg)
              │                       │
              │                 Simple / scripts
              │                       │
              │                       ▼
              │                 Claude Haiku 4.5
              │
        Anthropic-only? ──yes──► Haiku (bulk) / Sonnet (hard tasks)
```

### 6.2 Cost controls beyond model choice

1. **Set `max_tokens`** on code and reasoning tasks to prevent 1,024-token ceiling hits.  
2. **Tokenize real payloads** before estimating monthly spend (use Token Analyzer on production samples).  
3. **Prefer structured output formats** (JSON schema instructions) — Mini excelled here with minimal tokens.  
4. **Re-evaluate quarterly** — list prices and model tiers change; ModelLens pricing registry includes `lastVerified` dates.

### 6.3 When to pay for Sonnet

Sonnet is worth the premium when:
- Code output must include generics, error handling, and edge cases in one shot  
- Failure cost (bad SQL, broken hook) exceeds API cost difference  
- You need the strongest single-model quality on hard code-gen without routing logic  

Sonnet is hard to justify when:
- Running thousands of summarization or extraction calls daily  
- Quality differences are within judge noise (±1 point)  
- Latency and cost SLAs matter more than marginal quality gains  

---

## 7. Limitations and Future Work

- **Sample size:** 20 prompts (5 per task type) is directionally useful but not statistically exhaustive. Production routing should validate on domain-specific payloads.  
- **Single judge:** All scores come from one LLM evaluator with known bias risks. Human-labeled gold sets or execution-based code tests would strengthen code-gen conclusions.  
- **Three models only:** Gemini 1.5 Flash and Claude Opus 4.6 are in the Cost Calculator but were not in this comparison run.  
- **No multimodal or agentic prompts:** Results apply to text-in/text-out workloads, not tool-use or multi-turn agent loops.  
- **Snapshot vs. live API:** Evals Dashboard displays committed CSV data; Model Comparison runs live against provider APIs.

---

## 8. Summary Table — Model Selection Quick Reference

| Priority | Choose GPT-4o Mini | Choose Claude Haiku 4.5 | Choose Claude Sonnet 4.6 |
|----------|--------------------|-------------------------|---------------------------|
| **Lowest cost** | ✓ Best | Good | ✗ 37× vs Mini (suite total) |
| **Highest quality** | ✓ Tied best overall | Good | ✓ Best on code-gen |
| **Best cost-efficiency** | ✓ Dominant | Good | ✗ Lowest pts/$ |
| **Fastest extraction** | Moderate | ✓ Fastest | Slowest |
| **Complex code** | Good (9.2) | Good (9.2) | ✓ Best (9.6) |
| **Anthropic ecosystem** | N/A | ✓ Default | Premium tier |

---

*Report generated from ModelLens eval suite data. To reproduce: configure `.env.eval`, run `npm run evals`, and analyze `evals/results.csv`. For interactive exploration, use the ModelLens Evals Dashboard and Model Comparison views.*
