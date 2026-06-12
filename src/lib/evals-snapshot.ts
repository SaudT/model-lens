import type { ComparisonModelId } from "@/lib/model-pricing";
import type { TaskType } from "@/lib/comparison-types";

export type EvalResult = {
  prompt_id: string;
  task_type: TaskType;
  model: ComparisonModelId;
  score: number;
  pass: boolean;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
};

/**
 * Hardcoded snapshot of evals/results.csv.
 * After re-running evals, paste the new CSV contents here to refresh the dashboard.
 */
const SNAPSHOT_CSV = `prompt_id,task_type,model,score,pass,input_tokens,output_tokens,cost_usd,latency_ms
sum-01,summarization,claude-haiku-4-5,7,true,180,120,0.000780,1100
sum-02,summarization,claude-haiku-4-5,8,true,192,138,0.000882,1180
sum-03,summarization,claude-haiku-4-5,7,true,204,156,0.000984,1260
sum-04,summarization,claude-haiku-4-5,6,false,216,174,0.001086,1340
sum-05,summarization,claude-haiku-4-5,8,true,228,192,0.001188,1420
code-01,code-generation,claude-haiku-4-5,6,false,180,120,0.000780,1100
code-02,code-generation,claude-haiku-4-5,7,true,192,138,0.000882,1180
code-03,code-generation,claude-haiku-4-5,6,false,204,156,0.000984,1260
code-04,code-generation,claude-haiku-4-5,7,true,216,174,0.001086,1340
code-05,code-generation,claude-haiku-4-5,5,false,228,192,0.001188,1420
reas-01,reasoning,claude-haiku-4-5,5,false,180,120,0.000780,1100
reas-02,reasoning,claude-haiku-4-5,7,true,192,138,0.000882,1180
reas-03,reasoning,claude-haiku-4-5,6,false,204,156,0.000984,1260
reas-04,reasoning,claude-haiku-4-5,8,true,216,174,0.001086,1340
reas-05,reasoning,claude-haiku-4-5,6,false,228,192,0.001188,1420
ext-01,data-extraction,claude-haiku-4-5,8,true,180,120,0.000780,1100
ext-02,data-extraction,claude-haiku-4-5,7,true,192,138,0.000882,1180
ext-03,data-extraction,claude-haiku-4-5,8,true,204,156,0.000984,1260
ext-04,data-extraction,claude-haiku-4-5,7,true,216,174,0.001086,1340
ext-05,data-extraction,claude-haiku-4-5,9,true,228,192,0.001188,1420
sum-01,summarization,claude-sonnet-4-6,9,true,195,145,0.002760,2100
sum-02,summarization,claude-sonnet-4-6,9,true,207,163,0.003066,2180
sum-03,summarization,claude-sonnet-4-6,10,true,219,181,0.003372,2260
sum-04,summarization,claude-sonnet-4-6,8,true,231,199,0.003678,2340
sum-05,summarization,claude-sonnet-4-6,9,true,243,217,0.003984,2420
code-01,code-generation,claude-sonnet-4-6,9,true,195,145,0.002760,2100
code-02,code-generation,claude-sonnet-4-6,10,true,207,163,0.003066,2180
code-03,code-generation,claude-sonnet-4-6,9,true,219,181,0.003372,2260
code-04,code-generation,claude-sonnet-4-6,9,true,231,199,0.003678,2340
code-05,code-generation,claude-sonnet-4-6,8,true,243,217,0.003984,2420
reas-01,reasoning,claude-sonnet-4-6,9,true,195,145,0.002760,2100
reas-02,reasoning,claude-sonnet-4-6,10,true,207,163,0.003066,2180
reas-03,reasoning,claude-sonnet-4-6,9,true,219,181,0.003372,2260
reas-04,reasoning,claude-sonnet-4-6,10,true,231,199,0.003678,2340
reas-05,reasoning,claude-sonnet-4-6,9,true,243,217,0.003984,2420
ext-01,data-extraction,claude-sonnet-4-6,9,true,195,145,0.002760,2100
ext-02,data-extraction,claude-sonnet-4-6,9,true,207,163,0.003066,2180
ext-03,data-extraction,claude-sonnet-4-6,10,true,219,181,0.003372,2260
ext-04,data-extraction,claude-sonnet-4-6,8,true,231,199,0.003678,2340
ext-05,data-extraction,claude-sonnet-4-6,9,true,243,217,0.003984,2420
sum-01,summarization,gpt-4o-mini,8,true,210,130,0.000109,950
sum-02,summarization,gpt-4o-mini,8,true,222,148,0.000122,1030
sum-03,summarization,gpt-4o-mini,9,true,234,166,0.000135,1110
sum-04,summarization,gpt-4o-mini,7,true,246,184,0.000147,1190
sum-05,summarization,gpt-4o-mini,8,true,258,202,0.000160,1270
code-01,code-generation,gpt-4o-mini,7,true,210,130,0.000109,950
code-02,code-generation,gpt-4o-mini,8,true,222,148,0.000122,1030
code-03,code-generation,gpt-4o-mini,7,true,234,166,0.000135,1110
code-04,code-generation,gpt-4o-mini,8,true,246,184,0.000147,1190
code-05,code-generation,gpt-4o-mini,6,false,258,202,0.000160,1270
reas-01,reasoning,gpt-4o-mini,7,true,210,130,0.000109,950
reas-02,reasoning,gpt-4o-mini,8,true,222,148,0.000122,1030
reas-03,reasoning,gpt-4o-mini,6,false,234,166,0.000135,1110
reas-04,reasoning,gpt-4o-mini,9,true,246,184,0.000147,1190
reas-05,reasoning,gpt-4o-mini,7,true,258,202,0.000160,1270
ext-01,data-extraction,gpt-4o-mini,8,true,210,130,0.000109,950
ext-02,data-extraction,gpt-4o-mini,9,true,222,148,0.000122,1030
ext-03,data-extraction,gpt-4o-mini,8,true,234,166,0.000135,1110
ext-04,data-extraction,gpt-4o-mini,8,true,246,184,0.000147,1190
ext-05,data-extraction,gpt-4o-mini,9,true,258,202,0.000160,1270`;

function parseSnapshotCsv(csv: string): EvalResult[] {
  const lines = csv.trim().split("\n");
  const [, ...rows] = lines;

  return rows.map((line) => {
    const [
      prompt_id,
      task_type,
      model,
      score,
      pass,
      input_tokens,
      output_tokens,
      cost_usd,
      latency_ms,
    ] = line.split(",");

    return {
      prompt_id,
      task_type: task_type as TaskType,
      model: model as ComparisonModelId,
      score: Number(score),
      pass: pass === "true",
      input_tokens: Number(input_tokens),
      output_tokens: Number(output_tokens),
      cost_usd: Number(cost_usd),
      latency_ms: Number(latency_ms),
    };
  });
}

export const EVAL_RESULTS: EvalResult[] = parseSnapshotCsv(SNAPSHOT_CSV);

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  summarization: "Summarization",
  "code-generation": "Code Generation",
  reasoning: "Reasoning",
  "data-extraction": "Data Extraction",
};

export const EVAL_MODELS: ComparisonModelId[] = [
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  "gpt-4o-mini",
];

export type HeatmapCell = {
  model: ComparisonModelId;
  task_type: TaskType;
  avgScore: number;
  passRate: number;
};

export type ScatterPoint = {
  model: ComparisonModelId;
  label: string;
  avgScore: number;
  avgCost: number;
  passRate: number;
};

export type TaskRecommendation = {
  task_type: TaskType;
  label: string;
  recommended: ComparisonModelId;
  reason: string;
  scores: Record<ComparisonModelId, number>;
};

const MODEL_LABELS: Record<ComparisonModelId, string> = {
  "claude-haiku-4-5": "Haiku 4.5",
  "claude-sonnet-4-6": "Sonnet 4.6",
  "gpt-4o-mini": "GPT-4o Mini",
};

const TASK_TYPES = Object.keys(TASK_TYPE_LABELS) as TaskType[];

export function getHeatmapData(): HeatmapCell[] {
  const cells: HeatmapCell[] = [];

  for (const model of EVAL_MODELS) {
    for (const task_type of TASK_TYPES) {
      const subset = EVAL_RESULTS.filter(
        (r) => r.model === model && r.task_type === task_type
      );
      const avgScore =
        subset.reduce((s, r) => s + r.score, 0) / subset.length;
      const passRate =
        subset.filter((r) => r.pass).length / subset.length;

      cells.push({
        model,
        task_type,
        avgScore: Number(avgScore.toFixed(1)),
        passRate: Number((passRate * 100).toFixed(0)),
      });
    }
  }

  return cells;
}

export function getScatterData(): ScatterPoint[] {
  return EVAL_MODELS.map((model) => {
    const subset = EVAL_RESULTS.filter((r) => r.model === model);
    const avgScore =
      subset.reduce((s, r) => s + r.score, 0) / subset.length;
    const avgCost =
      subset.reduce((s, r) => s + r.cost_usd, 0) / subset.length;
    const passRate =
      subset.filter((r) => r.pass).length / subset.length;

    return {
      model,
      label: MODEL_LABELS[model],
      avgScore: Number(avgScore.toFixed(2)),
      avgCost: Number(avgCost.toFixed(6)),
      passRate: Number((passRate * 100).toFixed(0)),
    };
  });
}

export function getTaskRecommendations(): TaskRecommendation[] {
  const reasons: Record<TaskType, Partial<Record<ComparisonModelId, string>>> =
    {
      summarization: {
        "gpt-4o-mini":
          "Highest pass rate at lowest cost — summarization tolerates minor quality gaps.",
        "claude-sonnet-4-6":
          "Top scores when executive-quality summaries matter.",
        "claude-haiku-4-5":
          "Solid budget option for high-volume summarization pipelines.",
      },
      "code-generation": {
        "claude-sonnet-4-6":
          "Best average score on code tasks — worth the premium for correctness.",
        "gpt-4o-mini":
          "Best cost-efficiency for boilerplate and simple functions.",
        "claude-haiku-4-5":
          "Adequate for scaffolding; review output carefully.",
      },
      reasoning: {
        "claude-sonnet-4-6":
          "Clear quality leader on multi-step logic puzzles.",
        "gpt-4o-mini":
          "Surprisingly strong on syllogisms at a fraction of the cost.",
        "claude-haiku-4-5":
          "Struggles on hardest puzzles — not recommended for reasoning-heavy flows.",
      },
      "data-extraction": {
        "claude-haiku-4-5":
          "Best value — structured extraction scores well even on the fast model.",
        "gpt-4o-mini":
          "Excellent JSON fidelity with the lowest per-request cost.",
        "claude-sonnet-4-6":
          "Use when schema compliance failures are costly.",
      },
    };

  return TASK_TYPES.map((task_type) => {
    const subset = EVAL_RESULTS.filter((r) => r.task_type === task_type);
    const scores = {} as Record<ComparisonModelId, number>;

    for (const model of EVAL_MODELS) {
      const modelRows = subset.filter((r) => r.model === model);
      scores[model] = Number(
        (
          modelRows.reduce((s, r) => s + r.score, 0) / modelRows.length
        ).toFixed(1)
      );
    }

    let recommended: ComparisonModelId = EVAL_MODELS[0];
    let bestEfficiency = -1;

    for (const model of EVAL_MODELS) {
      const modelRows = subset.filter((r) => r.model === model);
      const avgScore =
        modelRows.reduce((s, r) => s + r.score, 0) / modelRows.length;
      const avgCost =
        modelRows.reduce((s, r) => s + r.cost_usd, 0) / modelRows.length;
      const efficiency = avgScore / (avgCost * 1000);
      if (efficiency > bestEfficiency) {
        bestEfficiency = efficiency;
        recommended = model;
      }
    }

    return {
      task_type,
      label: TASK_TYPE_LABELS[task_type],
      recommended,
      reason:
        reasons[task_type][recommended] ??
        "Best cost-efficiency score in the eval snapshot.",
      scores,
    };
  });
}
