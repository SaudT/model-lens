export type ComparisonModelId =
  | "claude-haiku-4-5"
  | "claude-sonnet-4-6"
  | "gpt-4o-mini";

export type ModelPricing = {
  id: ComparisonModelId;
  label: string;
  provider: "Anthropic" | "OpenAI";
  inputPer1M: number;
  outputPer1M: number;
  keyProvider: "anthropic" | "openai";
};

export const COMPARISON_MODELS: ModelPricing[] = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
    inputPer1M: 1.0,
    outputPer1M: 5.0,
    keyProvider: "anthropic",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "Anthropic",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    keyProvider: "anthropic",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    keyProvider: "openai",
  },
];

export function estimateCostUsd(
  modelId: ComparisonModelId,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = COMPARISON_MODELS.find((m) => m.id === modelId);
  if (!pricing) return 0;
  return (
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M
  );
}

export function formatCostUsd(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.0001) return `$${amount.toFixed(6)}`;
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(2)}`;
}
