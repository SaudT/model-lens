"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Crown,
  Info,
  KeyRound,
  Loader2,
  WifiOff,
} from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import {
  TASK_TYPES,
  type JudgeResult,
  type ModelRunResult,
  type TaskType,
} from "@/lib/comparison-types";
import type { ApiErrorKind } from "@/lib/api-errors";
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
  const [copied, setCopied] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  const { keys, isConnected } = useApiKeys();
  const hasAnthropic = isConnected("anthropic");
  const hasOpenAI = isConnected("openai");
  const canRun = hasAnthropic || hasOpenAI;

  const winner = useMemo(
    () => (judge ? computeWinner(results, judge.scores) : null),
    [results, judge]
  );

  async function copyPrompt() {
    if (!prompt.trim()) return;
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function runComparison() {
    if (!prompt.trim() || !canRun) return;

    setLoading(true);
    setJudging(false);
    setResults({});
    setJudge(null);
    setHasCompared(true);

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
      }
    } catch {
      // Individual model errors are captured per card
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
            <div className="flex items-center justify-between">
              <Label htmlFor="compare-prompt">Prompt</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={!prompt.trim()}
                onClick={copyPrompt}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy prompt
                  </>
                )}
              </Button>
            </div>
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
        </CardContent>
      </Card>

      {(hasCompared || loading) && (
        <div className="grid gap-4 lg:grid-cols-3">
          {COMPARISON_MODELS.map((model) => {
            const connected = hasKeyForModel(model.id, keys);
            const result = results[model.id];
            const isWinner = winner === model.id;
            const isLoadingCard = loading && connected && !result;

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
                  ) : isLoadingCard ? (
                    <ComparisonCardSkeleton />
                  ) : result?.error ? (
                    <ApiErrorState
                      kind={result.errorKind ?? "unknown"}
                      message={result.error}
                    />
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

      {judge?.error && (
        <ApiErrorState kind={judge.errorKind ?? "unknown"} message={judge.error} />
      )}

      {judging && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Judging outputs with Claude Sonnet 4.6…
        </p>
      )}

      {!hasAnthropic && hasCompared && !loading && (
        <p className="text-sm text-muted-foreground">
          Quality scoring skipped — Anthropic API key required for judging.
        </p>
      )}
    </div>
  );
}

function ComparisonCardSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-md" />
        ))}
      </div>
      <Skeleton className="min-h-[200px] flex-1 rounded-md" />
    </div>
  );
}

function ApiErrorState({
  kind,
  message,
}: {
  kind: ApiErrorKind;
  message: string;
}) {
  const Icon =
    kind === "network"
      ? WifiOff
      : kind === "rate_limit"
        ? Loader2
        : AlertCircle;

  const titles: Record<ApiErrorKind, string> = {
    invalid_key: "Invalid API key",
    rate_limit: "Rate limited",
    network: "Network error",
    unknown: "Request failed",
  };

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 py-10 text-center",
        kind === "invalid_key" && "border-red-500/30 bg-red-500/5",
        kind === "rate_limit" && "border-amber-500/30 bg-amber-500/5",
        kind === "network" && "border-orange-500/30 bg-orange-500/5"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5",
          kind === "invalid_key" && "text-red-600 dark:text-red-400",
          kind === "rate_limit" && "text-amber-600 dark:text-amber-400",
          kind === "network" && "text-orange-600 dark:text-orange-400",
          kind === "unknown" && "text-muted-foreground"
        )}
      />
      <p className="text-sm font-medium">{titles[kind]}</p>
      <p className="max-w-[220px] text-xs text-muted-foreground">{message}</p>
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
