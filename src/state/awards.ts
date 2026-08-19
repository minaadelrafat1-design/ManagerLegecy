import type { GameState } from "./types";
import { seededUnit } from "./utils";

/** Generate simple season awards:
 * - Champion recognition already emitted by `season.ts`
 * - Golden Boot: choose deterministically from top-performing players (by reputation)
 * - Best Manager: pick manager with highest reputation
 */
export function generateSeasonAwards(state: GameState): GameState {
  const next = { ...state } as GameState;
  const news = [...(next.news ?? [])];
  const players = Object.values(next.players ?? {});
  if (players.length === 0) return state;
  // golden boot: top seasonGoals on Player records
  const withGoals = players.filter((p) => (p.seasonGoals ?? 0) > 0).slice();
  if (withGoals.length > 0) {
    withGoals.sort((a, b) => (b.seasonGoals ?? 0) - (a.seasonGoals ?? 0));
    const top = withGoals[0];
    if (top) {
      news.push({
        id: `news-award-gb-${news.length + 1}`,
        tag: "AWARD",
        time: state.time.date,
        text: `Golden Boot: ${top.name} (${top.seasonGoals ?? 0} goals)`,
      });
    }
  }

  // Best XI (rudimentary): choose by position from available players
  const byPos: Record<string, any[]> = {};
  for (const p of players) {
    const pos = (p.pos ?? "ST").toUpperCase();
    byPos[pos] = byPos[pos] ?? [];
    byPos[pos].push(p);
  }
  const pickTop = (posList: string[], count: number) => {
    const pool = posList.flatMap((pos) => byPos[pos] ?? []);
    pool.sort((a, b) => (b.seasonGoals ?? 0) - (a.seasonGoals ?? 0));
    return pool.slice(0, count);
  };
  const bestXI: any[] = [];
  bestXI.push(...pickTop(["GK"], 1));
  bestXI.push(...pickTop(["RB", "LB", "CB"], 4));
  bestXI.push(...pickTop(["CM", "CDM", "CAM"], 3));
  bestXI.push(...pickTop(["RW", "LW", "ST"], 3));
  if (bestXI.length > 0) {
    const names = bestXI.map((p) => p.name).slice(0, 11);
    news.push({
      id: `news-award-xi-${news.length + 1}`,
      tag: "AWARD",
      time: state.time.date,
      text: `Best XI: ${names.join(", ")}`,
    });
  }

  // best manager
  const mgr = next.manager;
  if (mgr)
    news.push({
      id: `news-award-mgr-${news.length + 1}`,
      tag: "AWARD",
      time: state.time.date,
      text: `Manager of the Year: ${mgr.name}`,
    });

  return { ...next, news };
}

export {};
