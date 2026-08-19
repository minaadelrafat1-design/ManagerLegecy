/* =============================================================================
 * AI club managers
 * =============================================================================
 * Phase D1. Every club the player does NOT manage gets an `AIManagerProfile`
 * (see `state/types.ts`) — a small, static bundle of numbers/labels that
 * describes who's in charge there. Deliberately simple, per the brief:
 *
 *  - No behaviour lives here. `generateAIManager` only produces a profile;
 *    nothing in this module decides a transfer, picks a formation for a
 *    match, or reacts to results. That's future-phase work — this phase's
 *    job is just to make sure every club HAS someone whose profile that
 *    future work can read.
 *  - `transferPriorities` is a short, ordered list from a small closed
 *    vocabulary (`TransferPriority`), not a scoring model.
 *
 * Deterministic, not random: `state/seed.ts` calls this at module-load
 * time (the demo save is built once, on both server and client, and must
 * render identically for hydration to succeed — see that file's header),
 * so this module never calls `Math.random()`. Every field is derived from
 * a seeded hash of the club's own id, salted per field, exactly the same
 * pattern `state/new-career.ts` uses for the player's own starting
 * attributes.
 * ---------------------------------------------------------------------------*/

import { MANAGER_NATIONALITIES, MANAGER_PHILOSOPHIES } from "@/data/manager-philosophies";
import type { AIManagerProfile, Club, FinancialTendency, TransferPriority } from "./types";
import { generateClubPersonality } from "./ai-personality";

function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Same small FNV-1a-ish hash used in `state/new-career.ts`'s manager
 * attribute generator — deterministic, no `Math.random`. Kept as a
 * separate local copy rather than a shared import so this module has no
 * dependency on the (player-flow-specific) wizard engine. */
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

function hashPick<T>(seedStr: string, salt: number, items: readonly T[]): T {
  return items[hashInt(seedStr, salt, 0, items.length - 1)] as T;
}

/** Picks `count` distinct items from `items`, ordered — used for
 * `transferPriorities`, which is a short RANKED list, not a set. */
function hashPickDistinct<T>(
  seedStr: string,
  saltBase: number,
  items: readonly T[],
  count: number,
): T[] {
  const pool = [...items];
  const picked: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = hashInt(seedStr, saltBase + i, 0, pool.length - 1);
    picked.push(pool.splice(idx, 1)[0] as T);
  }
  return picked;
}

const AI_MANAGER_FIRST_NAMES = [
  "Callum",
  "Anders",
  "Rui",
  "Pieter",
  "Marcin",
  "Igor",
  "Bertrand",
  "Sten",
  "Emre",
  "Kofi",
  "Duarte",
  "Radoslav",
  "Finn",
  "Alvise",
  "Cormac",
  "Yusuf",
];

const AI_MANAGER_LAST_NAMES = [
  "Wrenfield",
  "Bosch",
  "Almeida",
  "Kaczmarek",
  "Solheim",
  "Petrenko",
  "Marchetti",
  "Lindegaard",
  "Baptiste",
  "Osei-Bonsu",
  "Vidović",
  "Renner",
  "Okonkwo",
  "Delacroix",
  "Hollis",
  "Farrant",
];

const FORMATION_POOL = ["4-4-2", "4-3-3", "4-2-3-1", "3-5-2", "5-3-2"];

const FINANCIAL_TENDENCIES: FinancialTendency[] = ["frugal", "balanced", "spender"];

const TRANSFER_PRIORITY_POOL: TransferPriority[] = [
  "youth-potential",
  "proven-experience",
  "value-for-money",
  "reputation-and-profile",
  "physical-presence",
  "technical-creativity",
];

/** The minimal slice of `Club` this needs — lets callers pass either a
 * fully-built `Club` or the raw fields they're about to build one from. */
export type AIManagerClubInput = Pick<
  Club,
  "id" | "name" | "formation" | "reputation" | "facilities"
>;

export interface AIManagerGenerationOptions {
  worldSeed?: string;
  generation?: number;
}

/** Builds a simple, deterministic `AIManagerProfile` for `club`. Called
 * once, when the club itself is created — same lifecycle as the club, not
 * regenerated on every read. */
export function generateAIManager(
  club: AIManagerClubInput,
  options: AIManagerGenerationOptions = {},
): AIManagerProfile {
  const generation = Math.max(1, Math.floor(options.generation ?? 1));
  const worldSeed = options.worldSeed ?? "0";
  const seed = `aimgr:${worldSeed}:${club.id}:generation:${generation}`;

  const name = `${hashPick(seed, 1, AI_MANAGER_FIRST_NAMES)} ${hashPick(seed, 2, AI_MANAGER_LAST_NAMES)}`;
  const nationality = hashPick(seed, 3, MANAGER_NATIONALITIES);

  // Reputation tracks the club's own standing loosely, with real spread —
  // a respected manager can be at a modest club (and vice versa).
  const reputation = clamp(club.reputation * 0.55 + hashInt(seed, 4, 0, 40));

  // Tactical ability leans on reputation a little (bigger names tend to
  // have proven something) but still has plenty of independent variance.
  const tacticalAbility = clamp(reputation * 0.4 + hashInt(seed, 5, 15, 70));

  const philosophy = hashPick(seed, 6, MANAGER_PHILOSOPHIES).id;

  // The club's own listed formation is treated as this manager's doing —
  // one club, one tactical identity, no disagreement between the two.
  const preferredFormation = club.formation || hashPick(seed, 7, FORMATION_POOL);

  const transferPriorities = hashPickDistinct(seed, 10, TRANSFER_PRIORITY_POOL, 3);

  // A club with a strong academy is more likely to have hired (or grown)
  // a manager who actually uses it.
  const youthPreference = clamp(club.facilities.youth * 0.45 + hashInt(seed, 20, 0, 55));

  const financialTendency = hashPick(seed, 21, FINANCIAL_TENDENCIES);

  const patience = clamp(hashInt(seed, 22, 20, 90));

  // Coaching skills derived from reputation and facilities
  const training = clamp(Math.round(reputation * 0.35 + hashInt(seed, 23, 0, 40)));
  const playerDevelopment = clamp(
    Math.round(club.facilities.youth * 0.4 + hashInt(seed, 24, 0, 40)),
  );

  return {
    id: `aimgr-${club.id}-g${generation}`,
    careerId: `career-${worldSeed}-${club.id}-${generation}`,
    generation,
    name,
    nationality,
    reputation,
    tacticalAbility,
    philosophy,
    preferredFormation,
    transferPriorities,
    youthPreference,
    financialTendency,
    patience,
    training,
    playerDevelopment,
    personality: generateClubPersonality(club),
  };
}
