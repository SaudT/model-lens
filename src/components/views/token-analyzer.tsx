"use client";

import { useMemo, useState } from "react";
import { KeyRound } from "lucide-react";

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
import { cn } from "@/lib/utils";
import {
  CONTENT_SAMPLES,
  CONTENT_TYPES,
  type ContentType,
  countWords,
  formatTokenDisplay,
  getDensityBenchmarks,
  tokenize,
  tokensPerWord,
} from "@/lib/tokenizer";

const TOKEN_COLORS = [
  "bg-sky-500/15 text-sky-950 dark:text-sky-100",
  "bg-violet-500/15 text-violet-950 dark:text-violet-100",
  "bg-emerald-500/15 text-emerald-950 dark:text-emerald-100",
  "bg-amber-500/15 text-amber-950 dark:text-amber-100",
  "bg-rose-500/15 text-rose-950 dark:text-rose-100",
  "bg-cyan-500/15 text-cyan-950 dark:text-cyan-100",
];

const DENSITY_EXPLAINER =
  "BPE tokenizers split text into subword units. Code and JSON pack more symbols per word, so they consume more tokens for the same semantic content. Prose tokenizes closer to natural word boundaries.";

function formatRatio(ratio: number): string {
  return ratio > 0 ? ratio.toFixed(2) : "—";
}

export function TokenAnalyzer() {
  const [text, setText] = useState(CONTENT_SAMPLES.prose);
  const [contentType, setContentType] = useState<ContentType>("prose");

  const tokens = useMemo(() => tokenize(text), [text]);
  const totalTokens = tokens.length;
  const characters = text.length;
  const words = countWords(text);
  const ratio = tokensPerWord(totalTokens, words);

  const densityBenchmarks = useMemo(() => getDensityBenchmarks(), []);
  const maxBenchmarkRatio = Math.max(
    ...densityBenchmarks.map((b) => b.ratio),
    ratio,
    1
  );

  function selectContentType(type: ContentType) {
    setContentType(type);
    setText(CONTENT_SAMPLES[type]);
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="pr-40">
          <h2 className="text-2xl font-semibold tracking-tight">
            Token Analyzer
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Visualize cl100k_base tokenization in the browser. Used by GPT-4,
            GPT-3.5-turbo, and text-embedding models.
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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Content type
        </span>
        <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
          {CONTENT_TYPES.map(({ id, label }) => (
            <Button
              key={id}
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 px-3 text-xs",
                contentType === id &&
                  "bg-background shadow-sm hover:bg-background"
              )}
              onClick={() => selectContentType(id)}
            >
              {label}
            </Button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          Load sample text to compare density across formats
        </span>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4">
        <StatCell label="Total tokens" value={totalTokens.toLocaleString()} />
        <StatCell label="Est. words" value={words.toLocaleString()} />
        <StatCell label="Characters" value={characters.toLocaleString()} />
        <StatCell
          label="Tokens / word"
          value={formatRatio(ratio)}
          mono
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Input</CardTitle>
              <CardDescription>
                Paste any text — prose, code, JSON, or numeric data.
              </CardDescription>
            </div>
            <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
              cl100k_base
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="token-text" className="sr-only">
              Text to tokenize
            </Label>
            <textarea
              id="token-text"
              className="flex min-h-[160px] w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Paste text to analyze..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Token density by content type</CardTitle>
          <CardDescription>{DENSITY_EXPLAINER}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {densityBenchmarks.map((benchmark) => {
              const isActive = benchmark.type === contentType;
              const widthPct = (benchmark.ratio / maxBenchmarkRatio) * 100;

              return (
                <div key={benchmark.type} className="space-y-1">
                  <div className="flex items-baseline justify-between text-xs">
                    <span
                      className={cn(
                        "font-medium",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {benchmark.label}
                    </span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {formatRatio(benchmark.ratio)} tok/word
                      <span className="mx-1.5 text-border">·</span>
                      {benchmark.tokens} tokens
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        isActive ? "bg-foreground/70" : "bg-foreground/25"
                      )}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {text.trim() && (
            <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
              Current input:{" "}
              <span className="font-mono font-medium text-foreground">
                {formatRatio(ratio)} tok/word
              </span>{" "}
              ({totalTokens.toLocaleString()} tokens across{" "}
              {words.toLocaleString()} words)
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Token map</CardTitle>
              <CardDescription>
                Each chip is one BPE token. Adjacent colors alternate for
                readability.
              </CardDescription>
            </div>
            {totalTokens > 0 && (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {totalTokens.toLocaleString()} tokens
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {totalTokens === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Enter text above to render the token map.
            </p>
          ) : (
            <div className="max-h-[480px] overflow-auto rounded-md border bg-muted/20 p-3">
              <div className="flex flex-wrap gap-px font-mono text-[11px] leading-relaxed">
                {tokens.map((token) => (
                  <span
                    key={token.index}
                    title={`#${token.index} · id ${token.id}`}
                    className={cn(
                      "inline-block rounded-sm px-0.5 py-px",
                      TOKEN_COLORS[token.index % TOKEN_COLORS.length]
                    )}
                  >
                    {formatTokenDisplay(token.text)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          mono && "font-mono"
        )}
      >
        {value}
      </dd>
    </div>
  );
}
