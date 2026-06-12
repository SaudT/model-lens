import { Tiktoken } from "js-tiktoken/lite";
import cl100k_base from "js-tiktoken/ranks/cl100k_base";

let encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!encoder) {
    encoder = new Tiktoken(cl100k_base);
  }
  return encoder;
}

export type TokenChip = {
  id: number;
  text: string;
  index: number;
};

export type ContentType = "prose" | "code" | "json" | "numeric";

export const CONTENT_TYPES: {
  id: ContentType;
  label: string;
  description: string;
}[] = [
  {
    id: "prose",
    label: "Prose",
    description: "Natural language with common words and punctuation",
  },
  {
    id: "code",
    label: "Code",
    description: "Source code with symbols, operators, and indentation",
  },
  {
    id: "json",
    label: "JSON",
    description: "Structured data with braces, quotes, and delimiters",
  },
  {
    id: "numeric",
    label: "Numeric",
    description: "Numbers, currency, and tabular figures",
  },
];

export const CONTENT_SAMPLES: Record<ContentType, string> = {
  prose: `The transformer architecture revolutionized natural language processing by enabling models to attend to all positions in a sequence simultaneously. This parallelization dramatically reduced training time compared to recurrent networks, while the self-attention mechanism captured long-range dependencies that earlier models struggled with. Today, large language models built on this foundation power everything from code assistants to scientific literature review.`,
  code: `function mergeSort<T>(arr: T[], compare: (a: T, b: T) => number): T[] {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid), compare);
  const right = mergeSort(arr.slice(mid), compare);
  return merge(left, right, compare);
}`,
  json: `{"model":"gpt-4o","messages":[{"role":"system","content":"You are a helpful assistant."},{"role":"user","content":"Analyze this payload"}],"temperature":0.7,"max_tokens":4096,"response_format":{"type":"json_object"}}`,
  numeric: `Q1 Revenue: $12,847,392.50
Q2 Revenue: $15,203,847.00
Q3 Revenue: $18,492,103.75
YoY Growth: 23.47%
Units Shipped: 1,847,293
Avg Order Value: $67.42
Margin: 34.8%`,
};

export function tokenize(text: string): TokenChip[] {
  if (!text) return [];
  const enc = getEncoder();
  const ids = enc.encode(text);
  return ids.map((id, index) => ({
    id,
    text: enc.decode([id]),
    index,
  }));
}

export function countTokens(text: string): number {
  if (!text) return 0;
  return getEncoder().encode(text).length;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function tokensPerWord(tokens: number, words: number): number {
  if (words === 0) return 0;
  return tokens / words;
}

export function formatTokenDisplay(text: string): string {
  if (text === "") return "∅";
  return text
    .replace(/\n/g, "↵")
    .replace(/\t/g, "→")
    .replace(/ /g, "·");
}

export type DensityStats = {
  type: ContentType;
  label: string;
  tokens: number;
  words: number;
  chars: number;
  ratio: number;
};

export function getDensityBenchmarks(): DensityStats[] {
  return CONTENT_TYPES.map(({ id, label }) => {
    const text = CONTENT_SAMPLES[id];
    const tokens = countTokens(text);
    const words = countWords(text);
    return {
      type: id,
      label,
      tokens,
      words,
      chars: text.length,
      ratio: tokensPerWord(tokens, words),
    };
  });
}
