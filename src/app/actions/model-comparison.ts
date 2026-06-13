"use server";

import {
  TASK_INSTRUCTIONS,
  type JudgeResult,
  type ModelRunResult,
  type QualityReasons,
  type QualityScores,
  type TaskType,
} from "@/lib/comparison-types";
import {
  classifyApiError,
  classifyThrownError,
  type ApiErrorKind,
} from "@/lib/api-errors";
import {
  COMPARISON_MODELS,
  estimateCostUsd,
  type ComparisonModelId,
} from "@/lib/model-pricing";

const JUDGE_MODEL: ComparisonModelId = "claude-sonnet-4-6";
const MAX_REASON_LENGTH = 200;

function normalizeReason(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > MAX_REASON_LENGTH
    ? trimmed.slice(0, MAX_REASON_LENGTH).trim()
    : trimmed;
}

function parseJudgeEntry(value: unknown): {
  score?: number;
  reason?: string;
} {
  if (typeof value === "number") {
    return { score: value };
  }

  if (value && typeof value === "object" && "score" in value) {
    const entry = value as { score?: unknown; reason?: unknown };
    const score = typeof entry.score === "number" ? entry.score : undefined;
    return { score, reason: normalizeReason(entry.reason) };
  }

  return {};
}

type RunModelParams = {
  modelId: ComparisonModelId;
  prompt: string;
  taskType: TaskType;
  apiKey: string;
};

type JudgeParams = {
  prompt: string;
  taskType: TaskType;
  apiKey: string;
  outputs: { modelId: ComparisonModelId; response: string }[];
};

class ProviderCallError extends Error {
  kind: ApiErrorKind;

  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

async function callAnthropic(
  modelId: ComparisonModelId,
  apiKey: string,
  system: string,
  userContent: string,
  maxTokens: number
) {
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });
  } catch (err) {
    const classified = classifyThrownError(err);
    throw new ProviderCallError(classified.kind, classified.message);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } }).error?.message ??
      "Anthropic request failed";
    const classified = classifyApiError(msg, res.status);
    throw new ProviderCallError(classified.kind, classified.message);
  }

  const text =
    (data as { content?: { type: string; text: string }[] }).content?.[0]
      ?.type === "text"
      ? (data as { content: { type: string; text: string }[] }).content[0].text
      : "";

  return {
    text,
    inputTokens:
      (data as { usage?: { input_tokens?: number } }).usage?.input_tokens ?? 0,
    outputTokens:
      (data as { usage?: { output_tokens?: number } }).usage?.output_tokens ??
      0,
  };
}

async function callOpenAI(
  apiKey: string,
  system: string,
  userContent: string,
  maxTokens: number
) {
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch (err) {
    const classified = classifyThrownError(err);
    throw new ProviderCallError(classified.kind, classified.message);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } }).error?.message ??
      "OpenAI request failed";
    const classified = classifyApiError(msg, res.status);
    throw new ProviderCallError(classified.kind, classified.message);
  }

  return {
    text:
      (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]
        ?.message?.content ?? "",
    inputTokens:
      (data as { usage?: { prompt_tokens?: number } }).usage?.prompt_tokens ??
      0,
    outputTokens:
      (data as { usage?: { completion_tokens?: number } }).usage
        ?.completion_tokens ?? 0,
  };
}

function failureResult(
  modelId: ComparisonModelId,
  latencyMs: number,
  kind: ApiErrorKind,
  message: string
): ModelRunResult {
  return {
    modelId,
    response: "",
    inputTokens: 0,
    outputTokens: 0,
    latencyMs,
    costUsd: 0,
    error: message,
    errorKind: kind,
  };
}

export async function runComparisonModel(
  params: RunModelParams
): Promise<ModelRunResult> {
  const { modelId, prompt, taskType, apiKey } = params;
  const start = Date.now();
  const system = TASK_INSTRUCTIONS[taskType];
  const model = COMPARISON_MODELS.find((m) => m.id === modelId);

  if (!model) {
    return failureResult(modelId, 0, "unknown", "Unknown model");
  }

  try {
    const result =
      model.keyProvider === "anthropic"
        ? await callAnthropic(modelId, apiKey, system, prompt, 1024)
        : await callOpenAI(apiKey, system, prompt, 1024);

    const inputTokens = result.inputTokens;
    const outputTokens = result.outputTokens;

    return {
      modelId,
      response: result.text,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - start,
      costUsd: estimateCostUsd(modelId, inputTokens, outputTokens),
    };
  } catch (err) {
    if (err instanceof ProviderCallError) {
      return failureResult(
        modelId,
        Date.now() - start,
        err.kind,
        err.message
      );
    }
    const classified = classifyThrownError(err);
    return failureResult(
      modelId,
      Date.now() - start,
      classified.kind,
      classified.message
    );
  }
}

export async function judgeComparisonOutputs(
  params: JudgeParams
): Promise<JudgeResult> {
  const { prompt, taskType, apiKey, outputs } = params;
  const start = Date.now();

  if (outputs.length === 0) {
    return {
      scores: {},
      reasons: {},
      latencyMs: 0,
      error: "No outputs to judge",
      errorKind: "unknown",
    };
  }

  const taskLabel = taskType.replace(/-/g, " ");
  const outputBlock = outputs
    .map((o) => `### ${o.modelId}\n${o.response || "(empty response)"}`)
    .join("\n\n");

  const judgePrompt = `You are an impartial evaluator. Rate each model output for the task type "${taskLabel}" on a scale of 1-10.

Scoring rubric (use the full range — do not cluster scores unless outputs are genuinely equivalent):
- 9-10: Excellent — fully satisfies the task with no meaningful gaps
- 7-8: Good — meets the task with minor issues
- 5-6: Partial — usable but missing important elements
- 1-4: Poor — fails the task

Compare outputs relative to each other. Spread scores when quality clearly differs.

For each model, include a "reason": exactly one sentence (max ~25 words) citing a concrete strength or gap — do not restate the score.

Original prompt:
${prompt}

Model outputs:
${outputBlock}

Return ONLY valid JSON mapping each model id to an object with "score" (integer 1-10) and "reason" (one sentence). Example:
{"claude-haiku-4-5": {"score": 7, "reason": "Concise summary but omitted the deadline."}, "claude-sonnet-4-6": {"score": 9, "reason": "Complete and well-structured with all key facts."}, "gpt-4o-mini": {"score": 8, "reason": "Accurate overall; slightly verbose opening."}}

Include only the model ids listed above.`;

  try {
    const result = await callAnthropic(
      JUDGE_MODEL,
      apiKey,
      "You evaluate LLM outputs fairly and return JSON only.",
      judgePrompt,
      512
    );

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new ProviderCallError(
        "unknown",
        "Judge did not return valid JSON"
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const scores: QualityScores = {};
    const reasons: QualityReasons = {};

    for (const { modelId } of outputs) {
      const entry = parseJudgeEntry(parsed[modelId]);
      if (
        typeof entry.score === "number" &&
        entry.score >= 1 &&
        entry.score <= 10
      ) {
        scores[modelId] = entry.score;
      }
      if (entry.reason) {
        reasons[modelId] = entry.reason;
      }
    }

    return {
      scores,
      reasons,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    if (err instanceof ProviderCallError) {
      return {
        scores: {},
        reasons: {},
        latencyMs: Date.now() - start,
        error: err.message,
        errorKind: err.kind,
      };
    }
    const classified = classifyThrownError(err);
    return {
      scores: {},
      reasons: {},
      latencyMs: Date.now() - start,
      error: classified.message,
      errorKind: classified.kind,
    };
  }
}
