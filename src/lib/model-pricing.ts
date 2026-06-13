export type ModelId =
  | "claude-haiku-4-5"
  | "claude-sonnet-4-6"
  | "claude-opus-4-6"
  | "gpt-4o-mini"
  | "gpt-4o"
  | "gemini-1.5-flash";

/** Models used in Model Comparison and evals. */
export type ComparisonModelId = Extract<
  ModelId,
  "claude-haiku-4-5" | "claude-sonnet-4-6" | "gpt-4o-mini"
>;

/** Models shown in the Cost Calculator. */
export type CostModelId = ModelId;

export type PricingSource = {
  url: string;
  /** ISO date when rates were last checked against the source. */
  lastVerified: string;
  notes?: string;
};

export type ModelPricingEntry = {
  id: ModelId;
  label: string;
  provider: "Anthropic" | "OpenAI" | "Google";
  inputPer1M: number;
  outputPer1M: number;
  source: PricingSource;
  /** Present for models callable from Model Comparison. */
  keyProvider?: "anthropic" | "openai";
  /** Present for models listed in the Cost Calculator. */
  useCase?: string;
};

/**
 * Single source of truth for per-million-token list prices.
 * Standard API tier only — excludes batch discounts, prompt caching, and regional multipliers.
 * Reconcile against source URLs when provider pricing changes.
 */
export const MODEL_PRICING: ModelPricingEntry[] = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
    inputPer1M: 1.0,
    outputPer1M: 5.0,
    source: {
      url: "https://platform.claude.com/docs/en/about-claude/pricing",
      lastVerified: "2026-06-12",
    },
    keyProvider: "anthropic",
    useCase: "High-volume routing, classification, simple extraction",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "Anthropic",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    source: {
      url: "https://platform.claude.com/docs/en/about-claude/pricing",
      lastVerified: "2026-06-12",
    },
    keyProvider: "anthropic",
    useCase: "Balanced production workloads, coding, analysis",
  },
  {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    provider: "Anthropic",
    inputPer1M: 5.0,
    outputPer1M: 25.0,
    source: {
      url: "https://platform.claude.com/docs/en/about-claude/pricing",
      lastVerified: "2026-06-12",
      notes: "Opus 4.6 list price; older Opus 4.x tiers were $15/$75.",
    },
    useCase: "Complex reasoning, critical quality, research",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    source: {
      url: "https://developers.openai.com/api/docs/pricing",
      lastVerified: "2026-06-12",
    },
    keyProvider: "openai",
    useCase: "Budget OpenAI workloads at scale",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    inputPer1M: 2.5,
    outputPer1M: 10.0,
    source: {
      url: "https://developers.openai.com/api/docs/pricing",
      lastVerified: "2026-06-12",
    },
    useCase: "Multimodal tasks, strong general-purpose quality",
  },
  {
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    provider: "Google",
    inputPer1M: 0.075,
    outputPer1M: 0.3,
    source: {
      url: "https://ai.google.dev/gemini-api/docs/pricing",
      lastVerified: "2026-06-12",
      notes: "Standard tier; longer context may use higher tiers.",
    },
    useCase: "High-volume Google stack, long-context chat",
  },
];

/** Latest date any entry in MODEL_PRICING was verified against its source. */
export const PRICING_LAST_REVIEWED = MODEL_PRICING.reduce(
  (latest, model) =>
    model.source.lastVerified > latest ? model.source.lastVerified : latest,
  MODEL_PRICING[0]?.source.lastVerified ?? ""
);

export type ComparisonModel = Pick<
  ModelPricingEntry,
  "id" | "label" | "provider" | "inputPer1M" | "outputPer1M" | "keyProvider"
> & { id: ComparisonModelId; keyProvider: "anthropic" | "openai" };

export const COMPARISON_MODELS: ComparisonModel[] = MODEL_PRICING.filter(
  (model): model is ModelPricingEntry & {
    id: ComparisonModelId;
    keyProvider: "anthropic" | "openai";
  } => model.keyProvider != null
).map(({ id, label, provider, inputPer1M, outputPer1M, keyProvider }) => ({
  id,
  label,
  provider,
  inputPer1M,
  outputPer1M,
  keyProvider,
}));

export function getModelPricing(modelId: ModelId): ModelPricingEntry | undefined {
  return MODEL_PRICING.find((model) => model.id === modelId);
}

export function estimateCostUsd(
  modelId: ModelId,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = getModelPricing(modelId);
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
