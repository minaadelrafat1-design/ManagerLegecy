import type { GameState } from "./types";
import { getFacilityEffectMultiplier } from "./facilities";

// Deterministic seeded unit for small jitter (keeps estimates stable).
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

/** Returns an estimated potential range for `playerId` as observed by
 * `viewerClubId`. The returned object is deterministic (seeded) and
 * depends on the viewer's scouting/manager ability and club scouting
 * facilities. Does NOT mutate `GameState` and keeps the player's true
 * potential unchanged.
 */
export function estimatePlayerPotentialForViewer(
  state: GameState,
  playerId: string,
  viewerClubId: string,
) {
  const player = state.players[playerId];
  if (!player) return null;
  const truePotential = player.potential ?? player.overall;

  // viewer's scouting skill: combine manager.scouting (if viewer is managed club)
  // and club scouting rating; fall back to club.scouting alone when no manager.
  const viewerClub = state.clubs[viewerClubId];
  const clubScout = viewerClub?.scouting?.rating ?? 40;
  const scoutingFacilityMultiplier = getFacilityEffectMultiplier(viewerClub, "scouting");
  let mgrScout = 0;
  if (state.manager && state.manager.clubId === viewerClubId)
    mgrScout = state.manager.scouting ?? 0;
  // also consider chief scout staff if present
  const staffScout =
    Object.values(state.staff ?? []).find((s) => s.clubId === viewerClubId && /scout/i.test(s.role))
      ?.rating ?? 0;

  const scoutSkill = Math.round(
    (clubScout * 0.5 + mgrScout * 0.35 + staffScout * 0.15) * scoutingFacilityMultiplier,
  );

  // Map skill to base half-range error: skill 0 -> 9, skill 100 -> 1
  const maxHalfRange = Math.max(1, Math.round(9 - (scoutSkill / 100) * 8));

  // deterministic jitter to avoid identical symmetric ranges for many players
  const seed = `${viewerClubId}:${playerId}`;
  const jitter = seededUnit(seed, 7);

  // lower/upper multipliers bias slightly downward for under-scouted players
  const lowerMult = 0.6 + jitter * 0.8; // 0.6..1.4
  const upperMult = 0.6 + (1 - jitter) * 0.8;

  const halfLower = Math.round(maxHalfRange * lowerMult);
  const halfUpper = Math.round(maxHalfRange * upperMult);

  const estimatedMin = Math.max(0, truePotential - halfLower);
  const estimatedMax = Math.min(100, truePotential + halfUpper);

  // Also provide a single-point 'best estimate' (midpoint rounded toward observed bias)
  const best = Math.round((estimatedMin + estimatedMax) / 2 - (scoutSkill - 50) / 200);

  return { min: estimatedMin, max: estimatedMax, estimate: best, scoutSkill };
}

export {};
