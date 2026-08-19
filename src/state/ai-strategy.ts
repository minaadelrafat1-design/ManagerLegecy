import type { GameState } from "./types";
import {
  buildClubDecisionContext,
  scoreFinancialFlexibility,
  scoreSquadUrgency,
} from "./ai-decisions";

export type StrategyId =
  | "rebuild-around-youth"
  | "challenge-promotion"
  | "reduce-wage-bill"
  | "prepare-european"
  | "replace-aging-core"
  | "consolidate";

export interface StrategyPlan {
  strategy: StrategyId;
  seasons: number; // planning horizon in seasons
  priorities: { priority: string; weight: number }[]; // maps to ClubPriority keys
  rationale: string;
}

function avgSquadAge(state: GameState, clubId: string): number {
  const club = state.clubs[clubId];
  if (!club) return 30;
  const players = club.playerIds.map((id) => state.players[id]).filter(Boolean);
  if (players.length === 0) return 28;
  const sum = players.reduce((s, p) => s + (p ? (p.age ?? 28) : 28), 0);
  return Math.round(sum / Math.max(1, players.length));
}

function expiringContractsCount(state: GameState, clubId: string, yearsThreshold = 1): number {
  const club = state.clubs[clubId];
  if (!club) return 0;
  return club.playerIds
    .map((id) => state.players[id])
    .filter((p): p is any => Boolean(p))
    .filter((p) => (p.contractYears ?? 0) <= yearsThreshold).length;
}

export function evaluateClubStrategy(state: GameState, clubId: string): StrategyPlan {
  const context = buildClubDecisionContext(state, clubId);
  const finances = scoreFinancialFlexibility(context);
  const squadUrgency = scoreSquadUrgency(context);
  const age = avgSquadAge(state, clubId);
  const expiring = expiringContractsCount(state, clubId);
  const youthProspects = state.clubs[clubId]?.academy?.prospectIds?.length ?? 0;
  const youthBias = context.youthLean;
  const reputation = context.reputation;

  // detect likely European involvement via meta registration (best-effort)
  const europeanRegs = (state.meta?.europeanQualifications ?? []).filter(
    (r: any) => r.clubId === clubId,
  );
  const inEurope = europeanRegs.length > 0 || reputation >= 80;

  // heuristic scoring for strategies
  const scores: Record<StrategyId, number> = {
    "rebuild-around-youth": 0,
    "challenge-promotion": 0,
    "reduce-wage-bill": 0,
    "prepare-european": 0,
    "replace-aging-core": 0,
    consolidate: 0,
  };

  // rebuild-around-youth: high youthBias or many prospects, and limited finances
  scores["rebuild-around-youth"] += youthBias * 0.35 + youthProspects * 5;
  scores["rebuild-around-youth"] += (100 - finances) * 0.25;
  // penalize rebuild when squad is already old
  scores["rebuild-around-youth"] -= Math.max(0, age - 27) * 12;

  // challenge-promotion: good finances, reputation and low squad urgency
  scores["challenge-promotion"] += finances * 0.5 + reputation * 0.3 - squadUrgency * 0.4;

  // reduce-wage-bill: many expiring contracts or low finances
  scores["reduce-wage-bill"] +=
    (expiring > 0 ? expiring * 8 : 0) + Math.max(0, 40 - finances) * 1.0;

  // prepare-european: inEurope OR reputation and finances high
  scores["prepare-european"] += inEurope ? 80 : finances * 0.4 + reputation * 0.4;
  // if many contracts expiring or finances are weak, preparing for Europe is less likely
  scores["prepare-european"] -= Math.max(0, expiring - 1) * 10;
  if (finances < 50) scores["prepare-european"] -= (50 - finances) * 0.4;

  // replace-aging-core: average age high and finances sufficient to buy
  scores["replace-aging-core"] += age >= 28 ? (age - 26) * 22 + finances * 0.45 : 0;

  // consolidate: fallback low-pressure strategy
  scores["consolidate"] += 50 - Math.max(finances, 100 - squadUrgency) * 0.3;

  // pick top
  const ranked = (Object.keys(scores) as StrategyId[]).sort((a, b) => scores[b] - scores[a]);
  const top = ranked[0] as StrategyId;

  // map to priorities (weights sum loosely to 100)
  const mapping: Record<StrategyId, { priority: string; weight: number }[]> = {
    "rebuild-around-youth": [
      { priority: "develop-youth", weight: 60 },
      { priority: "strengthen-squad", weight: 20 },
      { priority: "consolidate", weight: 20 },
    ],
    "challenge-promotion": [
      { priority: "strengthen-squad", weight: 50 },
      { priority: "chase-promotion", weight: 30 },
      { priority: "balance-books", weight: 20 },
    ],
    "reduce-wage-bill": [
      { priority: "balance-books", weight: 70 },
      { priority: "consolidate", weight: 30 },
    ],
    "prepare-european": [
      { priority: "strengthen-squad", weight: 40 },
      { priority: "consolidate", weight: 30 },
      { priority: "develop-youth", weight: 30 },
    ],
    "replace-aging-core": [
      { priority: "strengthen-squad", weight: 50 },
      { priority: "develop-youth", weight: 30 },
      { priority: "balance-books", weight: 20 },
    ],
    consolidate: [
      { priority: "consolidate", weight: 60 },
      { priority: "develop-youth", weight: 20 },
      { priority: "balance-books", weight: 20 },
    ],
  };

  const rationale = `age=${age} expiring=${expiring} prospects=${youthProspects} finances=${finances} squadUrgency=${squadUrgency} youthBias=${youthBias} reputation=${reputation} inEurope=${inEurope}`;

  return {
    strategy: top,
    seasons: top === "rebuild-around-youth" || top === "replace-aging-core" ? 3 : 1,
    priorities: mapping[top],
    rationale,
  };
}

export default { evaluateClubStrategy };
