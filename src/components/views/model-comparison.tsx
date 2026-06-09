"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { compareModels } from "@/lib/api-clients";
import { useApiKeys } from "@/hooks/use-api-keys";

type ComparisonResult = {
  provider: string;
  model: string;
  response: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
};

export function ModelComparison() {
  const [prompt, setPrompt] = useState("");
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isConnected } = useApiKeys();
  const hasOpenAI = isConnected("openai");
  const hasAnthropic = isConnected("anthropic");

  async function runComparison() {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const data = await compareModels(prompt);
      const failures = data.filter((r) => r.error).map((r) => r.error!);
      const successful = data.filter((r) => !r.error);

      setResults(successful);
      if (failures.length > 0) {
        setError(failures.join("; "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Model Comparison
        </h2>
        <p className="text-sm text-muted-foreground">
          Send the same prompt to multiple models and compare responses side by
          side.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prompt</CardTitle>
          <CardDescription>
            Enter a prompt to compare across connected providers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            disabled={!prompt.trim() || loading || (!hasOpenAI && !hasAnthropic)}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Compare Models
          </Button>

          {!hasOpenAI && !hasAnthropic && (
            <p className="text-sm text-muted-foreground">
              Configure at least one provider in API Key Settings.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((result) => (
            <Card key={`${result.provider}-${result.model}`}>
              <CardHeader>
                <CardTitle className="text-base">
                  {result.provider} — {result.model}
                </CardTitle>
                <CardDescription>
                  {result.latencyMs}ms
                  {result.inputTokens != null &&
                    ` · ${result.inputTokens} in / ${result.outputTokens ?? 0} out tokens`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {result.response || "(empty response)"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
