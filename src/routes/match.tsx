import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { T, Card, PrimaryButton, SecondaryButton, StatusBadge } from "@/components/ui";
import { TMod, ModPanel, ModSectionHead, ModBadge } from "@/components/ui-modern";
import {
  EVENT_META,
  Panel,
  SplitStat,
  TeamCrest,
  PhaseBadge,
  ConditionBar,
  currentCondition,
  describePlayerActivity,
  type MatchTeam,
  type MatchPhase,
  type PitchPlayer,
} from "@/components/match-bits";
import { Pitch } from "@/components/match-pitch";
import {
  simulateMatch,
  playerToSim,
  EXTENDED_DEFAULT_AWAY_TACTICS,
  type SimTeamInput,
  type SimMatchEvent,
  type SimPlayer,
} from "@/lib/match-engine";
import { applyCondition } from "@/lib/ai-match-adapter";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEventNotification } from "@/components/event-notification";
import { deriveTeamTactics, mentalityLabel } from "@/hooks/use-tactics";
import {
  useClubPlayers,
  useStartingXI,
  useBench,
  useCurrentClub,
  useGameState,
  useManager,
} from "@/state/store";
import { getClubPlayerIds, selectStartingXI } from "@/state/ai-decisions";
import { updateAllPlayerPositions, type PositioningContext } from "@/lib/match-player-positioning";
import type { Player, Club } from "@/state/types";
import { opponentXI as fallbackOpponentXI, opponentBench as fallbackOpponentBench } from "@/data/opponent";

export const Route = createFileRoute("/match")({
  head: () => ({
    meta: [
      { title: "Matchday Live — Manager Legacy" },
      {
        name: "description",
        content:
          "Live matchday centre: pitch view, scoreboard, running clock, player positions and key match events.",
      },
      { property: "og:title", content: "Matchday Live — Manager Legacy" },
      {
        property: "og:description",
        content:
          "Follow your club live: pitch view, scoreboard, running clock and key match events.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchScreen,
});

const DEFAULT_HOME_TEAM: MatchTeam = {
  name: "Your Club",
  short: "Club",
  abbr: "CLB",
  primary: "#19C37D",
  secondary: "#0E7A4E",
  text: "#04140C",
};

interface SubInfo {
  shortName: string;
  number: number;
  pos: string;
  fitness: number;
}

function phaseLabel(m: number, halfTime: number, fullTime: number) {
  if (m <= 0) return "Pre-match";
  if (m < halfTime) return "1st Half";
  if (m === halfTime) return "Half-time";
  if (m < 90) return "2nd Half";
  if (m < fullTime) return "+ Added time";
  return "Full-time";
}

function jitter(seed: number, minute: number, amp: number) {
  return Math.sin(seed * 12.9898 + minute * 0.55) * amp;
}

/** Applies red-card dismissals and substitutions (from the simulated event
 * timeline, up to `minute`) to a side's starting XI, so the pitch and the
 * "On the pitch" panel reflect what actually happened in the match rather
 * than a frozen team sheet. */
function applyMatchState(
  baseXI: PitchPlayer[],
  events: SimMatchEvent[],
  side: "home" | "away",
  minute: number,
  lookup: Map<string, SubInfo>,
): PitchPlayer[] {
  let list = baseXI.map((p) => ({ ...p }));
  for (const e of events) {
    if (e.minute > minute) break;
    if (e.side !== side || !e.meta) continue;
    if (e.type === "red" && e.meta.playerId) {
      const offId = e.meta.playerId;
      list = list.filter((p) => p.id !== offId);
    } else if (e.type === "sub" && e.meta.playerOffId && e.meta.playerInId) {
      const offId = e.meta.playerOffId;
      const inId = e.meta.playerInId;
      const info = lookup.get(inId);
      list = list.map((p) => {
        if (p.id !== offId) return p;
        if (!info) return p;
        return {
          ...p,
          id: inId,
          shortName: info.shortName,
          number: info.number,
          pos: info.pos,
          fitness: info.fitness,
        };
      });
    }
  }
  return list;
}

function subbedOnIds(events: SimMatchEvent[], side: "home" | "away", minute: number): Set<string> {
  const set = new Set<string>();
  for (const e of events) {
    if (e.minute > minute) break;
    if (e.side === side && e.type === "sub" && e.meta?.playerInId) set.add(e.meta.playerInId);
  }
  return set;
}

// Stable seed for the very first render (server + initial client hydration
// pass must agree, or React throws a hydration mismatch). A fresh random
// match is generated client-side right after mount instead — see the
// `useEffect` below that reseeds once the component is interactive.
const INITIAL_SEED = 20260809;

function MatchScreen() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { state, dispatch } = useGameState();
  const currentClub = useCurrentClub();
  const league = state.leagues[currentClub.leagueId];
  const players = useClubPlayers();
  const startingXI = useStartingXI();
  const bench = useBench();
  const { notify } = useEventNotification();

  // CRITICAL FIX: Capture the active fixture ID on mount so the match screen
  // remains stable throughout the entire match lifecycle, including after
  // RECORD_MATCH_RESULT changes the fixture status from "scheduled" to "played".
  // Without this, nextFixture would immediately switch to the next scheduled
  // fixture, causing a state/simulation mismatch and crash.
  const activeFixtureIdRef = useRef<string | undefined>(undefined);
  if (!activeFixtureIdRef.current && state.pendingManagerFixtureId) {
    activeFixtureIdRef.current = state.pendingManagerFixtureId;
  }

  // Find the active fixture by ID (stable throughout match lifetime), not by
  // searching for the first "scheduled" fixture (which changes after result recording).
  const nextFixture = useMemo(() => {
    const fixtureId = activeFixtureIdRef.current;
    if (!fixtureId) {
      // Fallback to first scheduled fixture (only during initial load before pendingManagerFixtureId is set)
      return state.fixtures.find(
        (f) =>
          f.status === "scheduled" &&
          (f.homeClubId === currentClub.id || f.awayClubId === currentClub.id),
      );
    }
    // Use the captured fixture ID to find the fixture, allowing it to be either
    // "scheduled" (before result) or "played" (after result recording)
    return state.fixtures.find((f) => f.id === fixtureId);
  }, [state.fixtures, currentClub.id]);

  // Determine home/away clubs from fixture (not from manager)
  const homeClub = nextFixture ? state.clubs[nextFixture.homeClubId] : undefined;
  const awayClub = nextFixture ? state.clubs[nextFixture.awayClubId] : undefined;

  // CRITICAL: Determine manager and opponent explicitly
  // The manager's club is ALWAYS currentClub, regardless of home/away in this fixture
  const managerClubId = currentClub.id;
  const isManagerHome = !!nextFixture && nextFixture.homeClubId === managerClubId;

  // Opponent is determined by the fixture
  const opponentClubId = nextFixture
    ? isManagerHome
      ? nextFixture.awayClubId
      : nextFixture.homeClubId
    : undefined;
  const managerClub = state.clubs[managerClubId] ?? currentClub;
  const opponentClub = opponentClubId ? state.clubs[opponentClubId] : undefined;

  const managerPlayerIds = managerClubId ? getClubPlayerIds(state, managerClubId) : [];
  const opponentPlayerIds = opponentClubId ? getClubPlayerIds(state, opponentClubId) : [];

  // Manager players: ALWAYS from manager's club, regardless of home/away
  const managerPlayers = useMemo(
    () => managerPlayerIds.map((id) => state.players[id]).filter((p): p is Player => !!p),
    [managerPlayerIds, state.players],
  );

  // Opponent players: Handle both state.players (real players) and simRoster (sim players)
  // If opponent has simRoster, those are already SimPlayer objects
  // If opponent has playerIds, look them up in state.players
  const opponentPlayers = useMemo(() => {
    if (!opponentClub) return [];

    // If opponent has simRoster, return those sim players directly
    // (they will be used differently in the match simulation)
    if (opponentClub.simRoster && opponentClub.simRoster.xi.length > 0) {
      return [...opponentClub.simRoster.xi, ...opponentClub.simRoster.bench] as unknown as Player[];
    }

    // Otherwise, look up in state.players
    return opponentPlayerIds.map((id) => state.players[id]).filter((p): p is Player => !!p);
  }, [opponentClub, opponentPlayerIds, state.players]);

  // Manager starting XI: from manager's players only
  const managerStartingXI = useMemo(() => {
    if (!managerClubId) return [];
    const xiIds = selectStartingXI(state, managerClubId);
    return xiIds.map((id) => state.players[id]).filter((p): p is Player => !!p);
  }, [state, managerClubId]);

  // Manager bench: from manager's players, excluding starting XI
  const managerBench = useMemo(() => {
    if (!managerClubId) return [];
    const xiIds = new Set(selectStartingXI(state, managerClubId));
    return managerPlayers.filter((p) => !xiIds.has(p.id));
  }, [managerClubId, managerPlayers]);

  // Opponent starting XI: from opponent's players only
  // When opponent has simRoster, use the XI directly from it
  const opponentStartingXI = useMemo(() => {
    if (!opponentClubId) return [];

    // Lightweight AI opponents own their full match roster in simRoster. Do
    // not resolve those ids through state.players: that map may only contain
    // one legacy placeholder record for the club.
    const simXI = opponentClub?.simRoster?.xi ?? [];
    if (simXI.length >= 11) return simXI.slice(0, 11) as unknown as Player[];

    // Otherwise, look up a normal club's XI from its authoritative players.
    const xiIds = selectStartingXI(state, opponentClubId);
    const resolved = xiIds.map((id) => state.players[id]).filter((p): p is Player => !!p);
    if (resolved.length >= 11) return resolved;
    if (simXI.length > 0) return simXI.slice(0, 11) as unknown as Player[];
    return fallbackOpponentXI.slice(0, 11).map((player) => ({
      ...player,
      id: `${opponentClubId}-${player.id}`,
    })) as unknown as Player[];
  }, [state, opponentClubId, opponentClub]);

  // Opponent bench: from opponent's players, excluding starting XI
  // When opponent has simRoster, use the bench directly from it
  const opponentBench = useMemo(() => {
    if (!opponentClubId) return [];

    // If opponent has simRoster, use bench directly
    if (opponentClub?.simRoster && opponentClub.simRoster.bench.length > 0) {
      return opponentClub.simRoster.bench as unknown as Player[];
    }

    // Otherwise, use regular bench calculation
    const xiIds = new Set(selectStartingXI(state, opponentClubId));
    const resolved = opponentPlayers.filter((p) => !xiIds.has(p.id));
    return resolved.length > 0
      ? resolved
      : (fallbackOpponentBench.map((player) => ({
          ...player,
          id: `${opponentClubId}-${player.id}`,
        })) as unknown as Player[]);
  }, [opponentClubId, opponentClub, opponentPlayers, state]);

  // Build UI team objects from actual fixture clubs. Keep the render null-safe
  // because stale fixtures can briefly exist after a result is recorded or while
  // the game is transitioning between match days.
  const HOME: MatchTeam = {
    ...DEFAULT_HOME_TEAM,
    name: homeClub?.name ?? currentClub.name,
    short: homeClub?.shortName ?? currentClub.shortName ?? "Club",
    abbr: homeClub?.abbr ?? currentClub.abbr ?? "CLB",
    primary: homeClub?.primaryColor ?? currentClub.primaryColor ?? DEFAULT_HOME_TEAM.primary,
    secondary:
      homeClub?.secondaryColor ?? currentClub.secondaryColor ?? DEFAULT_HOME_TEAM.secondary,
    text: homeClub?.textColor ?? currentClub.textColor ?? DEFAULT_HOME_TEAM.text,
  };

  const AWAY: MatchTeam = {
    ...DEFAULT_HOME_TEAM,
    name: awayClub?.name ?? "Opponent",
    short: awayClub?.shortName ?? "OPP",
    abbr: awayClub?.abbr ?? "OPP",
    primary: awayClub?.primaryColor ?? "#3B82F6",
    secondary: awayClub?.secondaryColor ?? "#1D4ED8",
    text: awayClub?.textColor ?? "#EAF2FF",
  };

  // Get formations
  const HOME_FORMATION = homeClub?.formation ?? "4-4-2";
  const AWAY_FORMATION = awayClub?.formation ?? "4-4-2";

  // For the screen, determine which formation to show for manager's lineup
  const MANAGER_FORMATION = isManagerHome ? HOME_FORMATION : AWAY_FORMATION;

  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);
  const [seed, setSeed] = useState(INITIAL_SEED);
  const feedRef = useRef<HTMLDivElement>(null);
  const tacticsSettings = state.tactics;

  const resultRecorded = useRef(false);

  // Build player lookups for substitutions
  // For home side: use actual players from GameState
  const homePlayerLookup = useMemo(
    () =>
      new Map<string, SubInfo>(
        (isManagerHome ? managerPlayers : opponentPlayers).map((p) => [
          p.id,
          {
            shortName: p.shortName,
            number: p.number,
            pos: p.pos,
            fitness: "fitness" in p ? p.fitness : 100, // SimPlayer doesn't have fitness, use default
          },
        ]),
      ),
    [isManagerHome, managerPlayers, opponentPlayers],
  );

  // For away side: use actual players from GameState
  const awayPlayerLookup = useMemo(
    () =>
      new Map<string, SubInfo>(
        (isManagerHome ? opponentPlayers : managerPlayers).map((p) => [
          p.id,
          {
            shortName: p.shortName,
            number: p.number,
            pos: p.pos,
            fitness: "fitness" in p ? p.fitness : 100, // SimPlayer doesn't have fitness, use default
          },
        ]),
      ),
    [isManagerHome, managerPlayers, opponentPlayers],
  );

  // Which player the manager currently has picked out — on the pitch list,
  // the bench or by tapping a token on the pitch. Drives the focus panel,
  // the pitch selection ring and the match-events filter below.
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [selectedSide, setSelectedSide] = useState<"home" | "away" | null>(null);
  const [eventsFilteredToSelection, setEventsFilteredToSelection] = useState(false);

  const selectPlayer = (id: string, side: "home" | "away") => {
    if (selectedPlayerId === id) {
      setSelectedPlayerId(null);
      setSelectedSide(null);
      setEventsFilteredToSelection(false);
    } else {
      setSelectedPlayerId(id);
      setSelectedSide(side);
    }
  };

  // Reseed once on the client after hydration so every page load still gets
  // a different simulated match, without the server/client render mismatch
  // that picking a random seed during render would cause.
  useEffect(() => {
    setSeed(Math.floor(Math.random() * 0xffffffff));
  }, []);

  const manager = useManager();
  const tactics = useMemo(() => deriveTeamTactics(tacticsSettings), [tacticsSettings]);

  // Build the two sides for the simulation from the existing squad data —
  // real attributes drive real ratings, so no match plays out the same way.
  const sim = useMemo(() => {
    // Determine which side is the manager's (home or away)
    const managerSide = isManagerHome ? "home" : "away";
    const managerAbilities = manager;
    const managerTactics = tactics;

    // Apply contextual modifiers to a player for simulation
    function applyContextToPlayer(
      p: Player,
      formation: string,
      isManager: boolean,
      managerAbilities?: typeof manager,
    ) {
      let sim = playerToSim(p);
      // morale/form multiplier (same as AI adapter)
      sim = applyCondition(sim, p.morale ?? 50, p.form ?? 50);
      // tactical familiarity with the chosen formation
      const fam = (p.tacticalFamiliarity && p.tacticalFamiliarity[formation]) ?? 50;
      const famFactor = Math.max(0.88, Math.min(1.12, 1 + (fam - 65) / 260));
      // manager abilities lightly modify player output (tactics/coaching)
      let mgrFactor = 1;
      if (isManager && managerAbilities) {
        mgrFactor = Math.max(
          0.92,
          Math.min(
            1.1,
            1 +
              ((managerAbilities.playerDevelopment ?? 50) - 50) / 600 +
              ((managerAbilities.tactics ?? 50) - 50) / 900,
          ),
        );
      }
      sim = {
        ...sim,
        attack: Math.round(Math.max(1, Math.min(100, sim.attack * famFactor * mgrFactor))),
        defend: Math.round(Math.max(1, Math.min(100, sim.defend * famFactor * mgrFactor))),
        playmaking: Math.round(Math.max(1, Math.min(100, sim.playmaking * famFactor * mgrFactor))),
      };
      // injured players: reduce baseFitness a lot
      if (p.status === "injured") sim.baseFitness = Math.min(sim.baseFitness, 45);
      return sim;
    }

    // Helper to convert SimPlayer (from simRoster) or Player to SimPlayer for the engine
    // SimPlayer objects are used as-is; Player objects are converted via playerToSim
    function playerToSimIfNeeded(p: any, formation?: string): SimPlayer {
      // If it's already a SimPlayer (has all sim properties), return as-is
      if (p.baseFitness !== undefined && p.attack !== undefined && p.defend !== undefined) {
        return p as SimPlayer;
      }
      // Otherwise it's a Player — convert via playerToSim
      const sim = playerToSim(p as Player);
      // Apply morale/form for Player objects
      if ("morale" in p || "form" in p) {
        return applyCondition(sim, (p as Player).morale ?? 50, (p as Player).form ?? 50);
      }
      return sim;
    }

    const isSimRosterPlayer = (p: any): p is SimPlayer =>
      p?.baseFitness !== undefined && p?.attack !== undefined && p?.defend !== undefined;

    // Build home side
    const homeXI = isManagerHome ? managerStartingXI : opponentStartingXI;
    const homeBenchPlayers = isManagerHome ? managerBench : opponentBench;

    // Determine if home side uses simRoster
    const homeUsesSimRoster = !isManagerHome && homeXI.some(isSimRosterPlayer);

    const homeInput: SimTeamInput = {
      id: "home",
      name: HOME.name,
      xi: homeXI.map((p) =>
        homeUsesSimRoster
          ? playerToSimIfNeeded(p)
          : applyContextToPlayer(p, HOME_FORMATION, isManagerHome, managerAbilities),
      ),
      bench: homeBenchPlayers.map((p) =>
        homeUsesSimRoster
          ? playerToSimIfNeeded(p)
          : applyContextToPlayer(p, HOME_FORMATION, isManagerHome, managerAbilities),
      ),
      tactics: isManagerHome ? managerTactics : EXTENDED_DEFAULT_AWAY_TACTICS,
      homeAdvantage: true,
      formation: HOME_FORMATION,
    };

    // Build away side
    const awayXI = isManagerHome ? opponentStartingXI : managerStartingXI;
    const awayBenchPlayers = isManagerHome ? opponentBench : managerBench;

    // Determine if away side uses simRoster
    const awayUsesSimRoster = isManagerHome && awayXI.some(isSimRosterPlayer);

    const awayInput: SimTeamInput = {
      id: "away",
      name: AWAY.name,
      xi: awayXI.map((p) =>
        awayUsesSimRoster
          ? playerToSimIfNeeded(p)
          : applyContextToPlayer(
              p,
              AWAY_FORMATION,
              !isManagerHome,
              !isManagerHome ? managerAbilities : undefined,
            ),
      ),
      bench: awayBenchPlayers.map((p) =>
        awayUsesSimRoster
          ? playerToSimIfNeeded(p)
          : applyContextToPlayer(
              p,
              AWAY_FORMATION,
              !isManagerHome,
              !isManagerHome ? managerAbilities : undefined,
            ),
      ),
      tactics: isManagerHome ? EXTENDED_DEFAULT_AWAY_TACTICS : managerTactics,
      formation: AWAY_FORMATION,
    };

    return simulateMatch(homeInput, awayInput, seed);
  }, [
    seed,
    managerStartingXI,
    managerBench,
    opponentStartingXI,
    opponentBench,
    HOME_FORMATION,
    AWAY_FORMATION,
    manager,
    tactics,
    isManagerHome,
  ]);

  const FULL_TIME = sim.fullTimeMinute;

  useEffect(() => {
    if (!playing || minute >= FULL_TIME) return;
    const id = window.setInterval(() => {
      setMinute((m) => (m >= FULL_TIME ? m : m + 1));
    }, 1600 / speed);
    return () => window.clearInterval(id);
  }, [playing, speed, minute, FULL_TIME]);

  useEffect(() => {
    if (minute >= FULL_TIME) setPlaying(false);
  }, [minute, FULL_TIME]);

  const events = useMemo(() => {
    const upToNow = sim.events.filter((e) => e.minute <= minute);
    const scoped =
      eventsFilteredToSelection && selectedPlayerId
        ? upToNow.filter(
            (e) =>
              e.meta?.playerId === selectedPlayerId ||
              e.meta?.assistId === selectedPlayerId ||
              e.meta?.playerOffId === selectedPlayerId ||
              e.meta?.playerInId === selectedPlayerId,
          )
        : upToNow;
    return scoped.reverse();
  }, [sim, minute, eventsFilteredToSelection, selectedPlayerId]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [events.length]);

  const homeScore = useMemo(
    () =>
      sim.events.filter((e) => e.type === "goal" && e.side === "home" && e.minute <= minute).length,
    [sim, minute],
  );
  const awayScore = useMemo(
    () =>
      sim.events.filter((e) => e.type === "goal" && e.side === "away" && e.minute <= minute).length,
    [sim, minute],
  );

  // Write the completed match back into the shared GameState once full time
  // is reached — the connection point between the simulation (pure,
  // stateless) and the authoritative fixtures/matches history.
  useEffect(() => {
    if (!nextFixture || minute < FULL_TIME || resultRecorded.current) return;
    resultRecorded.current = true;
    dispatch({
      type: "RECORD_MATCH_RESULT",
      fixtureId: nextFixture.id,
      homeClubId: nextFixture.homeClubId,
      awayClubId: nextFixture.awayClubId,
      scoreHome: homeScore,
      scoreAway: awayScore,
      seed,
      playedAt: nextFixture.calendarDate,
      playerRatings: sim.playerRatings,
    });

    // Notify the user of the match result
    const result = homeScore > awayScore ? "W" : homeScore < awayScore ? "L" : "D";
    const managerResult = isManagerHome
      ? result
      : result === "W"
        ? "L"
        : result === "L"
          ? "W"
          : "D";
    const resultEmoji = managerResult === "W" ? "🏆" : managerResult === "D" ? "🤝" : "😔";
    const resultText =
      managerResult === "W" ? "Victory" : managerResult === "D" ? "Draw" : "Defeat";
    const type: "success" | "warning" | "error" | "info" =
      managerResult === "W" ? "success" : managerResult === "D" ? "info" : "warning";

    notify({
      title: `${resultEmoji} Match Finished`,
      message: `${homeClub?.name || "Home"} ${homeScore}-${awayScore} ${awayClub?.name || "Away"} • ${resultText}`,
      type,
      duration: 6000,
    });
  }, [
    minute,
    FULL_TIME,
    homeScore,
    awayScore,
    seed,
    dispatch,
    nextFixture,
    sim.playerRatings,
    notify,
    isManagerHome,
    homeClub,
    awayClub,
  ]);

  const snap = sim.snapshots[Math.min(minute, sim.fullTimeMinute)] ?? sim.snapshots[0];

  // Territory shifts with the actual flow of the simulated game — home push
  // when they're enjoying more of the ball, away push otherwise.
  const push = ((snap?.possessionHome ?? 50) - 50) * 0.12;

  const homeBaseXI: PitchPlayer[] = useMemo(
    () =>
      (isManagerHome ? managerStartingXI : opponentStartingXI).map((p) => ({
        id: p.id,
        shortName: p.shortName,
        number: p.number,
        pos: p.pos,
        fitness: p.fitness,
        role: p.role,
        tacticalConfig: p.tacticalConfig,
        x: p.x ?? 50,
        y: p.y ?? 50,
      })),
    [isManagerHome, managerStartingXI, opponentStartingXI],
  );

  const awayBaseXI: PitchPlayer[] = useMemo(
    () =>
      (isManagerHome ? opponentStartingXI : managerStartingXI).map((p) => ({
        id: p.id,
        shortName: p.shortName,
        number: p.number,
        pos: p.pos,
        fitness: p.fitness,
        role: p.role,
        tacticalConfig: p.tacticalConfig,
        x: p.x ?? 50,
        y: p.y ?? 50,
      })),
    [isManagerHome, managerStartingXI, opponentStartingXI],
  );

  const homeLive = useMemo(
    () => applyMatchState(homeBaseXI, sim.events, "home", minute, homePlayerLookup),
    [homeBaseXI, sim, minute, homePlayerLookup],
  );
  const awayLive = useMemo(
    () => applyMatchState(awayBaseXI, sim.events, "away", minute, awayPlayerLookup),
    [awayBaseXI, sim, minute, awayPlayerLookup],
  );

  // Find the ball from the latest real match event first. The old rotating
  // home-player fallback made away possession appear to move around a home
  // player and caused the movement model to pull both shapes incorrectly.
  const possessionPercent = snap?.possessionHome ?? 50;
  const attackingTeam: "home" | "away" = possessionPercent >= 50 ? "home" : "away";
  const defendingTeam: "home" | "away" = possessionPercent >= 50 ? "away" : "home";
  const latestEventPlayerId = [...sim.events]
    .reverse()
    .find((event) => event.minute <= minute && event.meta?.playerId)?.meta?.playerId;
  const ballOwnerTemp: PitchPlayer | undefined =
    (latestEventPlayerId
      ? homeLive.find((player) => player.id === latestEventPlayerId) ??
        awayLive.find((player) => player.id === latestEventPlayerId)
      : undefined) ??
    (attackingTeam === "home" ? homeLive : awayLive)[(minute % 8) + 3] ??
    (attackingTeam === "home" ? homeLive : awayLive)[0];
  const ballPosX = ballOwnerTemp?.x ?? 50;
  const ballPosY = ballOwnerTemp?.y ?? 50;

  // Create positioning context for dynamic player movement
  const positioningContext: PositioningContext = useMemo(
    () => ({
      ballX: ballPosX,
      ballY: ballPosY,
      possession: attackingTeam,
      minute,
      attackingTeam,
      defendingTeam,
      width: tacticsSettings.width,
      depth: tacticsSettings.depth,
      tempo: tacticsSettings.tempo,
      pressing: tacticsSettings.pressing,
      mentality: tacticsSettings.mentality,
      formation: isManagerHome ? HOME_FORMATION : AWAY_FORMATION,
      awayFormation: isManagerHome ? AWAY_FORMATION : HOME_FORMATION,
    }),
    [
      ballPosX,
      ballPosY,
      attackingTeam,
      defendingTeam,
      minute,
      tacticsSettings.width,
      tacticsSettings.depth,
      tacticsSettings.tempo,
      tacticsSettings.pressing,
      tacticsSettings.mentality,
      isManagerHome,
      HOME_FORMATION,
      AWAY_FORMATION,
    ],
  );

  // Update player positions dynamically based on match state
  const dynamicPositions = useMemo(
    () => updateAllPlayerPositions(homeLive, awayLive, positioningContext),
    [homeLive, awayLive, positioningContext],
  );

  // Apply smooth transitions and jitter
  const homePlayers: PitchPlayer[] = useMemo(
    () =>
      dynamicPositions.homePlayers.map((p, i) => ({
        ...p,
        // Add slight jitter for realism but keep players mostly at their dynamic positions
        x: Math.min(94, Math.max(6, p.x + jitter(i + 1, minute, 0.8))),
        y: Math.min(94, Math.max(6, p.y + jitter(i + 7, minute, 0.6))),
      })),
    [dynamicPositions, minute],
  );

  const awayPlayers: PitchPlayer[] = useMemo(
    () =>
      dynamicPositions.awayPlayers.map((p, i) => ({
        ...p,
        // Add slight jitter for realism but keep players mostly at their dynamic positions
        x: Math.min(94, Math.max(6, p.x + jitter(i + 3, minute, 0.8))),
        y: Math.min(94, Math.max(6, p.y + jitter(i + 11, minute, 0.6))),
      })),
    [dynamicPositions, minute],
  );

  // Highlight whoever was last involved in a live event, so the ball tracks
  // the actual simulated action rather than a fixed rotation.
  const recentActor = useMemo(() => {
    for (let i = sim.events.length - 1; i >= 0; i--) {
      const e = sim.events[i];
      if (!e || e.minute > minute || e.side === "neutral") continue;
      const playerId = e.meta?.playerId;
      if (playerId && minute - e.minute <= 2) return { side: e.side, playerId };
      if (e.minute < minute - 2) break;
    }
    return null;
  }, [sim, minute]);

  const ballOwner: PitchPlayer | undefined =
    (recentActor?.side === "home"
      ? homePlayers.find((p) => p.id === recentActor.playerId)
      : undefined) ??
    (recentActor?.side === "away"
      ? awayPlayers.find((p) => p.id === recentActor.playerId)
      : undefined) ??
    homePlayers[(minute % 8) + 3] ??
    homePlayers[0];
  const ball = { x: ballOwner?.x ?? 50, y: (ballOwner?.y ?? 50) - 3 };

  const possession = snap?.possessionHome ?? 50;

  // Which side is on the front foot right now: whoever was last involved in
  // a live event, falling back to the running possession share. This is the
  // same signal that already drives the ball marker, just surfaced as a
  // readable attacking/defending state for both teams.
  const attackingSide: "home" | "away" = recentActor?.side ?? (possession >= 50 ? "home" : "away");
  const homePhase: MatchPhase = attackingSide === "home" ? "attacking" : "defending";
  const awayPhase: MatchPhase = attackingSide === "away" ? "attacking" : "defending";
  const shotsHome = snap?.home.shots ?? 0;
  const shotsAway = snap?.away.shots ?? 0;
  const onTargetHome = snap?.home.shotsOnTarget ?? 0;
  const onTargetAway = snap?.away.shotsOnTarget ?? 0;
  const cornersHome = snap?.home.corners ?? 0;
  const cornersAway = snap?.away.corners ?? 0;
  const foulsHome = snap?.home.fouls ?? 0;
  const foulsAway = snap?.away.fouls ?? 0;

  const homeBenchLive = useMemo(() => {
    const used = subbedOnIds(sim.events, "home", minute);
    const benchPlayers = isManagerHome ? managerBench : opponentBench;
    return benchPlayers.filter((p) => !used.has(p.id));
  }, [sim, minute, isManagerHome, managerBench, opponentBench]);

  // Everything the "Selected player" panel needs, gathered from state that
  // already exists elsewhere on this screen (pitch lists, bench, the event
  // timeline, the live phase) rather than tracked separately — so selection
  // is always in sync with whatever the match is doing this minute.
  const selectedInfo = useMemo(() => {
    if (!selectedPlayerId || !selectedSide) return null;
    const pitchPool = selectedSide === "home" ? homePlayers : awayPlayers;
    const onPitchPlayer = pitchPool.find((p) => p.id === selectedPlayerId);
    const benchPlayer =
      !onPitchPlayer && selectedSide === "home"
        ? homeBenchLive.find((p) => p.id === selectedPlayerId)
        : undefined;
    const base = onPitchPlayer ?? benchPlayer;
    if (!base) return null;

    const team = selectedSide === "home" ? HOME : AWAY;
    const formation = selectedSide === "home" ? HOME_FORMATION : AWAY_FORMATION;
    const phase = selectedSide === "home" ? homePhase : awayPhase;
    const isBallCarrier = !!onPitchPlayer && ballOwner?.id === selectedPlayerId;

    const lastEvent = sim.events
      .filter(
        (e) =>
          e.minute <= minute &&
          (e.meta?.playerId === selectedPlayerId ||
            e.meta?.assistId === selectedPlayerId ||
            e.meta?.playerInId === selectedPlayerId),
      )
      .at(-1);
    const showEventText = !!lastEvent && minute - lastEvent.minute <= 4;

    const activity = isBallCarrier
      ? "On the ball"
      : showEventText
        ? lastEvent!.text
        : onPitchPlayer
          ? describePlayerActivity({ pos: base.pos, phase, isBallCarrier: false })
          : "On the bench — not currently in the match";

    return {
      id: base.id,
      shortName: base.shortName,
      number: base.number,
      pos: base.pos,
      side: selectedSide,
      team,
      formation,
      phase,
      onPitch: !!onPitchPlayer,
      isBallCarrier,
      condition: onPitchPlayer ? currentCondition(base.fitness, minute) : base.fitness,
      activity,
      lastEventMinute: showEventText ? lastEvent!.minute : null,
    };
  }, [
    selectedPlayerId,
    selectedSide,
    homePlayers,
    awayPlayers,
    homeBenchLive,
    homePhase,
    awayPhase,
    ballOwner,
    sim,
    minute,
    HOME_FORMATION,
    AWAY_FORMATION,
  ]);

  const timeLabel =
    minute > 90 && minute < sim.fullTimeMinute
      ? `90+${minute - 90}'`
      : minute > 45 && minute <= sim.halfTimeMinute
        ? `45+${minute - 45}'`
        : `${Math.min(minute, 90)}'`;

  const sideGap = 16;

  const matchFinished = minute >= FULL_TIME && resultRecorded.current;
  // Show "No Match Today" only if:
  // - Match is not finished AND
  // - Either no fixture exists, or fixture is not today, or fixture is scheduled and ready to play
  const noFixtureToday =
    !matchFinished &&
    (!nextFixture ||
      nextFixture.calendarDate !== state.time.date ||
      (nextFixture.status !== "scheduled" && nextFixture.status !== "played"));
  const matchDataMissing = !homeClub || !awayClub || !managerClub || !opponentClub;

  if (noFixtureToday) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: T.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          padding: 24,
        }}
      >
        <Card>
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 8 }}>
              No Match Today
            </div>
            <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 24 }}>
              Your club has no fixture scheduled for{" "}
              {new Date(`${state.time.date}T00:00:00Z`).toLocaleDateString()}.
              {nextFixture && (
                <div style={{ marginTop: 8 }}>
                  Next match is {nextFixture.date} ({nextFixture.calendarDate}).
                </div>
              )}
            </div>
            <Link to="/">
              <PrimaryButton>Return to Dashboard</PrimaryButton>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (matchDataMissing && !matchFinished) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: T.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 16,
          padding: 24,
        }}
      >
        <Card>
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 8 }}>
              Match Error
            </div>
            <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 24 }}>
              Unable to load club data. Please check your teams.
            </div>
            <Link to="/">
              <PrimaryButton>Return to Dashboard</PrimaryButton>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${TMod.bgPrimary} 0%, ${TMod.bgSecondary} 100%)`,
        paddingBottom: 40,
        color: TMod.textPrimary,
      }}
    >
      {/* IMMERSIVE HUD: Minimal, Restrained Scoreboard */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: `linear-gradient(180deg, rgba(10,14,27,0.95) 0%, rgba(10,14,27,0.85) 100%)`,
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${TMod.borderMid}`,
          padding: isMobile ? "12px 14px" : "14px 20px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          {/* HOME TEAM - LEFT */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 0.4, minWidth: 0 }}>
            <TeamCrest team={HOME} size={isMobile ? 28 : 36} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{ fontSize: isMobile ? 11 : 12, fontWeight: "700", color: TMod.textPrimary }}
              >
                {isMobile ? HOME.short : HOME.name.toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: isMobile ? 8 : 9,
                  color: TMod.textTertiary,
                  fontWeight: "600",
                  letterSpacing: "0.05em",
                }}
              >
                {HOME_FORMATION}
              </div>
            </div>
          </div>

          {/* SCORE & CLOCK - CENTER (LARGE, BOLD) */}
          <div style={{ textAlign: "center", flexShrink: 0, flex: 0.2 }}>
            <div
              style={{
                fontFamily: "'Chakra Petch', sans-serif",
                fontSize: isMobile ? 32 : 48,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                color: TMod.accentGreen,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                textShadow: `0 0 20px ${TMod.accentGreen}40`,
              }}
            >
              {homeScore}–{awayScore}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 4,
              }}
            >
              <div
                style={{
                  fontSize: isMobile ? 9 : 10,
                  fontWeight: "800",
                  color: TMod.accentCyan,
                  letterSpacing: "0.05em",
                }}
              >
                {minute >= FULL_TIME ? "FT" : timeLabel}
              </div>
              <div
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: minute >= FULL_TIME ? TMod.accentGold : TMod.accentGreen,
                  boxShadow: `0 0 8px ${minute >= FULL_TIME ? TMod.accentGold : TMod.accentGreen}`,
                }}
              />
              <div
                style={{
                  fontSize: isMobile ? 7.5 : 8.5,
                  fontWeight: "600",
                  color: TMod.textTertiary,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {phaseLabel(minute, sim.halfTimeMinute, sim.fullTimeMinute)}
              </div>
            </div>
          </div>

          {/* AWAY TEAM - RIGHT */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 8,
              flex: 0.4,
              minWidth: 0,
            }}
          >
            <div style={{ minWidth: 0, textAlign: "right" }}>
              <div
                style={{ fontSize: isMobile ? 11 : 12, fontWeight: "700", color: TMod.textPrimary }}
              >
                {isMobile ? AWAY.short : AWAY.name.toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: isMobile ? 8 : 9,
                  color: TMod.textTertiary,
                  fontWeight: "600",
                  letterSpacing: "0.05em",
                }}
              >
                {AWAY_FORMATION}
              </div>
            </div>
            <TeamCrest team={AWAY} size={isMobile ? 28 : 36} />
          </div>
        </div>

        {/* MATCH PROGRESS BAR */}
        <div
          style={{
            maxWidth: 1400,
            margin: "10px auto 0",
            height: 2,
            borderRadius: 999,
            background: `${TMod.borderLight}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(Math.min(minute, FULL_TIME) / FULL_TIME) * 100}%`,
              height: "100%",
              background: `linear-gradient(90deg, ${TMod.accentGreen}, ${TMod.accentCyan})`,
              transition: "width .5s linear",
            }}
          />
        </div>
      </div>

      {/* MAIN GAME AREA */}
      <div
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: isMobile ? "12px" : "16px 20px",
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1fr 320px",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* PITCH - PRIMARY FOCUS */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderMid}`,
              boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
            }}
          >
            {/* PITCH INFO HEADER */}
            <div
              style={{
                padding: "10px 14px",
                background: TMod.bgTertiary,
                borderBottom: `1px solid ${TMod.borderLight}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: "700",
                    color: TMod.textTertiary,
                    letterSpacing: "0.08em",
                    marginBottom: 2,
                  }}
                >
                  {currentClub.ground}
                </div>
                <div style={{ fontSize: 9, color: TMod.textTertiary, fontWeight: "500" }}>
                  {league?.matchday ? `Matchday ${league.matchday}` : `Day ${state.time.day}`} ·
                  Clear, 9°C
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, fontSize: 9, fontWeight: "700" }}>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: TMod.textSecondary,
                  }}
                >
                  <span
                    style={{ width: 8, height: 8, borderRadius: "50%", background: HOME.primary }}
                  />
                  {HOME.abbr}
                </div>
                <span style={{ color: TMod.textTertiary }}>·</span>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    color: TMod.textSecondary,
                  }}
                >
                  <span
                    style={{ width: 8, height: 8, borderRadius: "50%", background: AWAY.primary }}
                  />
                  {AWAY.abbr}
                </div>
              </div>
            </div>

            {/* PITCH VISUALIZATION */}
            <Pitch
              home={homePlayers}
              away={awayPlayers}
              homeTeam={HOME}
              awayTeam={AWAY}
              ball={ball}
              compact={!!isMobile}
              ballOwnerId={ballOwner?.id ?? null}
              selectedId={selectedPlayerId}
              onSelectPlayer={selectPlayer}
            />

            {/* MATCH CONTROLS - Minimal & Accessible */}
            <div
              style={{
                padding: "12px 14px",
                borderTop: `1px solid ${TMod.borderLight}`,
                background: TMod.bgTertiary,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {minute >= FULL_TIME ? (
                  <button
                    onClick={() => {
                      activeFixtureIdRef.current = undefined;
                      navigate({ to: "/" });
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 6,
                      border: "none",
                      background: TMod.gradientGreen,
                      color: "#000",
                      fontSize: 10,
                      fontWeight: "700",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.boxShadow = `0 4px 12px ${TMod.accentGreen}40`)
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                  >
                    Continue
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setPlaying((p) => !p)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: "none",
                        background: playing ? TMod.gradientGreen : TMod.bgPanel,
                        color: playing ? "#000" : TMod.textSecondary,
                        fontSize: 10,
                        fontWeight: "700",
                        cursor: "pointer",
                        borderTop: !playing ? `2px solid ${TMod.accentCyan}` : "none",
                        transition: "all 0.2s",
                      }}
                    >
                      {playing ? "⏸ Pause" : "▶ Play"}
                    </button>
                    <button
                      onClick={() => setMinute((m) => Math.min(FULL_TIME, m + 5))}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 6,
                        border: `1px solid ${TMod.borderLight}`,
                        background: "transparent",
                        color: TMod.textSecondary,
                        fontSize: 10,
                        fontWeight: "700",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        const target = e.currentTarget as HTMLButtonElement;
                        target.style.background = TMod.bgPanel;
                        target.style.borderColor = TMod.accentCyan;
                      }}
                    >
                      Skip 5'
                    </button>
                    {minute < FULL_TIME && (
                      <button
                        onClick={() => setMinute(FULL_TIME)}
                        style={{
                          padding: "8px 14px",
                          borderRadius: 6,
                          border: `1px solid ${TMod.borderLight}`,
                          background: "transparent",
                          color: TMod.textSecondary,
                          fontSize: 10,
                          fontWeight: "700",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        Sim to end
                      </button>
                    )}
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[1, 2, 4].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 999,
                      fontSize: 9,
                      fontWeight: "700",
                      fontFamily: "'Chakra Petch', sans-serif",
                      cursor: "pointer",
                      color: speed === s ? "#000" : TMod.textTertiary,
                      background: speed === s ? TMod.accentGreen : TMod.bgPanel,
                      border: `1px solid ${speed === s ? TMod.accentGreen : TMod.borderLight}`,
                      transition: "all 0.2s",
                    }}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* MATCH STATISTICS */}
          <div
            style={{
              borderRadius: 12,
              overflow: "hidden",
              background: TMod.bgPanel,
              border: `1px solid ${TMod.borderMid}`,
              padding: "14px",
            }}
          >
            <h3
              style={{
                fontSize: 11,
                fontWeight: "800",
                color: TMod.textPrimary,
                marginBottom: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Match Stats
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {[
                {
                  label: "Possession",
                  homeVal: possession.toFixed(0),
                  awayVal: (100 - possession).toFixed(0),
                },
                { label: "Shots", homeVal: shotsHome, awayVal: shotsAway },
                { label: "On Target", homeVal: onTargetHome, awayVal: onTargetAway },
                { label: "Corners", homeVal: cornersHome, awayVal: cornersAway },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{ padding: "8px", borderRadius: "6px", background: TMod.bgTertiary }}
                >
                  <div
                    style={{
                      fontSize: 8.5,
                      fontWeight: "600",
                      color: TMod.textTertiary,
                      marginBottom: 4,
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: 11,
                      fontWeight: "800",
                    }}
                  >
                    <span style={{ color: HOME.primary }}>{stat.homeVal}</span>
                    <span style={{ color: TMod.textTertiary, fontSize: 8 }}>·</span>
                    <span style={{ color: AWAY.primary }}>{stat.awayVal}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT SIDEBAR - Player & Events (Compact) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            minWidth: 0,
            maxHeight: "calc(100vh - 200px)",
            overflowY: "auto",
          }}
        >
          {/* SELECTED PLAYER PANEL */}
          <ModPanel variant="secondary" padding="14px">
            <ModSectionHead title="Player" divider />
            {selectedInfo ? (
              <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: `linear-gradient(135deg, ${selectedInfo.team.primary}, ${selectedInfo.team.secondary})`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: "800",
                      color: selectedInfo.team.text,
                      flexShrink: 0,
                    }}
                  >
                    {selectedInfo.number}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: "800", color: TMod.textPrimary }}>
                      {selectedInfo.shortName}
                    </div>
                    <div style={{ fontSize: 8.5, color: TMod.textTertiary, marginTop: 1 }}>
                      {selectedInfo.pos} · {selectedInfo.team.short}
                    </div>
                  </div>
                  <ModBadge
                    label={selectedInfo.onPitch ? "ON" : "BENCH"}
                    variant={selectedInfo.onPitch ? "solid" : "outline"}
                  />
                </div>
                <div
                  style={{
                    padding: 8,
                    borderRadius: 6,
                    background: selectedInfo.isBallCarrier ? `${TMod.accentGold}15` : TMod.bgPanel,
                    border: `1px solid ${selectedInfo.isBallCarrier ? TMod.accentGold : TMod.borderLight}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: "700",
                      color: selectedInfo.isBallCarrier ? TMod.accentGold : TMod.textPrimary,
                    }}
                  >
                    {selectedInfo.activity}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedPlayerId(null);
                    setSelectedSide(null);
                  }}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: `1px solid ${TMod.borderLight}`,
                    background: "transparent",
                    color: TMod.textSecondary,
                    fontSize: 9,
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = TMod.accentCyan;
                    (e.currentTarget as HTMLButtonElement).style.color = TMod.accentCyan;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = TMod.borderLight;
                    (e.currentTarget as HTMLButtonElement).style.color = TMod.textSecondary;
                  }}
                >
                  Clear Selection
                </button>
              </div>
            ) : (
              <p style={{ margin: "8px 0 0 0", fontSize: 9, color: TMod.textTertiary }}>
                Tap a player on the pitch
              </p>
            )}
          </ModPanel>

          {/* MATCH EVENTS - KEY MOMENTS */}
          <ModPanel variant="secondary" padding="14px">
            <ModSectionHead title={`Events (${events.length})`} divider />
            <div
              style={{
                marginTop: 10,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
              {events.slice(0, 15).map((e, i) => (
                <MatchEventBadge key={i} event={e} />
              ))}
              {events.length === 0 && (
                <div style={{ fontSize: 9, color: TMod.textTertiary, padding: "8px 0" }}>
                  Match just started...
                </div>
              )}
            </div>
          </ModPanel>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact badge for match events - highlights important moments
 */
function MatchEventBadge({ event }: { event: any }) {
  const isImportant = ["goal", "red", "yellow", "sub", "injury"].includes(event.type);
  const iconMap: { [key: string]: string } = {
    goal: "⚽",
    yellow: "🟨",
    red: "🟥",
    sub: "🔄",
    injury: "🚑",
    foul: "📋",
    save: "🧤",
    corner: "🚩",
    offside: "📍",
  };

  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 6,
        background: isImportant ? `${TMod.accentCyan}15` : TMod.bgPanel,
        border: `1px solid ${isImportant ? TMod.accentCyan : TMod.borderLight}`,
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        const target = e.currentTarget as HTMLDivElement;
        target.style.background = isImportant ? `${TMod.accentCyan}22` : TMod.bgTertiary;
      }}
      onMouseLeave={(e) => {
        const target = e.currentTarget as HTMLDivElement;
        target.style.background = isImportant ? `${TMod.accentCyan}15` : TMod.bgPanel;
      }}
    >
      <div style={{ fontSize: 14, flexShrink: 0 }}>{iconMap[event.type] || "•"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8.5, fontWeight: "700", color: TMod.textTertiary }}>
          {event.minute}'
        </div>
        <div
          style={{
            fontSize: 9,
            fontWeight: isImportant ? "700" : "600",
            color: TMod.textPrimary,
            marginTop: 2,
            lineHeight: "1.2",
          }}
        >
          {event.text}
        </div>
      </div>
    </div>
  );
}
