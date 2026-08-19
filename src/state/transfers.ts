import type { GameState } from "./types";
import { seededUnit } from "./utils";

/** Simple transfer window implementation:
 * - Runs once per season (preseason transfer window)
 * - Selects a small number of inter-AI transfers deterministically
 * - For the player's own club, may extend contracts deterministically
 */
export function runTransferWindow(state: GameState): GameState {
  let next = { ...state } as GameState;
  const clubs = Object.values(state.clubs);
  if (clubs.length < 2) return state;

  // make up to N transfers between AI clubs
  const maxTransfers = Math.max(1, Math.floor(clubs.length / 6));
  const events = [...(next.events ?? [])];
  for (let i = 0; i < maxTransfers; i++) {
    const seed = seededUnit(`${state.time.date}:transfer:${i}`);
    const a = clubs[Math.floor(seed * clubs.length)];
    const b = clubs[Math.floor(seededUnit(`${state.time.date}:transferb:${i}`) * clubs.length)];
    if (!a || !b || a.id === b.id) continue;
    // pick a player from a (if any) and move to b with deterministic chance
    const pid = (a.playerIds ?? [])[
      Math.floor(seededUnit(`${state.time.date}:transfer-p:${i}`) * (a.playerIds?.length ?? 1))
    ];
    if (!pid) continue;
    const chance = seededUnit(`${state.time.date}:transfer-chance:${i}`);
    if (chance < 0.25) {
      // perform transfer: reassign player's clubId and move id in lists
      const player = next.players?.[pid];
      if (!player) continue;
      const from = next.clubs[a.id];
      const to = next.clubs[b.id];
      if (!from || !to) continue;
      next = { ...next, players: { ...next.players, [pid]: { ...player, clubId: to.id } } } as any;
      next = {
        ...next,
        clubs: {
          ...next.clubs,
          [from.id]: { ...from, playerIds: (from.playerIds ?? []).filter((x) => x !== pid) },
          [to.id]: { ...to, playerIds: [...new Set([...(to.playerIds ?? []), pid])] },
        },
      } as any;
      events.push({
        id: `event-transfer-${events.length + 1}`,
        date: state.time.date,
        type: "transfer" as const,
        description: `${player.name} moved from ${from.name} to ${to.name}`,
      } as any);
    }
  }

  // contract extensions for managed club players (simple deterministic rule)
  const mgrClubId = next.manager?.clubId ?? next.currentClub?.id;
  if (mgrClubId) {
    const club = next.clubs[mgrClubId];
    if (club) {
      const pids = club.playerIds ?? [];
      for (let i = 0; i < Math.min(2, pids.length); i++) {
        const pid = pids[Math.floor(seededUnit(`${state.time.date}:ext:${i}`) * pids.length)];
        if (!pid) continue;
        const player = next.players?.[pid];
        if (!player) continue;
        // bump player's reputation slightly as 'contracted'
        next = {
          ...next,
          players: {
            ...next.players,
            [pid]: { ...player, reputation: Math.min(100, (player.reputation ?? 50) + 2) },
          },
        } as any;
        events.push({
          id: `event-contract-${events.length + 1}`,
          date: state.time.date,
          type: "milestone" as const,
          description: `${player.name} signed a contract extension`,
        } as any);
      }
    }
  }

  next = { ...next, events };
  return next;
}

export {};
