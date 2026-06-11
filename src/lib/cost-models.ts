export type CostModelId =
  | "claude-haiku-4-5"
  | "claude-sonnet-4-6"
  | "claude-opus-4-6"
  | "gpt-4o-mini"
  | "gpt-4o"
  | "gemini-1.5-flash";

export type TaskProfileId =
  | "high-volume-simple"
  | "balanced"
  | "complex-reasoning"
  | "agentic";

export type CostModel = {
  id: CostModelId;
  label: string;
  provider: string;
  inputPer1M: number;
  outputPer1M: number;
  useCase: string;
};

export const COST_MODELS: CostModel[] = [
  {
    id: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
    inputPer1M: 1.0,
    outputPer1M: 5.0,
    useCase: "High-volume routing, classification, simple extraction",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "Anthropic",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
    useCase: "Balanced production workloads, coding, analysis",
  },
  {
    id: "claude-opus-4-6",
    label: "Claude Opus 4.6",
    provider: "Anthropic",
    inputPer1M: 15.0,
    outputPer1M: 75.0,
    useCase: "Complex reasoning, critical quality, research",
  },
  {
    id: "gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
    useCase: "Budget OpenAI workloads at scale",
  },
  {
    id: "gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    inputPer1M: 2.5,
    outputPer1M: 10.0,
    useCase: "Multimodal tasks, strong general-purpose quality",
  },
  {
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    provider: "Google",
    inputPer1M: 0.075,
    outputPer1M: 0.3,
    useCase: "High-volume Google stack, long-context chat",
  },
];

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
