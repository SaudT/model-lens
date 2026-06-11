import type { ComparisonModelId } from "@/lib/model-pricing";

export type TaskType =
  | "summarization"
  | "code-generation"
  | "reasoning"
  | "data-extraction";

export const TASK_TYPES: { id: TaskType; label: string }[] = [
  { id: "summarization", label: "Summarization" },
  { id: "code-generation", label: "Code Generation" },
  { id: "reasoning", label: "Reasoning" },
  { id: "data-extraction", label: "Data Extraction" },
];

export const TASK_INSTRUCTIONS: Record<TaskType, string> = {
  summarization:
    "Summarize the user's content clearly and concisely. Preserve key facts and intent.",
  "code-generation":
    "Generate clean, correct code that satisfies the user's request. Include brief comments only where helpful.",
  reasoning:
    "Work through the problem step by step. Show your reasoning before stating the conclusion.",
  "data-extraction":
    "Extract the requested structured data from the input. Return it in a clear, machine-readable format.",
};

export type ModelRunResult = {
  modelId: ComparisonModelId;
  response: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  error?: string;
};

export type QualityScores = Partial<Record<ComparisonModelId, number>>;

export type JudgeResult = {
  scores: QualityScores;
  latencyMs: number;
  error?: string;
};
