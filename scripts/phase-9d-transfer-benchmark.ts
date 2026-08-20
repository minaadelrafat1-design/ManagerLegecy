import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { buildInitialState } from "../src/state/seed";
import {
  buildTransferMarketIndex,
  determineSquadNeedForClub,
  identifyTransferTargets,
  type SimpleSquadNeed,
} from "../src/state/ai-decisions";
import type { GameState, TransferListing } from "../src/state/types";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function parseFinanceAmount(display: string): number {
  const cleaned = display.replace(/[€$£,]/g, "").trim();
  const match = /^(-?[\d.]+)\s*([MK])?/i.exec(cleaned);
  if (!match?.[1]) return 0;
  const n = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase();
  if (unit === "M") return Math.round(n * 1_000_000);
  if (unit === "K") return Math.round(n * 1_000);
  return Math.round(n);
}

const NEED_TO_POS: Record<SimpleSquadNeed, string[]> = {
  goalkeeper: ["GK"],
  defender: ["CB", "RB", "LB"],
  midfielder: ["CDM", "CM", "CAM"],
  winger: ["RW", "LW"],
  striker: ["ST"],
  "no-urgent-need": [],
};

function positionMatchScore(pos: string, need: SimpleSquadNeed): number {
  return NEED_TO_POS[need].includes(pos) ? 20 : 0;
}

function transferPreferenceScore(listing: TransferListing, pref: string): number {
  const age = listing.age;
  const value = parseFinanceAmount(listing.value ?? "€0");
  const rating = listing.rating;
  switch (pref) {
    case "youth-potential":
      return age <= 23 ? 25 : 0;
    case "proven-experience":
      return age >= 27 ? 20 + Math.round((rating - 60) * 0.4) : 0;
    case "value-for-money":
      return Math.max(0, 30 - Math.round(value / 500_000)) + Math.round(rating / 10);
    case "reputation-and-profile":
      return Math.round(rating / 5 + Math.min(15, age / 2));
    case "physical-presence":
      return ["CB", "RB", "LB", "ST"].includes(listing.position) ? 15 : 5;
    case "technical-creativity":
      return ["CAM", "CM", "RW", "LW", "ST"].includes(listing.position) ? 20 : 5;
    default:
      return 0;
  }
}

function legacyIdentifyTransferTargets(
  state: GameState,
  clubId: string,
  maxTargets = 3,
): Array<{ listingId: string; playerId?: string; name: string; position: string; score: number }> {
  const club = state.clubs[clubId];
  if (!club) throw new Error(`unknown club ${clubId}`);
  const need = determineSquadNeedForClub(state, clubId);
  const preferences = club.aiManager?.transferPriorities ?? [
    "value-for-money",
    "youth-potential",
    "proven-experience",
  ];

  return state.transfers
    .map((listing) => {
      const basePosition = positionMatchScore(listing.position, need);
      const prefScore = preferences.reduce(
        (sum, pref) => sum + transferPreferenceScore(listing, pref),
        0,
      );
      const ageScore = listing.age <= 23 ? 10 : listing.age >= 28 ? 5 : 0;
      const overallScore = clamp(Math.round(listing.rating * 0.8));
      const score = clamp(basePosition + prefScore + ageScore + overallScore * 0.1);
      return {
        listingId: listing.id,
        playerId: listing.playerId,
        name: listing.name,
        position: listing.position,
        score,
      };
    })
    .filter((target) => target.score > 0)
    .sort((a, b) => b.score - a.score || a.listingId.localeCompare(b.listingId))
    .slice(0, maxTargets);
}

function makeRepresentativeTransferState(): GameState {
  const state = buildInitialState("phase9d-benchmark");
  const aiClubs = Object.values(state.clubs).filter((club) => club.aiManager && club.id !== state.currentClub.id);
  const listingSeed: TransferListing[] = [];

  for (let i = 0; i < aiClubs.length * 6; i++) {
    const club = aiClubs[i % aiClubs.length]!;
    const positionPool = ["ST", "CM", "CB", "RW", "GK", "LB", "CAM"];
    const position = positionPool[i % positionPool.length];
    const listing: TransferListing = {
      id: `benchmark-listing-${i}`,
      playerId: `benchmark-player-${i}`,
      sellerClubId: club.id,
      name: `Market ${position} ${i}`,
      position,
      rating: 60 + ((i * 17) % 30),
      nationality: "US",
      age: 18 + (i % 22),
      value: `€${(10 + (i % 18)).toFixed(1)}M`,
      status: "new",
    };
    listingSeed.push(listing);
  }

  return {
    ...state,
    transfers: [...state.transfers, ...listingSeed],
  };
}

function measure(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function main() {
  const state = makeRepresentativeTransferState();
  const aiClubs = Object.values(state.clubs).filter((club) => club.aiManager && club.id !== state.currentClub.id);
  const marketIndex = buildTransferMarketIndex(state);

  const legacyLoop = () => {
    for (const club of aiClubs) {
      legacyIdentifyTransferTargets(state, club.id, 3);
    }
  };

  const indexLoop = () => {
    const localIndex = buildTransferMarketIndex(state);
    const needByClub = new Map<string, SimpleSquadNeed>();
    for (const club of aiClubs) {
      const need = needByClub.get(club.id) ?? determineSquadNeedForClub(state, club.id);
      needByClub.set(club.id, need);
      identifyTransferTargets(state, club.id, 3, need, localIndex);
    }
  };

  const legacyMs = measure(legacyLoop);
  const indexedMs = measure(indexLoop);

  const sample = aiClubs[0];
  const sampleNeed = determineSquadNeedForClub(state, sample.id);
  const legacySample = legacyIdentifyTransferTargets(state, sample.id, 3);
  const optimizedSample = identifyTransferTargets(state, sample.id, 3, sampleNeed, marketIndex);

  const report = {
    generatedAt: new Date().toISOString(),
    aiClubs: aiClubs.length,
    listingCount: state.transfers.length,
    candidateCount: legacySample.length + optimizedSample.length,
    legacyAiEvaluationLoopMs: Number(legacyMs.toFixed(2)),
    indexedAiEvaluationLoopMs: Number(indexedMs.toFixed(2)),
    improvementPct: Number((((legacyMs - indexedMs) / Math.max(legacyMs, 0.0001)) * 100).toFixed(2)),
    sampleNeed,
    sampleLegacyTargetIds: legacySample.map((target) => target.listingId),
    sampleOptimizedTargetIds: optimizedSample.map((target) => target.listingId),
    legacySampleScore: legacySample.map((target) => ({ id: target.listingId, score: target.score })),
    optimizedSampleScore: optimizedSample.map((target) => ({ id: target.listingId, score: target.score })),
  };

  mkdirSync("outputs", { recursive: true });
  writeFileSync("outputs/phase-9d-transfer-benchmark.json", JSON.stringify(report, null, 2));

  console.log(JSON.stringify(report, null, 2));
}

main();
