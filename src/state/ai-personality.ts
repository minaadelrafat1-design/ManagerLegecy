/* =============================================================================
 * AI club personality layer
 *
 * Phase 6.3. Builds a deterministic, persistent club "personality" that
 * biases long-term strategic behaviour without replacing the existing
 * decision engines. Personalities are generated once (seeded from club id)
 * and exposed to decision modules as an auxiliary, explainable layer.
 * ---------------------------------------------------------------------------*/

import type { Club } from "./types";

function seededUnit(seedStr: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  return ((h >>> 0) % 10_000) / 10_000;
}

function hashInt(seedStr: string, salt: number, min: number, max: number): number {
  return min + Math.floor(seededUnit(seedStr, salt) * (max - min + 1));
}

export type PersonalityId =
  | "wealthy-aggressive"
  | "youth-focused"
  | "conservative"
  | "selling-development"
  | "promotion-focused"
  | "survival"
  | "rebuilding"
  | "prestige-focused"
  | "balanced";

export interface ClubPersonality {
  id: PersonalityId;
  label: string;
  riskTolerance: number; // 0-100
  youthFocus: number; // 0-100
  spendingAggressiveness: number; // 0-100
  patience: number; // 0-100
  prestigeFocus: number; // 0-100
  promotionFocus: number; // 0-100
  survivalFocus: number; // 0-100
  rebuildFocus: number; // 0-100
}

/** Deterministically generate a `ClubPersonality` for a club. Pure function. */
export function generateClubPersonality(
  club: Pick<Club, "id" | "reputation" | "facilities" | "identity">,
): ClubPersonality {
  const seed = `aiperson:${club.id}`;
  const baseRep = Math.round((club.reputation ?? 50) / 1);

  const riskTolerance = Math.round(baseRep * 0.3 + hashInt(seed, 1, 0, 60));
  const youthFocus = Math.round(
    (club.identity?.academyFocus ?? club.facilities.youth ?? 40) * 0.6 + hashInt(seed, 2, 0, 40),
  );
  const spendingAggressiveness = Math.round(
    (club.identity?.transferBudgetFactor
      ? 50 * (club.identity.transferBudgetFactor as any)
      : baseRep * 0.4) + hashInt(seed, 3, -10, 50),
  );
  const patience = Math.round((club.identity?.boardPatience ?? 50) * 0.7 + hashInt(seed, 4, 0, 30));
  const prestigeFocus = Math.round(baseRep * 0.5 + hashInt(seed, 5, -20, 50));
  const promotionFocus = Math.round(
    (100 - (club.reputation ?? 50)) * 0.25 + hashInt(seed, 6, 0, 50),
  );
  const survivalFocus = Math.round(
    Math.max(0, 60 - (club.reputation ?? 50)) + hashInt(seed, 7, 0, 30),
  );
  const rebuildFocus = Math.round(hashInt(seed, 8, 0, 80));

  // Heuristic classifier into a small personality id set
  let id: PersonalityId = "balanced";
  if (spendingAggressiveness >= 70 && prestigeFocus >= 60) id = "wealthy-aggressive";
  else if (youthFocus >= 65 && rebuildFocus >= 40) id = "youth-focused";
  else if (riskTolerance <= 30 && spendingAggressiveness <= 35) id = "conservative";
  else if (youthFocus >= 50 && spendingAggressiveness <= 45) id = "selling-development";
  else if (promotionFocus >= 60 && spendingAggressiveness >= 45) id = "promotion-focused";
  else if (survivalFocus >= 65) id = "survival";
  else if (rebuildFocus >= 70) id = "rebuilding";
  else if (prestigeFocus >= 70 && spendingAggressiveness >= 55) id = "prestige-focused";

  const LABELS: Record<PersonalityId, string> = {
    "wealthy-aggressive": "Wealthy aggressive",
    "youth-focused": "Youth-focused",
    conservative: "Conservative",
    "selling-development": "Selling / development",
    "promotion-focused": "Promotion-focused",
    survival: "Survival-focused",
    rebuilding: "Rebuilding",
    "prestige-focused": "Prestige-focused",
    balanced: "Balanced",
  };

  return {
    id,
    label: LABELS[id],
    riskTolerance: Math.max(0, Math.min(100, riskTolerance)),
    youthFocus: Math.max(0, Math.min(100, youthFocus)),
    spendingAggressiveness: Math.max(0, Math.min(100, spendingAggressiveness)),
    patience: Math.max(0, Math.min(100, patience)),
    prestigeFocus: Math.max(0, Math.min(100, prestigeFocus)),
    promotionFocus: Math.max(0, Math.min(100, promotionFocus)),
    survivalFocus: Math.max(0, Math.min(100, survivalFocus)),
    rebuildFocus: Math.max(0, Math.min(100, rebuildFocus)),
  };
}

/** Priority boosts derived from a `ClubPersonality`. Returned mapping adds
 * an extra numeric boost to the `ClubPriority` categories used by
 * `evaluateClubPriorities`. */
export function getPersonalityPriorityBoosts(
  personality?: ClubPersonality,
): Partial<Record<string, Partial<Record<string, number>>>> {
  if (!personality) return {};
  const p = personality;
  const boosts: Partial<Record<string, Partial<Record<string, number>>>> = {};

  // strengthen-squad: increased when spendingAggressiveness high or prestige push
  boosts["strengthen-squad"] = {
    "strengthen-squad": Math.round(p.spendingAggressiveness * 0.2 + p.prestigeFocus * 0.15),
  };

  // develop-youth: boosted by youthFocus and rebuild tendencies
  boosts["develop-youth"] = {
    "develop-youth": Math.round(p.youthFocus * 0.6 + p.rebuildFocus * 0.2),
  };

  // balance-books: boosted by conservative/survival tendencies (inverse spending)
  boosts["balance-books"] = {
    "balance-books": Math.round((100 - p.spendingAggressiveness) * 0.4 + p.survivalFocus * 0.3),
  };

  // chase-promotion: boosted by promotion focus and some spending
  boosts["chase-promotion"] = {
    "chase-promotion": Math.round(p.promotionFocus * 0.5 + p.spendingAggressiveness * 0.2),
  };

  // consolidate: boosted by patience and conservative tilt
  boosts["consolidate"] = {
    consolidate: Math.round(p.patience * 0.4 + (100 - p.riskTolerance) * 0.2),
  };

  // map personality id explicit boosts for clearer separation
  switch (p.id) {
    case "wealthy-aggressive":
      boosts["strengthen-squad"] = {
        "strengthen-squad":
          ((boosts["strengthen-squad"]?.["strengthen-squad"] as number) || 0) + 10,
      };
      break;
    case "youth-focused":
      boosts["develop-youth"] = {
        "develop-youth": ((boosts["develop-youth"]?.["develop-youth"] as number) || 0) + 15,
      };
      break;
    case "conservative":
      boosts["balance-books"] = {
        "balance-books": ((boosts["balance-books"]?.["balance-books"] as number) || 0) + 12,
      };
      break;
    case "selling-development":
      boosts["develop-youth"] = {
        "develop-youth": ((boosts["develop-youth"]?.["develop-youth"] as number) || 0) + 8,
      };
      boosts["balance-books"] = {
        "balance-books": ((boosts["balance-books"]?.["balance-books"] as number) || 0) + 6,
      };
      break;
    case "promotion-focused":
      boosts["chase-promotion"] = {
        "chase-promotion": ((boosts["chase-promotion"]?.["chase-promotion"] as number) || 0) + 12,
      };
      break;
    case "survival":
      boosts["consolidate"] = {
        consolidate: ((boosts["consolidate"]?.["consolidate"] as number) || 0) + 10,
      };
      boosts["balance-books"] = {
        "balance-books": ((boosts["balance-books"]?.["balance-books"] as number) || 0) + 8,
      };
      break;
    case "rebuilding":
      boosts["develop-youth"] = {
        "develop-youth": ((boosts["develop-youth"]?.["develop-youth"] as number) || 0) + 10,
      };
      break;
    case "prestige-focused":
      boosts["strengthen-squad"] = {
        "strengthen-squad": ((boosts["strengthen-squad"]?.["strengthen-squad"] as number) || 0) + 8,
      };
      boosts["chase-promotion"] = {
        "chase-promotion": ((boosts["chase-promotion"]?.["chase-promotion"] as number) || 0) + 6,
      };
      break;
    default:
      break;
  }

  return boosts;
}

export default { generateClubPersonality, getPersonalityPriorityBoosts };
