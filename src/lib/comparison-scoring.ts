import type { QualityScores } from "@/lib/comparison-types";
import {
  COMPARISON_MODELS,
  type ComparisonModelId,
} from "@/lib/model-pricing";

/** Models within this many points of the top score compete for "best value". */
export const QUALITY_VALUE_GATE = 1;

type ScorableResult = {
  costUsd: number;
  error?: string;
};

type ResultMap = Partial<Record<ComparisonModelId, ScorableResult>>;

export function computeBestQuality(
  scores: QualityScores
): ComparisonModelId | null {
  let best: ComparisonModelId | null = null;
  let bestScore = -Infinity;

  for (const model of COMPARISON_MODELS) {
    const score = scores[model.id];
    if (score == null || score > bestScore) {
      if (score == null) continue;
      bestScore = score;
      best = model.id;
    }
  }

  return best;
}

/**
 * Cheapest model among those within QUALITY_VALUE_GATE of the top score.
 * Avoids raw score/cost ratios, where ~4× cost differences overwhelm 1–10 scores.
 */
export function computeBestValue(
  results: ResultMap,
  scores: QualityScores,
  gate = QUALITY_VALUE_GATE
): ComparisonModelId | null {
  const topScore = Math.max(
    ...COMPARISON_MODELS.map((m) => scores[m.id]).filter(
      (s): s is number => s != null
    ),
    -Infinity
  );

  if (!Number.isFinite(topScore)) return null;

  const threshold = topScore - gate;
  let best: ComparisonModelId | null = null;
  let bestCost = Infinity;

  for (const model of COMPARISON_MODELS) {
    const result = results[model.id];
    const score = scores[model.id];
    if (!result || result.error || score == null || result.costUsd <= 0) {
      continue;
    }
    if (score < threshold) continue;

    if (result.costUsd < bestCost) {
      bestCost = result.costUsd;
      best = model.id;
    }
  }

  return best;
}

export function isValueEligible(
  scores: QualityScores,
  modelId: ComparisonModelId,
  gate = QUALITY_VALUE_GATE
): boolean {
  const score = scores[modelId];
  if (score == null) return false;

  const topScore = Math.max(
    ...COMPARISON_MODELS.map((m) => scores[m.id]).filter(
      (s): s is number => s != null
    ),
    -Infinity
  );

  return Number.isFinite(topScore) && score >= topScore - gate;
}
