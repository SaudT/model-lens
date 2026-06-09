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
import {
  tokenizeWithAnthropic,
  tokenizeWithOpenAI,
} from "@/lib/api-clients";
import { useApiKeys } from "@/hooks/use-api-keys";

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function TokenAnalyzer() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<{
    provider: string;
    tokens: number;
    method: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isConnected } = useApiKeys();
  const hasOpenAI = isConnected("openai");
  const hasAnthropic = isConnected("anthropic");

  async function analyze(provider: "openai" | "anthropic") {
    setLoading(true);
    setError(null);
    try {
      const data =
        provider === "openai"
          ? await tokenizeWithOpenAI(text)
          : await tokenizeWithAnthropic(text);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function analyzeLocally() {
    setError(null);
    setResult({
      provider: "Local estimate",
      tokens: estimateTokens(text),
      method: "Character-based estimate (~4 chars/token)",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Token Analyzer</h2>
        <p className="text-sm text-muted-foreground">
          Count tokens in your text using provider APIs or a local estimate.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Input Text</CardTitle>
          <CardDescription>
            Paste or type text to analyze token usage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token-text">Text</Label>
            <textarea
              id="token-text"
              className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Enter text to analyze..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={analyzeLocally}
              disabled={!text.trim() || loading}
              variant="outline"
            >
              Local Estimate
            </Button>
            <Button
              onClick={() => analyze("openai")}
              disabled={!text.trim() || loading || !hasOpenAI}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              OpenAI Count
            </Button>
            <Button
              onClick={() => analyze("anthropic")}
              disabled={!text.trim() || loading || !hasAnthropic}
              variant="secondary"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Anthropic Count
            </Button>
          </div>

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Provider</dt>
                <dd className="font-medium">{result.provider}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tokens</dt>
                <dd className="font-mono text-lg font-semibold">
                  {result.tokens.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Method</dt>
                <dd className="font-medium">{result.method}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
