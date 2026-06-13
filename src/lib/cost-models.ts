import {
  MODEL_PRICING,
  type CostModelId,
  type ModelPricingEntry,
} from "@/lib/model-pricing";

export type { CostModelId } from "@/lib/model-pricing";

export type TaskProfileId =
  | "high-volume-simple"
  | "balanced"
  | "complex-reasoning"
  | "agentic";

export type CostModel = Pick<
  ModelPricingEntry,
  "id" | "label" | "provider" | "inputPer1M" | "outputPer1M" | "useCase"
> & { id: CostModelId; useCase: string };

export const COST_MODELS: CostModel[] = MODEL_PRICING.filter(
  (model): model is ModelPricingEntry & { useCase: string } =>
    model.useCase != null
).map(({ id, label, provider, inputPer1M, outputPer1M, useCase }) => ({
  id,
  label,
  provider,
  inputPer1M,
  outputPer1M,
  useCase,
}));

export const TASK_PROFILES: {
  id: TaskProfileId;
  label: string;
  dailyRequests: number;
  inputTokens: number;
  outputTokens: number;
  description: string;
}[] = [
  {
    id: "high-volume-simple",
    label: "High Volume Simple",
    dailyRequests: 10_000,
    inputTokens: 250,
    outputTokens: 75,
    description: "Classification, tagging, short Q&A at scale",
  },
  {
    id: "balanced",
    label: "Balanced",
    dailyRequests: 2_000,
    inputTokens: 1_200,
    outputTokens: 400,
    description: "Typical chat or copilot with moderate context",
  },
  {
    id: "complex-reasoning",
    label: "Complex Reasoning",
    dailyRequests: 300,
    inputTokens: 5_000,
    outputTokens: 2_500,
    description: "Long prompts, chain-of-thought, detailed analysis",
  },
  {
    id: "agentic",
    label: "Agentic",
    dailyRequests: 800,
    inputTokens: 12_000,
    outputTokens: 6_000,
    description: "Tool loops, large system prompts, multi-step workflows",
  },
];

export type UsageParams = {
  dailyRequests: number;
  inputTokens: number;
  outputTokens: number;
};

export type ModelCostEstimate = CostModel & {
  perRequest: number;
  per1kRequests: number;
  monthly: number;
};

export function computeModelCosts(params: UsageParams): ModelCostEstimate[] {
  const { dailyRequests, inputTokens, outputTokens } = params;

  return COST_MODELS.map((model) => {
    const perRequest =
      (inputTokens / 1_000_000) * model.inputPer1M +
      (outputTokens / 1_000_000) * model.outputPer1M;
    const per1kRequests = perRequest * 1_000;
    const monthly = perRequest * dailyRequests * 30;

    return { ...model, perRequest, per1kRequests, monthly };
  }).sort((a, b) => a.monthly - b.monthly);
}

export function formatCost(amount: number): string {
  if (amount === 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1) return `$${amount.toFixed(3)}`;
  if (amount < 100) return `$${amount.toFixed(2)}`;
  return `$${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
