import { advanceGameDays } from "./calendar";
import type { GameState } from "./types";

/**
 * A small wrapper around the normal world clock. This should never disable the
 * global daily hook system: the actual issue was a debugging override that
 * made the app look stable while silently turning off all daily simulation.
 */
export function runWorldTick(state: GameState, days = 1) {
  return advanceGameDays(state, days);
}

export default runWorldTick;
