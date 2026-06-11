"use client";

import { useMemo, useState } from "react";
import { Crown, Info, KeyRound, Loader2 } from "lucide-react";

import {
  judgeComparisonOutputs,
  runComparisonModel,
} from "@/app/actions/model-comparison";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  TASK_TYPES,
  type JudgeResult,
  type ModelRunResult,
  type TaskType,
} from "@/lib/comparison-types";
import {
  COMPARISON_MODELS,
  formatCostUsd,
  type ComparisonModelId,
} from "@/lib/model-pricing";
import { useApiKeys } from "@/hooks/use-api-keys";
import { cn } from "@/lib/utils";

const JUDGE_MODEL = "claude-sonnet-4-6";

type ResultMap = Partial<Record<ComparisonModelId, ModelRunResult>>;

function hasKeyForModel(
  modelId: ComparisonModelId,
  keys: { anthropic?: string; openai?: string }
): boolean {
  const model = COMPARISON_MODELS.find((m) => m.id === modelId);
  if (!model) return false;
  return Boolean(keys[model.keyProvider]?.trim());
}

function computeWinner(
  results: ResultMap,
  scores: JudgeResult["scores"]
): ComparisonModelId | null {
  let best: ComparisonModelId | null = null;
  let bestEfficiency = -1;

  for (const model of COMPARISON_MODELS) {
    const result = results[model.id];
    const score = scores[model.id];
    if (!result || result.error || score == null || result.costUsd <= 0) {
      continue;
    }
    const efficiency = score / result.costUsd;
    if (efficiency > bestEfficiency) {
      bestEfficiency = efficiency;
      best = model.id;
    }
  }

  return best;
}

export function ModelComparison() {
  const [prompt, setPrompt] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("summarization");
  const [results, setResults] = useState<ResultMap>({});
  const [judge, setJudge] = useState<JudgeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [judging, setJudging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { keys, isConnected } = useApiKeys();
  const hasAnthropic = isConnected("anthropic");
  const hasOpenAI = isConnected("openai");
  const canRun = hasAnthropic || hasOpenAI;

  const winner = useMemo(
    () => (judge ? computeWinner(results, judge.scores) : null),
    [results, judge]
  );

  async function runComparison() {
    if (!prompt.trim() || !canRun) return;

    setLoading(true);
    setJudging(false);
    setError(null);
    setResults({});
    setJudge(null);

    try {
      const tasks = COMPARISON_MODELS.filter((model) =>
        hasKeyForModel(model.id, keys)
      ).map((model) =>
        runComparisonModel({
          modelId: model.id,
          prompt: prompt.trim(),
          taskType,
          apiKey: keys[model.keyProvider]!.trim(),
        })
      );

      const runResults = await Promise.all(tasks);
      const nextResults: ResultMap = {};
      for (const result of runResults) {
        nextResults[result.modelId] = result;
      }
      setResults(nextResults);

      const failures = runResults.filter((r) => r.error).map((r) => r.error!);
      if (failures.length > 0) {
        setError(failures.join("; "));
      }

      const successful = runResults.filter((r) => !r.error && r.response);
      if (hasAnthropic && successful.length > 0) {
        setJudging(true);
        const judgeResult = await judgeComparisonOutputs({
          prompt: prompt.trim(),
          taskType,
          apiKey: keys.anthropic!.trim(),
          outputs: successful.map((r) => ({
            modelId: r.modelId,
            response: r.response,
          })),
        });
        setJudge(judgeResult);
        if (judgeResult.error) {
          setError((prev) =>
            prev
              ? `${prev}; Judge: ${judgeResult.error}`
              : `Judge: ${judgeResult.error}`
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
      setJudging(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Model Comparison
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run the same prompt across Haiku, Sonnet, and GPT-4o Mini side by
          side.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Your API keys are passed directly to each provider. Estimated cost for
          this comparison: ~$0.01
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prompt</CardTitle>
          <CardDescription>
            Choose a task type and enter a prompt to compare models.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Task type
            </span>
            <div className="inline-flex flex-wrap rounded-md border bg-muted/40 p-0.5">
              {TASK_TYPES.map(({ id, label }) => (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 px-3 text-xs",
                    taskType === id &&
                      "bg-background shadow-sm hover:bg-background"
                  )}
                  onClick={() => setTaskType(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="compare-prompt">Prompt</Label>
            <textarea
              id="compare-prompt"
              className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Enter a prompt to compare models..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <Button
            onClick={runComparison}
            disabled={!prompt.trim() || loading || !canRun}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Compare Models
          </Button>

          {!canRun && (
            <p className="text-sm text-muted-foreground">
              Add an Anthropic and/or OpenAI key in Settings to run comparisons.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </CardContent>
      </Card>

      {(Object.keys(results).length > 0 || loading) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {COMPARISON_MODELS.map((model) => {
            const connected = hasKeyForModel(model.id, keys);
            const result = results[model.id];
            const isWinner = winner === model.id;

            return (
              <Card
                key={model.id}
                className={cn(
                  "relative flex flex-col",
                  !connected && "opacity-50",
                  isWinner && "ring-2 ring-amber-500/60"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{model.label}</CardTitle>
                      <CardDescription className="font-mono text-[11px]">
                        {model.id}
                      </CardDescription>
                    </div>
                    {isWinner && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      >
                        <Crown className="h-3 w-3" />
                        Best value
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-3">
                  {!connected ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed py-10 text-center">
                      <KeyRound className="h-5 w-5 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Add API key in Settings
                      </p>
                    </div>
                  ) : loading && !result ? (
                    <div className="flex flex-1 items-center justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : result?.error ? (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {result.error}
                    </p>
                  ) : result ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <Metric
                          label="Input tokens"
                          value={result.inputTokens.toLocaleString()}
                        />
                        <Metric
                          label="Output tokens"
                          value={result.outputTokens.toLocaleString()}
                        />
                        <Metric
                          label="Latency"
                          value={`${result.latencyMs.toLocaleString()} ms`}
                        />
                        <Metric
                          label="Est. cost"
                          value={formatCostUsd(result.costUsd)}
                          mono
                        />
                      </div>
                      <div className="max-h-[320px] flex-1 overflow-auto rounded-md border bg-muted/20 p-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {result.response || "(empty response)"}
                        </p>
                      </div>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {judge && Object.keys(judge.scores).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quality scores</CardTitle>
            <CardDescription>
              Rated 1–10 by {JUDGE_MODEL} for{" "}
              {TASK_TYPES.find((t) => t.id === taskType)?.label.toLowerCase()}{" "}
              ({judge.latencyMs.toLocaleString()} ms)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-3">
              {COMPARISON_MODELS.map((model) => {
                const score = judge.scores[model.id];
                const result = results[model.id];
                const efficiency =
                  score != null && result && result.costUsd > 0
                    ? score / result.costUsd
                    : null;

                return (
                  <div
                    key={model.id}
                    className="rounded-md border px-4 py-3"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {model.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">
                      {score != null ? (
                        <>
                          {score}
                          <span className="text-sm font-normal text-muted-foreground">
                            /10
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </p>
                    {efficiency != null && (
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                        efficiency: {efficiency.toFixed(0)} pts/$
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {judging && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Judging outputs with Claude Sonnet 4.6…
        </p>
      )}

      {!hasAnthropic && Object.keys(results).length > 0 && (
        <p className="text-sm text-muted-foreground">
          Quality scoring skipped — Anthropic API key required for judging.
        </p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md bg-muted/40 px-2.5 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          mono && "font-mono"
        )}
      >
        {value}
      </p>
    </div>
  );
}
