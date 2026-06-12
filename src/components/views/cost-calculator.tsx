"use client";

import { useMemo, useState } from "react";
import { Info, KeyRound } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  TASK_PROFILES,
  computeModelCosts,
  formatCost,
  type TaskProfileId,
} from "@/lib/cost-models";
import { cn } from "@/lib/utils";

const DEFAULT_PROFILE: TaskProfileId = "balanced";
const defaultProfile = TASK_PROFILES.find((p) => p.id === DEFAULT_PROFILE)!;

const SLIDER_LIMITS = {
  dailyRequests: { min: 10, max: 50_000, step: 10 },
  inputTokens: { min: 100, max: 32_000, step: 100 },
  outputTokens: { min: 50, max: 16_000, step: 50 },
};

const PRICING_CALLOUT = `Providers bill separately for input tokens (your prompt, system message, and conversation history) and output tokens (the model's generated response). Output is typically priced 3–5× higher because generation requires sequential sampling and more compute per token.

Token count depends on text length, formatting (code and JSON use more tokens per word), tokenizer choice, and whether you send images or tool definitions. Use the Token Analyzer to inspect real payloads.`;

function shortModelName(id: string): string {
  return id
    .replace("claude-", "")
    .replace("gpt-", "")
    .replace("gemini-", "");
}

export function CostCalculator() {
  const [taskProfile, setTaskProfile] = useState<TaskProfileId>(DEFAULT_PROFILE);
  const [dailyRequests, setDailyRequests] = useState(
    defaultProfile.dailyRequests
  );
  const [inputTokens, setInputTokens] = useState(defaultProfile.inputTokens);
  const [outputTokens, setOutputTokens] = useState(defaultProfile.outputTokens);

  const costs = useMemo(
    () =>
      computeModelCosts({
        dailyRequests,
        inputTokens,
        outputTokens,
      }),
    [dailyRequests, inputTokens, outputTokens]
  );

  const chartData = useMemo(
    () =>
      costs.map((row) => ({
        name: shortModelName(row.id),
        fullName: row.label,
        monthly: Number(row.monthly.toFixed(2)),
      })),
    [costs]
  );

  function applyProfile(id: TaskProfileId) {
    const profile = TASK_PROFILES.find((p) => p.id === id);
    if (!profile) return;
    setTaskProfile(id);
    setDailyRequests(profile.dailyRequests);
    setInputTokens(profile.inputTokens);
    setOutputTokens(profile.outputTokens);
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="pr-40">
          <h2 className="text-2xl font-semibold tracking-tight">
            Cost Calculator
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Estimate monthly API spend across six models from token usage
            assumptions.
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

      <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{PRICING_CALLOUT}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Task profile</CardTitle>
          <CardDescription>
            Preset slider values to realistic defaults for common workloads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {TASK_PROFILES.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => applyProfile(profile.id)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors",
                  taskProfile === profile.id
                    ? "border-foreground/30 bg-muted/60"
                    : "border-border hover:bg-muted/30"
                )}
              >
                <p className="text-sm font-medium">{profile.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {profile.description}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Usage assumptions</CardTitle>
          <CardDescription>
            Adjust daily volume and average token counts per request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <SliderField
            label="Daily requests"
            value={dailyRequests}
            display={dailyRequests.toLocaleString()}
            limits={SLIDER_LIMITS.dailyRequests}
            onChange={setDailyRequests}
          />
          <SliderField
            label="Avg input tokens / request"
            value={inputTokens}
            display={inputTokens.toLocaleString()}
            limits={SLIDER_LIMITS.inputTokens}
            onChange={setInputTokens}
          />
          <SliderField
            label="Avg output tokens / request"
            value={outputTokens}
            display={outputTokens.toLocaleString()}
            limits={SLIDER_LIMITS.outputTokens}
            onChange={setOutputTokens}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monthly cost comparison</CardTitle>
          <CardDescription>
            Estimated spend at {dailyRequests.toLocaleString()} req/day ·{" "}
            {inputTokens.toLocaleString()} in / {outputTokens.toLocaleString()}{" "}
            out tokens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const data = payload[0].payload as {
                      fullName: string;
                      monthly: number;
                    };
                    return (
                      <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-sm">
                        <p className="font-medium">{data.fullName}</p>
                        <p className="font-mono text-muted-foreground">
                          {formatCost(data.monthly)} / month
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey="monthly"
                  fill="hsl(var(--foreground))"
                  fillOpacity={0.65}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Model comparison</CardTitle>
          <CardDescription>
            Sorted by estimated monthly cost (lowest first).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Model</th>
                  <th className="pb-3 pr-4 font-medium">Provider</th>
                  <th className="pb-3 pr-4 font-medium text-right">
                    Cost / 1k req
                  </th>
                  <th className="pb-3 pr-4 font-medium text-right">
                    Monthly
                  </th>
                  <th className="pb-3 font-medium">Recommended use case</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <p className="font-medium">{row.label}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {row.id}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {row.provider}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono tabular-nums">
                      {formatCost(row.per1kRequests)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono font-semibold tabular-nums">
                      {formatCost(row.monthly)}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {row.useCase}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SliderField({
  label,
  value,
  display,
  limits,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  limits: { min: number; max: number; step: number };
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-sm font-semibold tabular-nums">
          {display}
        </span>
      </div>
      <Slider
        min={limits.min}
        max={limits.max}
        step={limits.step}
        value={[value]}
        onValueChange={([next]) => onChange(next)}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{limits.min.toLocaleString()}</span>
        <span>{limits.max.toLocaleString()}</span>
      </div>
    </div>
  );
}
