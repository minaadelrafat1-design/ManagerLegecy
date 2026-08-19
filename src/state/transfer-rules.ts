import { getTransferWindowStatus } from "./calendar";
import type { GameState } from "./types";

export function isFreeAgent(state: GameState, playerId: string): boolean {
  const p = state.players[playerId];
  if (!p) return false;
  // contractYears <= 0 or explicit released status
  if ((p as any).contractYears !== undefined && (p as any).contractYears <= 0) return true;
  // contract lifecycle slice may mark released
  const contract = (state.contracts ?? []).find((c) => c.playerId === playerId);
  if (contract && contract.status === "released") return true;
  return false;
}

/** Can `targetClubId` attempt to sign `playerId` on `dateISO`? Free agents
 * may be signed anytime; all other transfers require an open window. */
export function canSignPlayer(
  state: GameState,
  playerId: string,
  targetClubId: string,
  dateISO?: string,
): { allowed: boolean; reason?: string } {
  const date = dateISO ?? state.time.date;
  const window = getTransferWindowStatus(date, String(state.time.season));
  if (isFreeAgent(state, playerId)) return { allowed: true, reason: "free-agent" };
  if (window.isOpen) return { allowed: true, reason: `window-${window.windowName}` };
  return { allowed: false, reason: "market-closed" };
}

export function daysUntilWindowClose(state: GameState, dateISO?: string): number | null {
  const date = dateISO ?? state.time.date;
  const window = getTransferWindowStatus(date, String(state.time.season));
  if (!window.isOpen || !window.closesOn) return null;
  const from = new Date(`${date}T00:00:00Z`).getTime();
  const to = new Date(`${window.closesOn}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

export {};
