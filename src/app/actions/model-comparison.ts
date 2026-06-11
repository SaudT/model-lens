"use server";

import {
  TASK_INSTRUCTIONS,
  type JudgeResult,
  type ModelRunResult,
  type QualityScores,
  type TaskType,
} from "@/lib/comparison-types";
import {
  COMPARISON_MODELS,
  estimateCostUsd,
  type ComparisonModelId,
} from "@/lib/model-pricing";

const JUDGE_MODEL: ComparisonModelId = "claude-sonnet-4-6";

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

async function callAnthropic(
  modelId: ComparisonModelId,
  apiKey: string,
  system: string,
  userContent: string,
  maxTokens: number
) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
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

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? "Anthropic request failed");
  }

  const text =
    data.content?.[0]?.type === "text" ? data.content[0].text : "";

  return {
    text,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
}

async function callOpenAI(
  apiKey: string,
  system: string,
  userContent: string,
  maxTokens: number
) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
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

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message ?? "OpenAI request failed");
  }

  return {
    text: data.choices[0]?.message?.content ?? "",
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
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
    return {
      modelId,
      response: "",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      costUsd: 0,
      error: "Unknown model",
    };
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
    return {
      modelId,
      response: "",
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - start,
      costUsd: 0,
      error: err instanceof Error ? err.message : "Request failed",
    };
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
      latencyMs: 0,
      error: "No outputs to judge",
    };
  }

  const taskLabel = taskType.replace(/-/g, " ");
  const outputBlock = outputs
    .map((o) => `### ${o.modelId}\n${o.response || "(empty response)"}`)
    .join("\n\n");

  const judgePrompt = `You are an impartial evaluator. Rate each model output for the task type "${taskLabel}" on a scale of 1-10 (10 = excellent).

Original prompt:
${prompt}

Model outputs:
${outputBlock}

Return ONLY valid JSON mapping each model id to its integer score. Example:
{"claude-haiku-4-5": 7, "claude-sonnet-4-6": 9, "gpt-4o-mini": 8}

Include only the model ids listed above.`;

  try {
    const result = await callAnthropic(
      JUDGE_MODEL,
      apiKey,
      "You evaluate LLM outputs fairly and return JSON only.",
      judgePrompt,
      256
    );

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Judge did not return valid JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, number>;
    const scores: QualityScores = {};

    for (const { modelId } of outputs) {
      const score = parsed[modelId];
      if (typeof score === "number" && score >= 1 && score <= 10) {
        scores[modelId] = score;
      }
    }

    return {
      scores,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      scores: {},
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : "Judging failed",
    };
  }
}
