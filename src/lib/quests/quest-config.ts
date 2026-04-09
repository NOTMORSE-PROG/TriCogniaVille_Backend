/**
 * Server-authoritative quest configuration. Mirrors the canonical content in
 * Godot's `scripts/quest/QuestData.gd` (BUILDING_QUEST_MAP, lines 10-77).
 *
 * The Godot client also keeps these constants for *display* (e.g. showing
 * "+150 XP" before the network round-trip), but the values here are the ones
 * the API trusts. If you change a reward or threshold, change BOTH places.
 */

export type BuildingId =
  | "town_hall"
  | "school"
  | "inn"
  | "chapel"
  | "library"
  | "well"
  | "market"
  | "bakery";

export interface QuestConfig {
  questId: string;
  xpReward: number;
  passThreshold: number;
  /** Bakery only — weighted final assessment. */
  assessment?: {
    weights: { decoding: number; fluency: number; comprehension: number };
    passScore: number;
  };
}

/** Sequential unlock order — must match Godot QuestData.UNLOCK_ORDER. */
export const UNLOCK_ORDER: BuildingId[] = [
  "town_hall",
  "school",
  "inn",
  "chapel",
  "library",
  "well",
  "market",
  "bakery",
];

export const QUEST_CONFIG: Record<BuildingId, QuestConfig> = {
  town_hall: { questId: "week1_decoding", xpReward: 100, passThreshold: 7 },
  school: { questId: "week2_syllabication", xpReward: 120, passThreshold: 7 },
  inn: { questId: "week3_punctuation", xpReward: 130, passThreshold: 7 },
  chapel: { questId: "week4_fluency", xpReward: 140, passThreshold: 7 },
  library: { questId: "week5_vocabulary", xpReward: 150, passThreshold: 7 },
  well: { questId: "week6_main_idea", xpReward: 160, passThreshold: 7 },
  market: { questId: "week7_inference", xpReward: 170, passThreshold: 7 },
  bakery: {
    questId: "week8_final_mission",
    xpReward: 200,
    passThreshold: 18,
    assessment: {
      weights: { decoding: 30, fluency: 30, comprehension: 40 },
      passScore: 75,
    },
  },
};

/** Replay XP. Replays do NOT award XP — prevents farming. */
export const REPLAY_XP_REWARD = 0;

/**
 * Recompute pass/fail server-side from the client's reported score/totalItems.
 * For Bakery the client must instead submit `score` already as the weighted
 * 0-100 result (the client owns the per-section breakdown), and we check
 * against `passScore`.
 */
export function recomputePass(
  buildingId: string,
  score: number,
  totalItems: number
): boolean {
  const cfg = QUEST_CONFIG[buildingId as BuildingId];
  if (!cfg) return false;
  if (cfg.assessment) {
    return score >= cfg.assessment.passScore;
  }
  // Standard quests: score is # correct items, threshold is # required.
  // (totalItems is informational; pass is based on absolute correct count.)
  void totalItems;
  return score >= cfg.passThreshold;
}

export function isValidBuildingId(id: string): id is BuildingId {
  return id in QUEST_CONFIG;
}

/** Returns true if every prior building in UNLOCK_ORDER is in `unlocked`. */
export function isSequenceSatisfied(
  buildingId: BuildingId,
  unlocked: Set<string>
): boolean {
  const idx = UNLOCK_ORDER.indexOf(buildingId);
  if (idx <= 0) return true;
  for (let i = 0; i < idx; i++) {
    if (!unlocked.has(UNLOCK_ORDER[i])) return false;
  }
  return true;
}
