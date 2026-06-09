"use client";

import { useMemo, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ModelPricing = {
  id: string;
  provider: string;
  inputPer1M: number;
  outputPer1M: number;
};

const MODELS: ModelPricing[] = [
  {
    id: "gpt-4o",
    provider: "OpenAI",
    inputPer1M: 2.5,
    outputPer1M: 10.0,
  },
  {
    id: "gpt-4o-mini",
    provider: "OpenAI",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
  },
  {
    id: "claude-sonnet-4",
    provider: "Anthropic",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  {
    id: "claude-3-5-haiku",
    provider: "Anthropic",
    inputPer1M: 0.8,
    outputPer1M: 4.0,
  },
  {
    id: "gemini-2.0-flash",
    provider: "Google",
    inputPer1M: 0.1,
    outputPer1M: 0.4,
  },
];

function formatCost(amount: number): string {
  if (amount < 0.01) return `$${amount.toFixed(6)}`;
  if (amount < 1) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}

export function CostCalculator() {
  const [inputTokens, setInputTokens] = useState("1000");
  const [outputTokens, setOutputTokens] = useState("500");
  const [requestsPerDay, setRequestsPerDay] = useState("100");

  const costs = useMemo(() => {
    const input = parseFloat(inputTokens) || 0;
    const output = parseFloat(outputTokens) || 0;
    const requests = parseFloat(requestsPerDay) || 0;

    return MODELS.map((model) => {
      const perRequest =
        (input / 1_000_000) * model.inputPer1M +
        (output / 1_000_000) * model.outputPer1M;
      const daily = perRequest * requests;
      const monthly = daily * 30;

      return { ...model, perRequest, daily, monthly };
    }).sort((a, b) => a.monthly - b.monthly);
  }, [inputTokens, outputTokens, requestsPerDay]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Cost Calculator
        </h2>
        <p className="text-sm text-muted-foreground">
          Estimate API costs across popular models based on token usage.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage Parameters</CardTitle>
          <CardDescription>
            Adjust token counts and daily request volume.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="input-tokens">Input tokens / request</Label>
              <Input
                id="input-tokens"
                type="number"
                min="0"
                value={inputTokens}
                onChange={(e) => setInputTokens(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="output-tokens">Output tokens / request</Label>
              <Input
                id="output-tokens"
                type="number"
                min="0"
                value={outputTokens}
                onChange={(e) => setOutputTokens(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="requests">Requests / day</Label>
              <Input
                id="requests"
                type="number"
                min="0"
                value={requestsPerDay}
                onChange={(e) => setRequestsPerDay(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cost Estimates</CardTitle>
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
                    Per request
                  </th>
                  <th className="pb-3 pr-4 font-medium text-right">Daily</th>
                  <th className="pb-3 font-medium text-right">Monthly</th>
                </tr>
              </thead>
              <tbody>
                {costs.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium">{row.id}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {row.provider}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">
                      {formatCost(row.perRequest)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">
                      {formatCost(row.daily)}
                    </td>
                    <td className="py-3 text-right font-mono font-semibold">
                      {formatCost(row.monthly)}
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
