# ModelLens

**When is a small, locally runnable model good enough for a real workload?**

ModelLens is a local-first evaluation workbench for extracting structured invoice data. It compares a transparent rules baseline with local language models, validates their answers against known references, and exposes the failures behind the aggregate scores.

The goal is to practice and demonstrate AI evaluation: establish a baseline, define correctness, control experiment settings, inspect failure modes, and explain tradeoffs with evidence. No paid API or LLM judge is required for the Extraction Lab.

## Start without an API key

Requires Node.js 22+.

```sh
npm ci
npm run dev
```

Open http://localhost:3000 and select **Run experiment**. The default rules baseline runs entirely in your browser. Explore the dataset and expected answers, inspect failed fields, then export the run JSON.

The baseline recognizes explicit English field labels and US-style numbers. It deliberately has no semantic understanding, date-convention guessing, or locale inference. This makes its limitations visible before adding a model.

## Compare local models

Install [Ollama](https://ollama.com), then download whichever candidates you want to evaluate:

```sh
ollama pull llama3.2:3b
ollama pull qwen2.5:3b
# Optional, requires more memory:
ollama pull gemma2:9b
ollama serve
```

If the Ollama desktop app is already serving, a second `ollama serve` is unnecessary. In another terminal:

```sh
MODELLENS_ENABLE_OLLAMA=1 npm run dev
```

Select the installed candidates in Extraction Lab. Calls are sequential and go to `127.0.0.1:11434` **on the computer running Next.js**, not a remote visitor's computer. The feature is disabled unless explicitly enabled. Do not enable it on a public deployment. Model downloads are manual; ModelLens does not download weights.

Local inference has no per-request API fee. Hardware, electricity, model licensing, and memory requirements still apply. These named model versions are manageable starting candidates, not a claim that they are the latest or best models.

## Workload and success criteria

Dataset `invoices-v1.0.0` contains **12 hand-authored synthetic text invoices** in `src/lib/extraction/dataset.ts`:

- Clean layouts and missing fields
- Alternate labels, prose dates, and European number formatting
- Distractor amounts and identifiers
- Ambiguous dates and conflicting totals
- Untrusted instructions embedded in the document
- Unicode vendor names

Every answer must contain exactly six keys: `vendor`, `invoiceNumber`, `invoiceDate`, `dueDate`, `currency`, and `total`. All keys are required; missing or ambiguous values must be JSON `null`. Dates must be real ISO dates, currency an explicit uppercase three-letter code, and totals numeric with at most two decimal places. String values and identifiers are compared exactly; money uses a tiny floating-point tolerance, not rounding to the nearest cent.

A case passes only if its JSON and schema are valid, every field is correct, and generation completed normally. No model evaluates its own answer. Expected answers are never sent to the inference endpoint.

This is a development benchmark, not a representative production sample. It does not evaluate OCR or image/PDF reading. Model comparisons on 12 synthetic cases cannot establish general model superiority or production readiness. Extend the dataset and reserve a separate holdout before tuning prompts against it.

## Experiments and provenance

Choose one strategy per run:

- **Instructions only:** ask for the schema in the system prompt.
- **Instructions + example:** add one separate, synthetic worked example.
- **Instructions + JSON schema:** constrain Ollama's output format using the JSON schema.

Compare strategies by running separate experiments on the same cases and candidates. All local generations use temperature 0, seed 42, a 512-token output budget, and a 4,096-token context window. One to five repeats are supported. Fixed-seed repeats are stability checks, not independent statistical trials.

Run artifacts include the timestamp, dataset version and SHA-256, prompt/scorer versions, model tags and installed digests, settings, raw outputs, token counts when reported, finish reason, and field-level verdicts. Truncated answers fail explicitly. Request errors are distinct from answer failures. Unknown measurements remain null.

The browser checkpoints after each attempt and retains its eight most recent runs. Export JSON for a durable copy. Imported files must match the bundled dataset and experiment versions; the app recomputes verdicts from raw outputs. Imports are user-supplied evidence, not cryptographically authenticated results. Interrupted runs remain inspectable; restart an experiment to repeat it.

**Metrics:** exact pass rate includes request errors among attempted cases; field accuracy and schema validity use responses received. Coverage is completed generations / planned attempts. Latency includes local model lookup and potentially cold loading. p95 uses nearest-rank percentiles. A recommendation requires full generation coverage, the selected minimum pass rate, and the maximum p95 latency. Qualifying candidates are ordered by latency because their measured API fees are all zero; total operating cost is unmeasured.

## Reproduce from the command line

The default run makes no network requests:

```sh
npm run evals:extraction
```

To compare installed local models:

```sh
npm run evals:extraction -- --models baseline,llama3.2:3b,qwen2.5:3b --strategy schema --repeats 1
```

The CLI writes JSON checkpoints and a Markdown findings report to gitignored `evals/runs/`. Use `--out <directory>` to choose another destination. Import a JSON file into the UI to inspect it. Ctrl+C stops after the current request finishes; requests time out after 90 seconds. A provider failure stops the run and preserves completed rows. No paid fallback or automatic retry is used.

## Supporting tools

The existing Token Analyzer, paid Model Comparison, Cost Calculator, and legacy Evals remain accessible in the sidebar. Switching views preserves drafts and results for the lifetime of the page.

- **Token Analyzer:** `cl100k_base` exploration, not a universal Llama/Claude tokenizer or a billing prediction. Unicode fragments are grouped for accurate display. Special-token-like text is treated literally.
- **Paid Model Comparison:** explicitly uses your Anthropic/OpenAI keys. Incomplete answers are excluded from judging and value selection. Best value requires at least 7/10 and a score within one point of the best, then selects the cheapest eligible result.
- **Cost Calculator:** static list-price planning estimates. Gemini 1.5 Flash is excluded because it is retired; check current provider prices before planning production spend.
- **Legacy Evals:** unverified demo snapshot, clearly labeled. It is not evidence for the new extraction benchmark.

Paid comparison keys persist in browser localStorage. **They pass through the Next.js app server to providers when comparisons run.** Extraction Lab never reads or uses them. The legacy paid eval CLI uses a separate `.env.eval` file and can incur charges; it is not part of the free extraction workflow.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Tests cover reference consistency, strict grading, hallucinated/missing fields, malformed output, truncation, failure accounting, artifact validation, mocked Ollama behavior, Unicode tokenization, and value thresholds. CI runs these checks without provider keys. System fonts avoid network-dependent builds.

## Next research questions

1. Which failure categories improve with examples or schema constraints?
2. Do observed improvements persist on an unseen invoice set?
3. Can a conservative rules-first pipeline safely abstain on difficult cases?
4. On the same held-out cases, does a paid model improve cost per successful extraction enough to justify its cost?

Keep experiment outputs and negative results. A defensible explanation of where an approach fails is more useful than a universal leaderboard claim.
