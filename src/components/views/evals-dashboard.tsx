"use client";

import { KeyRound } from "lucide-react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EVAL_MODELS,
  TASK_TYPE_LABELS,
  getHeatmapData,
  getScatterData,
  getTaskRecommendations,
} from "@/lib/evals-snapshot";
import type { TaskType } from "@/lib/comparison-types";
import type { ComparisonModelId } from "@/lib/model-pricing";
import { cn } from "@/lib/utils";

const MODEL_LABELS: Record<ComparisonModelId, string> = {
  "claude-haiku-4-5": "Haiku 4.5",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "gpt-4o-mini": "GPT-4o Mini",
};

const TASK_TYPES = Object.keys(TASK_TYPE_LABELS) as TaskType[];

function scoreColor(score: number): string {
  if (score >= 8.5) return "bg-emerald-500/25 text-emerald-900 dark:text-emerald-100";
  if (score >= 7) return "bg-amber-500/20 text-amber-950 dark:text-amber-100";
  if (score >= 5.5) return "bg-orange-500/20 text-orange-950 dark:text-orange-100";
  return "bg-red-500/20 text-red-900 dark:text-red-100";
}

export function EvalsDashboard() {
  const heatmap = getHeatmapData();
  const scatter = getScatterData();
  const recommendations = getTaskRecommendations();

  function cellScore(model: ComparisonModelId, task: TaskType) {
    return heatmap.find((c) => c.model === model && c.task_type === task);
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="pr-40">
          <h2 className="text-2xl font-semibold tracking-tight">
            Evals Dashboard
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Snapshot results from 20 prompts × 3 models — judged by Claude
            Sonnet 4.6 against success criteria.
          </p>
        </div>
        <Badge
          variant="success"
          className="absolute right-0 top-0 gap-1.5 font-normal"
        >
          <KeyRound className="h-3 w-3" />
          No API key required
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Score heatmap</CardTitle>
          <CardDescription>
            Average judge score (1–10) by model and task type. Greener = higher.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Model</th>
                  {TASK_TYPES.map((task) => (
                    <th
                      key={task}
                      className="pb-3 pr-2 text-center font-medium"
                    >
                      {TASK_TYPE_LABELS[task]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EVAL_MODELS.map((model) => (
                  <tr
                    key={model}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium">{MODEL_LABELS[model]}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {model}
                      </p>
                    </td>
                    {TASK_TYPES.map((task) => {
                      const cell = cellScore(model, task);
                      if (!cell) return null;
                      return (
                        <td key={task} className="p-1">
                          <div
                            className={cn(
                              "rounded-md px-2 py-3 text-center font-mono font-semibold tabular-nums",
                              scoreColor(cell.avgScore)
                            )}
                            title={`${cell.passRate}% pass rate`}
                          >
                            {cell.avgScore.toFixed(1)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cost vs quality</CardTitle>
          <CardDescription>
            Average score (y) vs average cost per request (x) across all 20
            prompts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full min-w-0 shrink-0">
            <ResponsiveContainer width="100%" height="100%" debounce={50}>
              <ScatterChart margin={{ top: 12, right: 24, bottom: 8, left: 8 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  type="number"
                  dataKey="avgCost"
                  name="Avg cost"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v) => `$${v.toFixed(4)}`}
                  label={{
                    value: "Avg cost / request",
                    position: "insideBottom",
                    offset: -4,
                    className: "fill-muted-foreground text-[11px]",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="avgScore"
                  name="Avg score"
                  domain={[5, 10]}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  label={{
                    value: "Avg score",
                    angle: -90,
                    position: "insideLeft",
                    className: "fill-muted-foreground text-[11px]",
                  }}
                />
                <ZAxis range={[120, 120]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ payload }) => {
                    if (!payload?.[0]) return null;
                    const d = payload[0].payload as (typeof scatter)[0];
                    return (
                      <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
                        <p className="font-medium">{d.label}</p>
                        <p className="font-mono text-muted-foreground">
                          Score: {d.avgScore} · Cost: ${d.avgCost.toFixed(4)}
                        </p>
                        <p className="text-muted-foreground">
                          Pass rate: {d.passRate}%
                        </p>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={scatter}
                  fill="hsl(var(--foreground))"
                  fillOpacity={0.7}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            {scatter.map((point) => (
              <span key={point.model} className="font-mono">
                {point.label}: {point.avgScore}/10 @ ${point.avgCost.toFixed(4)}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {recommendations.map((rec) => (
          <Card key={rec.task_type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{rec.label}</CardTitle>
              <CardDescription>Model recommendation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-[11px]">
                  {rec.recommended}
                </Badge>
                <span className="text-sm font-medium">
                  {MODEL_LABELS[rec.recommended]}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{rec.reason}</p>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                {EVAL_MODELS.map((model) => (
                  <div
                    key={model}
                    className={cn(
                      "rounded-md border px-2 py-1.5",
                      model === rec.recommended && "border-foreground/30 bg-muted/50"
                    )}
                  >
                    <p className="text-muted-foreground">{MODEL_LABELS[model]}</p>
                    <p className="font-mono font-semibold tabular-nums">
                      {rec.scores[model]}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
