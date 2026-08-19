/* =============================================================================
 * GameState — React context, persistence, selector hooks
 * =============================================================================
 * This is the ONLY layer that knows about React and localStorage. It wires
 * the pure reducer (./reducer.ts) and the initial seed (./seed.ts) into the
 * app and exposes small selector hooks so screens read one shared state
 * instead of each importing static data independently.
 *
 * Persistence follows the same pattern already used by
 * `hooks/use-tactics.ts`: render the deterministic seed on both server and
 * first client paint (so SSR hydration matches), then load anything saved
 * in localStorage right after mount.
 * ---------------------------------------------------------------------------*/

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { gameReducer, type GameAction } from "./reducer";
import { buildInitialState, CURRENT_DATE, SEASON_START_DATE, preInitializeAiLedgers } from "./seed";
import { clearStorage, loadFromStorage, saveToStorage, type MigrationMap } from "./persistence";
import {
  addDaysISO,
  getTransferWindowStatus,
  selectNextFixture,
  type TransferWindowStatus,
} from "./calendar";
import { buildInitialTrainingPresets, getAllDrills } from "./training-presets";
import "./world-tick";
import "./ai-contracts";
import "./ai-transfers";
import "./ai-world-scheduler";
import "./ai-fixture-calendar";
import "./ai-evolution";
import "./training";
import "./board";
import "./fans";
import "./stadium";
import "./relationships";
import "./events-engine";
import "./form-updates-hook";
import "./negotiation-expiry";
import "./inbox";
import "./transfer-requests";
import "./manager-reputation-tracking";
import {
  computeLeagueTable,
  computeStandings,
  DEFAULT_STANDINGS_RULES,
  type StandingsRules,
} from "./standings";
import type { Club, Fixture, GameCalendarState, GameState, LeagueTableRow, Player } from "./types";

const STORAGE_KEY = "ml_game_state";

export function sanitizeLoadedGameState(state: GameState | null | undefined): GameState | null {
  if (!state || typeof state !== "object") return null;
  if (!state.time || !state.currentClub || !state.manager) return null;
  if (!state.clubs || typeof state.clubs !== "object") return null;
  if (!Array.isArray(state.fixtures)) return null;
  const month = state.time.date.slice(5, 7);
  const allowEmptyOffSeasonFixtures = month === "06" || month === "07";
  if (state.fixtures.length === 0 && !allowEmptyOffSeasonFixtures) return null;
  const validFixtures = state.fixtures.filter(
    (fixture) =>
      fixture &&
      typeof fixture === "object" &&
      typeof fixture.id === "string" &&
      typeof fixture.calendarDate === "string",
  );
  if (validFixtures.length === 0 && !allowEmptyOffSeasonFixtures) return null;
  const managedClubId = state.currentClub.id ?? state.manager.clubId;
  const todayManagerFixture = validFixtures.find(
    (fixture) =>
      fixture.calendarDate === state.time.date &&
      fixture.status === "scheduled" &&
      managedClubId != null &&
      (fixture.homeClubId === managedClubId || fixture.awayClubId === managedClubId),
  );
  return {
    ...state,
    ...(todayManagerFixture ? { pendingManagerFixtureId: todayManagerFixture.id } : {}),
  };
}

/** Bump this and add an entry to GAME_STATE_MIGRATIONS whenever GameState's
 * shape changes in a way old saves won't already satisfy — see the
 * migration usage note at the bottom of `./persistence.ts`. */
/** Exported (not just used internally) so test scripts — e.g.
 * `scripts/test-calendar.ts` — can exercise the exact chain a real old save
 * goes through, instead of hand-copying a partial migration map that
 * silently drifts out of sync with this one. */
export const GAME_STATE_MIGRATIONS: MigrationMap<GameState> = {
  // 1 -> 2 (Phase B1): saves from before the game calendar existed have no
  // `time` field. Backfill the same anchor/date `buildInitialState` seeds,
  // so an old save resumes on a valid clock instead of crashing on the
  // first ADVANCE_DAY.
  1: (data) => ({ ...(data as object), time: buildInitialState().time }),
  // 2 -> 3 (Phase B2): fixtures gain `season` and switch `played: boolean`
  // to `status: FixtureStatus`; leagues gain `competitionId` and drop the
  // old hardcoded `table` (the table is computed from fixtures now, see
  // `./standings.ts`, so there's nothing to migrate it TO — just stop
  // carrying the stale copy forward). Old league ids in this app have
  // always doubled as their own competition id, so that's a safe backfill.
  2: (data) => {
    const state = data as GameState;
    return {
      ...state,
      fixtures: state.fixtures.map((f) => {
        const legacy = f as Fixture & { played?: boolean };
        const { played, ...rest } = legacy;
        return {
          ...rest,
          season: f.season ?? state.time?.season ?? buildInitialState().time.season,
          status: f.status ?? (played ? "played" : "scheduled"),
        };
      }),
      leagues: Object.fromEntries(
        Object.entries(state.leagues).map(([id, league]) => {
          const legacy = league as GameState["leagues"][string] & { table?: unknown };
          const { table, ...rest } = legacy;
          return [id, { ...rest, competitionId: league.competitionId ?? id }];
        }),
      ),
    };
  },
  3: (data) => {
    const state = data as GameState;
    return {
      ...state,
      tactics: {
        mentality: 55,
        width: 68,
        depth: 55,
        tempo: 72,
        pressing: 60,
        instructions: {
          outFromBack: false,
          counterPress: false,
          workIntoBox: false,
          fullBacksWide: false,
        },
      },
    };
  },
  4: (data) => {
    const state = data as GameState;
    const activePlanId =
      state.training?.find((plan) => plan.id === state.selectedTrainingPlanId)?.id ??
      state.training?.[0]?.id;
    return {
      ...state,
      selectedTrainingPlanId: activePlanId,
    };
  },
  // 5 -> 6 (Unified Timeline): fixtures gain `calendarDate` (authoritative
  // ISO date) separate from `date` (display string). For old fixtures without
  // calendarDate, estimate it from matchday using a simple heuristic
  // (preseason + 7 days/matchday). GameState gains `pendingManagerFixtureId`
  // for matchday state. Club changes will re-detect fixtures.
  5: (data) => {
    const state = data as GameState;
    const seasonStart = state.time?.seasonStartDate ?? buildInitialState().time.seasonStartDate;
    const preseasonDays = 14; // two weeks of preseason before first matchday

    return {
      ...state,
      fixtures: (state.fixtures ?? []).map((f) => {
        // If calendarDate already exists, keep it; otherwise estimate from matchday
        const fixture = f as Fixture & { calendarDate?: string };
        if (fixture.calendarDate) return fixture;

        // Estimate: preseason days + (matchday - 1) * 7
        const estimatedDaysFromStart = preseasonDays + Math.max(0, (f.matchday || 1) - 1) * 7;
        const estimatedDate = addDaysISO(seasonStart, estimatedDaysFromStart);

        return {
          ...fixture,
          calendarDate: estimatedDate,
        };
      }),
      // Add pending manager fixture state if not present
      ...(state.pendingManagerFixtureId
        ? { pendingManagerFixtureId: state.pendingManagerFixtureId }
        : {}),
    };
  },
  // 6 -> 7 (Manager Inbox): GameState gains `inbox` and `inboxSettings` for
  // message-driven communication. Old saves have no inbox; initialize as empty
  // with default settings.
  6: (data) => {
    const state = data as GameState;
    return {
      ...state,
      inbox: [],
      inboxSettings: {
        archiveOldAfterDays: 30,
        dedupeWindowDays: 1,
      },
    };
  },
  // 7 -> 8 (Individual Training Presets): GameState gains `trainPresets` and
  // `trainDrills` for manager-controlled training. Old saves get 3 empty
  // presets and the full drill library.
  7: (data) => {
    const state = data as GameState;
    return {
      ...state,
      trainPresets: buildInitialTrainingPresets(),
      trainDrills: getAllDrills(),
    };
  },
  // 8 -> 9 (Office Financial Overview): GameState gains `financialTransactions`
  // ledger for comprehensive financial history tracking. Old saves get an empty
  // transaction list (all historical finances are lost, but current balance is preserved).
  8: (data) => {
    const state = data as GameState;
    return {
      ...state,
      financialTransactions: [],
    };
  },
  // 9 -> 10 (Scouting Network Foundation): Add the empty scouting network to
  // older saves so they can benefit from the new foundation without losing any
  // current state or finances. The network starts empty and can be upgraded later.
  9: (data) => {
    const state = data as GameState;
    return {
      ...state,
      scoutingNetwork: state.scoutingNetwork ?? { scouts: [], assignments: [] },
    };
  },
  // 10 -> 11 (Scouting Reports): Extend the scouting network with reports,
  // shortlisted players, and dismissed candidates. Old saves start with empty arrays.
  10: (data) => {
    const state = data as GameState;
    return {
      ...state,
      scoutingNetwork: {
        ...state.scoutingNetwork,
        reports: state.scoutingNetwork?.reports ?? [],
        shortlistedPlayerIds: state.scoutingNetwork?.shortlistedPlayerIds ?? [],
        dismissedPlayerIds: state.scoutingNetwork?.dismissedPlayerIds ?? [],
      },
      shortlistPlayerIds: state.shortlistPlayerIds ?? [],
    };
  },
  11: (data) => {
    const state = data as GameState;
    const base = buildInitialState();
    const seasonStartDate = base.time.seasonStartDate;
    const currentDate = base.time.date;
    const dayDelta = Math.max(
      0,
      (new Date(`${currentDate}T00:00:00.000Z`).getTime() -
        new Date(`${seasonStartDate}T00:00:00.000Z`).getTime()) /
        86_400_000,
    );
    return {
      ...state,
      time: {
        ...(state.time ?? base.time),
        date: currentDate,
        season: base.time.season,
        seasonStartDate,
        day: dayDelta + 1,
        week: Math.floor(dayDelta / 7) + 1,
      },
    };
  },
  // 12 -> 13 (Demo League Triple Round Robin): replace the old nine-team
  // demo schedule with the current 24-match-per-club schedule. Preserve
  // completed results that were actually in the past at the save date, but
  // never preserve the old bug where future generated fixtures were marked
  // played. Other competitions and all non-fixture state stay untouched.
  12: (data) => {
    const state = data as GameState;
    const currentSeason = String(state.time?.season ?? buildInitialState().time.season);
    const freshDemoFixtures = buildInitialState().fixtures.filter(
      (fixture) => fixture.competitionId === "national-league" && fixture.season === currentSeason,
    );
    if (freshDemoFixtures.length === 0) return state;

    const oldDemoFixtures = (state.fixtures ?? []).filter(
      (fixture) => fixture.competitionId === "national-league" && fixture.season === currentSeason,
    );
    const oldById = new Map(oldDemoFixtures.map((fixture) => [fixture.id, fixture]));
    const oldByPair = new Map<string, Fixture[]>();
    for (const fixture of oldDemoFixtures) {
      if (fixture.status !== "played" || fixture.calendarDate > state.time.date) continue;
      const pair = [fixture.homeClubId, fixture.awayClubId].sort().join("|");
      const entries = oldByPair.get(pair) ?? [];
      entries.push(fixture);
      oldByPair.set(pair, entries);
    }

    const migratedDemoFixtures = freshDemoFixtures.map((fixture) => {
      const pair = [fixture.homeClubId, fixture.awayClubId].sort().join("|");
      const direct = oldById.get(fixture.id);
      const matching =
        fixture.calendarDate > state.time.date
          ? undefined
          : direct !== undefined
            ? direct.status === "played" && direct.calendarDate <= state.time.date
              ? direct
              : undefined
            : oldByPair.get(pair)?.shift();
      const hasRecordedMatch = matching
        ? (state.matches ?? []).some((match) => match.fixtureId === matching.id)
        : false;
      const wasPlayedBeforeSave =
        matching?.status === "played" &&
        (matching.calendarDate < state.time.date || hasRecordedMatch);
      if (!wasPlayedBeforeSave) return fixture;
      return {
        ...fixture,
        status: "played" as const,
        result: matching.result,
        ...(matching.scoreHome !== undefined ? { scoreHome: matching.scoreHome } : {}),
        ...(matching.scoreAway !== undefined ? { scoreAway: matching.scoreAway } : {}),
      };
    });

    return {
      ...state,
      fixtures: [
        ...(state.fixtures ?? []).filter(
          (fixture) =>
            fixture.competitionId !== "national-league" || fixture.season !== currentSeason,
        ),
        ...migratedDemoFixtures,
      ],
    };
  },
  // 13 -> 14: repeat the demo schedule repair for saves that were already
  // upgraded before the future-fixture migration guard was corrected.
  13: (data) => GAME_STATE_MIGRATIONS[12]!(data),
};

export const GAME_STATE_VERSION = 14;

interface GameStateContextValue {
  state: GameState;
  dispatch: (action: GameAction) => void;
}

const GameStateContext = createContext<GameStateContextValue | null>(null);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [state, reducerDispatch] = useReducer(gameReducer, undefined, (init) => {
    const initial = buildInitialState();
    return preInitializeAiLedgers(initial);
  });

  const dispatch = useCallback(
    (action: GameAction) => {
      if (action.type === "SAVE_GAME") {
        saveToStorage(STORAGE_KEY, GAME_STATE_VERSION, state);
        return;
      }
      reducerDispatch(action);
    },
    [reducerDispatch, state],
  );

  // Client-only rehydrate from localStorage, once, after mount — same
  // hydration-safety rule as useTacticsSettings. A missing save just keeps
  // the freshly-seeded state; a corrupted one is logged and discarded
  // rather than crashing the app or wiping storage.
  useEffect(() => {
    const result = loadFromStorage<GameState>(
      STORAGE_KEY,
      GAME_STATE_VERSION,
      GAME_STATE_MIGRATIONS,
    );
    if (result.status === "ok") {
      const sanitized = sanitizeLoadedGameState(result.data);
      if (sanitized) {
        dispatch({ type: "RESET_GAME", state: sanitized });
      } else {
        console.warn(
          "[GameState] saved game was missing valid fixtures and was rejected; restoring the seeded state.",
        );
        clearStorage(STORAGE_KEY);
        dispatch({ type: "RESET_GAME", state: buildInitialState() });
      }
    } else if (result.status === "corrupted") {
      console.warn(
        `[GameState] saved game could not be loaded (${result.reason}) — starting a fresh save.`,
      );
      clearStorage(STORAGE_KEY);
      dispatch({ type: "RESET_GAME", state: buildInitialState() });
    }
    // "missing" needs no action: the reducer's lazy initializer already
    // produced the fresh seed used for this render.
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (
      window as typeof window & {
        __debugExportCurrentState?: (label?: string) => Record<string, unknown>;
        __debugStateSnapshot?: (label?: string) => {
          label: string;
          date: string;
          counts: Record<string, number>;
          state: GameState;
        };
      }
    ).__debugExportCurrentState = (label?: string) => {
      const snapshot = {
        label: label ?? "snapshot",
        date: state.time.date,
        day: state.time.day,
        season: state.time.season,
        counts: {
          fixtures: (state.fixtures ?? []).length,
          completedMatches: (state.matches ?? []).length,
          players: Object.keys(state.players ?? {}).length,
          clubs: Object.keys(state.clubs ?? {}).length,
          events: (state.events ?? []).length,
          inbox: (state.inbox ?? []).length,
          news: (state.news ?? []).length,
          transfers: (state.transfers ?? []).length,
          contracts: (state.contracts ?? []).length,
        },
        state,
      };
      console.log("[DEBUG_STATE]", snapshot);
      return snapshot;
    };
  }, [state]);

  const saveTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const persist = () => saveToStorage(STORAGE_KEY, GAME_STATE_VERSION, state);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        persist();
      }
    };

    const handleBeforeUnload = () => {
      persist();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      // Debounce state saves to avoid serializing the entire ~45MB state on every dispatch.
      // This keeps the UI responsive while still persisting changes every 250ms during
      // normal gameplay, plus immediately when the page is hidden or being unloaded.
      persist();
    }, 250);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <GameStateContext.Provider value={value}>{children}</GameStateContext.Provider>;
}

/** Raw access to the authoritative state + dispatch. Prefer the selector
 * hooks below for read-only screens; use this when a screen needs to
 * dispatch an action. */
export function useGameState(): GameStateContextValue {
  const ctx = useContext(GameStateContext);
  if (!ctx) throw new Error("useGameState must be used within a GameStateProvider");
  return ctx;
}

// ---- Read-only selector hooks ------------------------------------------------
// Thin, so screens keep the exact same values/shapes they used to import
// from `@/data/squad` — just sourced from the shared state instead of a
// static module.

/** All players for the manager's own club, in roster order. This is the
 * single list every screen (squad, player profile, training, transfers,
 * matches) derives its view from. */
export function useClubPlayers(clubId?: string): Player[] {
  const { state } = useGameState();
  return useMemo(() => {
    const id = clubId ?? state.currentClub.id;
    const club = state.clubs[id];
    if (!club) return [];
    return club.playerIds.map((id) => state.players[id]).filter((p): p is Player => !!p);
  }, [state.clubs, state.players, clubId, state.currentClub.id]);
}

export function useStartingXI(clubId?: string): Player[] {
  const players = useClubPlayers(clubId);
  return useMemo(() => players.filter((p) => p.starter), [players]);
}

export function useBench(clubId?: string): Player[] {
  const players = useClubPlayers(clubId);
  return useMemo(() => players.filter((p) => !p.starter), [players]);
}

export function usePlayer(id: string | null | undefined): Player | undefined {
  const { state } = useGameState();
  return id ? state.players[id] : undefined;
}

export function useCurrentClub(): Club {
  const { state } = useGameState();
  return state.currentClub;
}

export function useManager() {
  const { state } = useGameState();
  return state.manager;
}

// ---- Game calendar (Phase B1) ------------------------------------------------

/** The authoritative clock — date, season, week, day. */
export function useGameCalendar(): GameCalendarState {
  const { state } = useGameState();
  return state.time;
}

export function useNextFixture(): Fixture | undefined {
  const { state } = useGameState();
  return useMemo(() => selectNextFixture(state), [state]);
}

/** The league table for `leagueId`, recomputed from `state.fixtures` on
 * every render where a relevant piece of state changed (see
 * `computeStandings`) — nothing about it is stored, so a fresh
 * `RECORD_MATCH_RESULT` is reflected automatically without a separate
 * "update the table" step anywhere. Pass `rules` to view the same
 * fixtures under a different points/tiebreaker scheme; defaults to
 * `DEFAULT_STANDINGS_RULES`. */
export function useLeagueTable(
  leagueId: string,
  rules: StandingsRules = DEFAULT_STANDINGS_RULES,
): LeagueTableRow[] {
  const { state } = useGameState();
  const competitionId = state.leagues[leagueId]?.competitionId;
  return useMemo(() => {
    if (!competitionId) return [];
    return computeLeagueTable(state, leagueId, rules);
  }, [state.clubs, state.fixtures, competitionId, leagueId, rules]);
}

export function useTransferWindowStatus(): TransferWindowStatus {
  const { state } = useGameState();
  return useMemo(
    () => getTransferWindowStatus(state.time.date, String(state.time.season)),
    [state.time.date, state.time.season],
  );
}
