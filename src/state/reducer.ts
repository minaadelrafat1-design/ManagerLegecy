/* =============================================================================
 * GameState — reducer (game rules)
 * =============================================================================
 * Pure functions only: (state, action) -> newState. No React, no
 * localStorage, no simulation math (that stays in lib/match-engine.ts).
 * This is the one place allowed to decide how the authoritative state
 * changes; UI code never mutates `Player`/`Club`/`Manager` objects itself.
 * ---------------------------------------------------------------------------*/

import type { GameState, Player, TransferListing, TacticsSettings, TrainingPreset } from "./types";
import {
  createNegotiationSession,
  startTransferNegotiation,
  addNegotiationEntry,
  closeNegotiation,
  acceptContractSession,
  acceptTransferSession,
  submitTransferOffer,
} from "./negotiation-sessions";
import { addClubMemory } from "./ai-memory";
import consequences from "./ai-consequences";
import { advanceGameDays } from "./calendar";
import {
  applySeasonPerformance,
  describeSeasonReview,
  type SeasonPerformanceTier,
} from "./manager-progression";
import {
  applyWeeklyFinanceTick,
  formatMoney,
  formatTransferBudget,
  formatWageBudget,
  parseMoney,
} from "./finance";
import { upgradeFacility, type FacilityKey } from "./facilities";
import { queueTrainingGroundUpgrade } from "./training-ground";
import { queueStadiumUpgrade } from "./stadium";
import { applyPresetAsTrainingPlan, getDrillById } from "./training-presets";
import { hireStaff, fireStaff } from "./staff";
import { acceptJob } from "./jobs";
import { finalizeSeasonIfNeeded, initializeSeasonFixturesIfNeeded } from "./season";
import { invalidateLeagueTable } from "./standings";
import { invalidateClubStrength } from "../lib/ai-fixture-sim";
import { hireScout, deployScoutingAssignment } from "./scouting-network";
import { dismissScoutedPlayer, addScoutedPlayerToShortlist, addScoutedPlayerToAcademy } from "./scout-reports";

export type GameAction =
  | { type: "UPDATE_PLAYER"; id: string; patch: Partial<Player> }
  /** Phase B1. Advances `state.time` (and runs the daily extension-point
   * hooks in `./calendar.ts`) by `days` (default 1). This is the only
   * action allowed to move the game clock — see `advanceGameDays` for why. */
  | { type: "ADVANCE_DAY"; days?: number }
  | { type: "SET_PENDING_MATCH"; fixtureId: string }
  | {
      type: "RECORD_MATCH_RESULT";
      fixtureId: string | null;
      homeClubId: string;
      awayClubId: string;
      scoreHome: number;
      scoreAway: number;
      seed: number;
      playedAt: string;
      playerRatings?: Record<string, number>;
    }
  | { type: "UPDATE_TRANSFER_STATUS"; id: string; status: TransferListing["status"] }
  | { type: "ADD_TRANSFER_TARGET"; listing: TransferListing }
  | { type: "RECORD_TRANSFER"; fee: number; wageWeeklyDelta: number; description?: string }
  | { type: "UPGRADE_FACILITY"; facility: FacilityKey }
  | { type: "QUEUE_TRAINING_GROUND_UPGRADE"; kind: "facility" | "equipment"; assetId: string }
  | { type: "QUEUE_STADIUM_UPGRADE"; componentId: import("./types").StadiumComponentId }
  | { type: "MARK_INBOX_MESSAGE_READ"; messageId: string }
  | { type: "DELETE_INBOX_MESSAGE"; messageId: string }
  | { type: "SAVE_GAME" }
  | { type: "HIRE_STAFF"; member: any }
  | { type: "FIRE_STAFF"; staffId: string }
  | { type: "REQUEST_LOAN"; amount: number; termWeeks?: number; annualRatePct?: number }
  | { type: "APPROVE_LOAN"; loanId: string }
  | { type: "ACCEPT_JOB_OFFER"; clubId: string }
  /** Phase C2. The only action allowed to move `manager.credit` /
   * `manager.reputation` off a season result — see
   * `state/manager-progression.ts` for the rules. Appends a `CareerEvent`
   * so the manager UI can show exactly what a season did, not just the
   * final numbers. */
  | { type: "APPLY_SEASON_RESULT"; tier: SeasonPerformanceTier }
  | { type: "SET_TACTICS"; tactics: TacticsSettings }
  | { type: "SET_FORMATION"; clubId?: string; formation: string }
  | { type: "SET_TRAINING_PLAN"; planId: string }
  | { type: "UPDATE_TRAINING_PLAN_PLAYERS"; planId: string; playerIds: string[] }
  | { type: "UPDATE_TRAINING_PRESET"; presetId: string; patch: Partial<TrainingPreset> }
  | { type: "APPLY_TRAINING_PRESET"; presetId: string }
  | { type: "MARK_ACHIEVEMENT_SEEN"; achievementId: string }
  | { type: "ADD_TO_SHORTLIST"; playerId: string }
  | { type: "REMOVE_FROM_SHORTLIST"; playerId: string }
  | { type: "CLEAR_SHORTLIST" }
  | { type: "HIRE_SCOUT"; tierId: string; name: string }
  | { type: "DEPLOY_SCOUTING_ASSIGNMENT"; scoutId: string; targetCountryId: string; durationDays: number; assignmentLabel?: string }
  | { type: "SHORTLIST_SCOUTED_PLAYER"; reportId: string }
  | { type: "DISMISS_SCOUTED_PLAYER"; reportId: string }
  | { type: "ADD_SCOUTED_PLAYER_TO_ACADEMY"; reportId: string }
  | { type: "RESET_GAME"; state: GameState }
  | {
      type: "CREATE_NEGOTIATION";
      buyerClubId: string;
      sellerClubId: string;
      playerId: string;
      offer: any;
      message?: string;
      negotiationType?: "transfer" | "contract";
    }
  | {
      type: "START_TRANSFER_NEGOTIATION";
      buyerClubId: string;
      playerId: string;
      offer: any;
      message?: string;
    }
  | {
      type: "ADD_NEGOTIATION_ENTRY";
      sessionId: string;
      fromClubId: string;
      offer: any;
      message?: string;
    }
  | { type: "SUBMIT_TRANSFER_OFFER"; sessionId: string; offer: any }
  | {
      type: "CLOSE_NEGOTIATION";
      sessionId: string;
      status: "accepted" | "rejected" | "withdrawn";
      message?: string;
    }
  | { type: "ACCEPT_CONTRACT_SESSION"; sessionId: string; offer: any }
  | { type: "ACCEPT_TRANSFER_SESSION"; sessionId: string }
  | { type: "SET_PLAYER_ROLE"; playerId: string; roleId: string }
  | { type: "SET_PLAYER_INSTRUCTIONS"; playerId: string; instructions: string[] }
  | { type: "SET_PLAYER_ROLE_FAMILIARITY"; playerId: string; familiarity: number };

function resultFor(scoreFor: number, scoreAgainst: number): "W" | "D" | "L" {
  if (scoreFor > scoreAgainst) return "W";
  if (scoreFor < scoreAgainst) return "L";
  return "D";
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_PENDING_MATCH": {
      const fixture = state.fixtures.find((item) => item.id === action.fixtureId);
      const managedClubId = state.currentClub?.id ?? state.manager?.clubId;
      if (
        !fixture ||
        fixture.status !== "scheduled" ||
        fixture.calendarDate !== state.time.date ||
        !managedClubId ||
        (fixture.homeClubId !== managedClubId && fixture.awayClubId !== managedClubId)
      ) {
        return state;
      }
      return { ...state, pendingManagerFixtureId: fixture.id };
    }

    case "ADVANCE_DAY": {
      const advanced = advanceGameDays(state, action.days ?? 1);
      
      // Set pending manager fixture if the manager's club has a fixture on the new current date
      const today = advanced.time.date;
      const managedClubId = advanced.currentClub.id;
      const todayManagerFixture = advanced.fixtures.find(
        (f) =>
          f.calendarDate === today &&
          f.status === "scheduled" &&
          (f.homeClubId === managedClubId || f.awayClubId === managedClubId),
      );
      
      const nextState: GameState = {
        ...advanced,
        ...(todayManagerFixture ? { pendingManagerFixtureId: todayManagerFixture.id } : {}),
      };
      
      return initializeSeasonFixturesIfNeeded(finalizeSeasonIfNeeded(nextState));
    }

    case "UPDATE_PLAYER": {
      const existing = state.players[action.id];
      if (!existing) return state;
      const patched = { ...existing, ...action.patch };
      let nextState: GameState = {
        ...state,
        players: { ...state.players, [action.id]: patched },
      };

      // injury memory
      if (action.patch.injury && !existing.injury) {
        const clubId = patched.clubId ?? state.currentClub?.id;
        if (clubId) {
          nextState = addClubMemory(nextState, clubId, {
            kind: "injury",
            summary: `Important injury: ${patched.id || action.id}`,
            meta: { playerId: action.id, injury: action.patch.injury },
            relevance: 80,
          });
          // apply injury consequences (morale, news)
          nextState = consequences.applyInjuryConsequences(nextState, action.id, action.patch.injury);
        }
      }

      // player development memory (significant changes)
      if (action.patch.development) {
        const before = existing.development;
        const after = patched.development;
        const changed =
          before?.growthRate !== after?.growthRate || before?.trainingEfficiency !== after?.trainingEfficiency;
        if (changed) {
          const clubId = patched.clubId ?? state.currentClub?.id;
          if (clubId) {
            nextState = addClubMemory(nextState, clubId, {
              kind: "development",
              summary: `Player development update: ${action.id}`,
              meta: { playerId: action.id, before, after },
              relevance: 50,
            });
          }
        }
      }

      return nextState;
    }

    case "RECORD_MATCH_RESULT": {
      // Phase B2: only `fixtures`/`matches`/`events` change here. The league
      // table is never stored — `state/standings.ts` recomputes it from
      // `state.fixtures` on every read, so updating the fixture below is
      // the whole story; nothing here needs to also patch `state.leagues`.
      //
      // Phase B3.1C: reprocessing the exact same result for an
      // already-`"played"` fixture is a no-op. `fixtures` was already
      // idempotent for the score itself (`.map` by id, not an append), so
      // dispatching the SAME score twice was always harmless there — this
      // guard only stops the two *append-only* lists, `matches` and
      // `events`, from growing a second entry for a match that already has
      // one, which is where "duplicate statistics" would actually come
      // from (a duplicate `MatchRecord`/`EventLogEntry`, not double-counted
      // points — `state/standings.ts` only ever reads the current
      // `fixtures` snapshot). Deliberately narrow: it only fires when
      // `scoreHome`/`scoreAway` match what's already stored, so genuinely
      // *correcting* an already-played fixture's score (a different
      // dispatch, not a repeat of the same one) still goes through exactly
      // as before. A `fixtureId: null` result (no fixture to compare
      // against) is always recorded, same as before.
      const { fixtureId, homeClubId, awayClubId, scoreHome, scoreAway, seed, playedAt } = action;

      // PERFORMANCE: Invalidate caches for this match's competition so
      // downstream reads (league tables, club strengths) don't return stale data.
      // We do this *before* the early-return guard below so the first time a
      // fixture is recorded both caches are properly invalidated. The early
      // return only fires for an identical replay, which is harmless.
      if (fixtureId) {
        const existingFixture = state.fixtures.find((f) => f.id === fixtureId);
        if (existingFixture) {
          // Invalidate the league table for this fixture's competition.
          invalidateLeagueTable(existingFixture.competitionId);
          // Invalidate club strengths for both participating clubs.
          invalidateClubStrength(homeClubId);
          invalidateClubStrength(awayClubId);
        }
        const existing = state.fixtures.find((f) => f.id === fixtureId);
        if (
          existing?.status === "played" &&
          existing.scoreHome === scoreHome &&
          existing.scoreAway === scoreAway
        ) {
          return state;
        }
        if (existing && existing.status === "played" && (existing.scoreHome !== scoreHome || existing.scoreAway !== scoreAway)) {
          console.warn(`[RECORD_MATCH_RESULT] Fixture ${fixtureId} already played with different score: ${existing.scoreHome}-${existing.scoreAway} vs new ${scoreHome}-${scoreAway}`);
        }
        if (!existing) {
          console.warn(`[RECORD_MATCH_RESULT] Fixture ${fixtureId} not found in state!`);
        }
      }
      const matchId = `match-${state.matches.length + 1}`;

      let fixturesUpdated = 0;
      const fixtures = fixtureId
        ? state.fixtures.map((f) => {
            if (f.id === fixtureId) {
              fixturesUpdated++;
              return {
                ...f,
                status: "played" as const,
                scoreHome,
                scoreAway,
                result: resultFor(
                  f.homeClubId === homeClubId ? scoreHome : scoreAway,
                  f.homeClubId === homeClubId ? scoreAway : scoreHome,
                ),
              };
            }
            return f;
          })
        : state.fixtures;

      const homeClub = state.clubs[homeClubId];
      const summary = homeClub
        ? `${homeClub.name} ${scoreHome}-${scoreAway} ${state.clubs[awayClubId]?.name ?? awayClubId}`
        : `${scoreHome}-${scoreAway}`;

      // adjust morale and form for players based on result
      const nextPlayers = { ...state.players };
      const playerRatings = (action as Extract<GameAction, { type: "RECORD_MATCH_RESULT" }>)
        .playerRatings;
      const homeResult = scoreHome > scoreAway ? "W" : scoreHome < scoreAway ? "L" : "D";
      const awayResult = homeResult === "W" ? "L" : homeResult === "L" ? "W" : "D";

      function applyResultToClub(clubId: string, result: string) {
        const club = state.clubs[clubId];
        if (!club) return;
        for (const pid of club.playerIds) {
          const p = nextPlayers[pid];
          if (!p) continue;
          const starter = !!p.starter;
          const rating =
            (action as Extract<GameAction, { type: "RECORD_MATCH_RESULT" }>).playerRatings?.[pid] ??
            p.lastMatchRating ??
            5;

          let moraleDelta = 0;
          if (result === "W") moraleDelta = starter ? 6 : 3;
          else if (result === "D") moraleDelta = starter ? 1 : 0;
          else moraleDelta = starter ? -6 : -3;
          if (!starter && result === "L") moraleDelta -= 1;
          if (rating >= 7.5) moraleDelta += 2;
          else if (rating <= 4.5) moraleDelta -= 2;

          const newMorale = Math.max(0, Math.min(100, (p.morale ?? 50) + moraleDelta));

          let formDelta = 0;
          if (result === "W") formDelta = starter ? 8 : 4;
          else if (result === "D") formDelta = starter ? 2 : 1;
          else formDelta = starter ? -8 : -4;
          formDelta += Math.round((rating - 5) * 1.8);

          const newForm = Math.max(0, Math.min(100, (p.form ?? 50) + formDelta));

          let repDelta = 0;
          if (rating >= 8) repDelta = 1;
          else if (rating <= 4) repDelta = -1;
          const newReputation = Math.max(0, Math.min(100, (p.reputation ?? 50) + repDelta));

          const ageFactor = p.age ? Math.max(0.75, Math.min(1.25, (30 - p.age) / 20 + 1)) : 1;
          const valueDelta = Math.round((rating - 5) * 12000 * ageFactor);
          const newMarketValue = Math.max(0, (p.marketValue ?? 0) + valueDelta);

          const nextHistory = [...(p.matchRatingHistory ?? []), rating].slice(-5);
          nextPlayers[pid] = {
            ...p,
            morale: newMorale,
            form: newForm,
            reputation: newReputation,
            marketValue: newMarketValue,
            lastMatchRating: rating,
            matchRatingHistory: nextHistory,
          };
        }
      }

      applyResultToClub(homeClubId, homeResult);
      applyResultToClub(awayClubId, awayResult);

      const intermediate: GameState = {
        ...state,
        fixtures,
        matches: [
          ...state.matches,
          { id: matchId, fixtureId, seed, homeClubId, awayClubId, scoreHome, scoreAway, playedAt },
        ],
        events: [
          ...state.events,
          {
            id: `event-${matchId}`,
            date: playedAt,
            type: "MATCH_PLAYED" as any,
            description: summary,
            meta: { fixtureId, homeClubId, awayClubId, scoreHome, scoreAway },
          },
        ],
        players: nextPlayers,
      };

      const goalDiff = Math.abs(scoreHome - scoreAway);
      const rel = goalDiff >= 3 ? 90 : goalDiff >= 2 ? 65 : goalDiff === 1 ? 40 : 25;

      let nextState = addClubMemory(intermediate, homeClubId, {
        kind: "tactical",
        summary: `${intermediate.clubs[homeClubId]?.name ?? homeClubId} ${scoreHome}-${scoreAway}`,
        meta: { opponentId: awayClubId, scoreHome, scoreAway, competitionId: fixtures.find((f) => f.homeClubId === homeClubId && f.awayClubId === awayClubId)?.competitionId ?? null },
        relevance: rel,
      });

      nextState = addClubMemory(nextState, awayClubId, {
        kind: "tactical",
        summary: `${nextState.clubs[awayClubId]?.name ?? awayClubId} ${scoreAway}-${scoreHome}`,
        meta: { opponentId: homeClubId, scoreHome, scoreAway, competitionId: fixtures.find((f) => f.homeClubId === homeClubId && f.awayClubId === awayClubId)?.competitionId ?? null },
        relevance: rel,
      });

      const playedFixture = fixtureId ? fixtures.find((f) => f.id === fixtureId) : fixtures.find((f) => f.homeClubId === homeClubId && f.awayClubId === awayClubId);
      if (playedFixture) nextState = consequences.applyMatchResultConsequences(nextState, playedFixture, scoreHome, scoreAway);

      const tacticBias = Math.max(-8, Math.min(8, (state.tactics?.tempo ?? 50) - 50));
      const resultBias = scoreHome - scoreAway;
      const delayedTrustDelta = resultBias === 0 ? 0 : resultBias > 0 ? 1 : -1;
      
      // Build the new state with potentially cleared pending fixture
      const baseNextState = {
        ...nextState,
        manager: {
          ...nextState.manager,
          boardConfidence: Math.max(0, Math.min(100, (nextState.manager.boardConfidence ?? 50) + delayedTrustDelta + Math.round(tacticBias / 10))),
          fanConfidence: Math.max(0, Math.min(100, (nextState.manager.fanConfidence ?? 50) + delayedTrustDelta)),
          squadConfidence: Math.max(0, Math.min(100, (nextState.manager.squadConfidence ?? 50) + Math.round(tacticBias / 12))),
        },
      };
      
      // Clear the lock whenever the manager's current matchday fixture is now
      // resolved. This must work both for the exact fixture ID (normal path)
      // and for stale or synthetic result payloads (fixtureId: null, replayed
      // match simulation) where the lock still points at the same-day fixture.
      const resolvedTodayFixture =
        fixtureId != null
          ? fixtures.find((f) => f.id === fixtureId && f.status === "played")
          : fixtures.find(
              (f) =>
                f.status === "played" &&
                f.calendarDate === playedAt &&
                ((f.homeClubId === homeClubId && f.awayClubId === awayClubId) ||
                  (f.homeClubId === awayClubId && f.awayClubId === homeClubId)),
            );

      const lockIsForResolvedGame =
        !!state.pendingManagerFixtureId &&
        (!!fixtureId ? state.pendingManagerFixtureId === fixtureId : false) ||
        (!!resolvedTodayFixture &&
          state.pendingManagerFixtureId === resolvedTodayFixture.id);

      if (lockIsForResolvedGame) {
        const { pendingManagerFixtureId, ...finalState } = baseNextState;
        nextState = finalState as GameState;
      } else {
        nextState = baseNextState;
      }

      return nextState;
    }

    case "UPDATE_TRANSFER_STATUS": {
      const transferId = action.id;
      const prev = state.transfers.find((t) => t.id === transferId);
      const nextTransfers = state.transfers.map((t) => (t.id === transferId ? { ...t, status: action.status } : t));
      let nextState: GameState = { ...state, transfers: nextTransfers };
      if (prev && prev.status !== action.status) {
        const seller = prev.sellerClubId;
        if (action.status === "agreed") {
          if (seller) {
            nextState = addClubMemory(nextState, seller, {
              kind: "transfer",
              summary: `Transfer completed: ${prev.name}`,
              meta: { playerId: prev.playerId, feeGuess: prev.value ?? null },
              relevance: 60,
            });
            // apply transfer consequences (morale, fans, board, news)
            nextState = consequences.applyTransferStatusConsequences(nextState, prev as any, action.status);
          }
        } else if (action.status === "rejected") {
          const clubId = state.currentClub?.id;
          if (clubId) {
            nextState = addClubMemory(nextState, clubId, {
              kind: "transfer",
              summary: `Transfer attempt failed: ${prev.name}`,
              meta: { playerId: prev.playerId },
              relevance: 45,
            });
            // also apply consequences for rejected transfer (smaller morale/fan effects)
            nextState = consequences.applyTransferStatusConsequences(nextState, prev as any, action.status);
          }
        }
      }
      return nextState;
    }

    case "ADD_TRANSFER_TARGET":
      return { ...state, transfers: [...state.transfers, action.listing] };

    case "RECORD_TRANSFER": {
      const currentTransferBudget = parseMoney(state.finances?.transferBudget);
      const currentWageBudget = parseMoney(state.finances?.wageBudget);
      const nextTransferBudget = Math.max(0, currentTransferBudget - action.fee);
      const nextWageBudget = Math.max(0, currentWageBudget - action.wageWeeklyDelta);
      const nextState: GameState = {
        ...state,
        finances: {
          ...state.finances,
          transferBudget: formatTransferBudget(nextTransferBudget),
          wageBudget: formatWageBudget(nextWageBudget),
          expenses: {
            playerSalaries: state.finances?.expenses?.playerSalaries ?? 0,
            staff: state.finances?.expenses?.staff ?? 0,
            transfers: (state.finances?.expenses?.transfers ?? 0) + action.fee,
            facilities: state.finances?.expenses?.facilities ?? 0,
            scouting: state.finances?.expenses?.scouting ?? 0,
            medical: state.finances?.expenses?.medical ?? 0,
            operations: state.finances?.expenses?.operations ?? 0,
            total: (state.finances?.expenses?.total ?? 0) + action.fee,
          },
        },
        events: [
          ...(state.events ?? []),
          {
            id: `event-transfer-${(state.events?.length ?? 0) + 1}`,
            date: state.time.date,
            type: "transfer" as const,
            description: action.description ?? "Transfer activity recorded",
            meta: { fee: action.fee, wageWeeklyDelta: action.wageWeeklyDelta },
          },
        ],
      };

      // apply transfer consequences (signing/sale reactions)
      const withConsequences = consequences.applyRecordTransferConsequences(nextState, action.fee, action.wageWeeklyDelta, action.description);
      const transferCostRatio = action.fee / Math.max(1, parseMoney(state.finances?.transferBudget ?? "0"));
      return {
        ...withConsequences,
        manager: {
          ...withConsequences.manager,
          credit: Math.max(0, Math.min(100, (withConsequences.manager.credit ?? 50) - Math.round(Math.max(0, transferCostRatio) * 12))),
          fanConfidence: Math.max(0, Math.min(100, (withConsequences.manager.fanConfidence ?? 50) + (action.fee > 10_000_000 ? 3 : 0) - (action.wageWeeklyDelta > 0 ? 2 : 0))),
        },
      };
    }

    case "UPGRADE_FACILITY":
      return upgradeFacility(state, action.facility);

    case "QUEUE_TRAINING_GROUND_UPGRADE":
      return queueTrainingGroundUpgrade(state, action.kind, action.assetId);

    case "HIRE_STAFF":
      return hireStaff(state, action.member);

    case "QUEUE_STADIUM_UPGRADE":
      return queueStadiumUpgrade(state, action.componentId);

    case "MARK_INBOX_MESSAGE_READ":
      return { ...state, inbox: (state.inbox ?? []).map((message) => message.id === action.messageId ? { ...message, isRead: true } : message) };

    case "DELETE_INBOX_MESSAGE":
      return { ...state, inbox: (state.inbox ?? []).filter((message) => message.id !== action.messageId) };

    case "SAVE_GAME":
      return state;

    case "FIRE_STAFF":
      return fireStaff(state, action.staffId);

    case "REQUEST_LOAN":
      return state;

    case "APPROVE_LOAN":
      return ((): GameState => {
        // approving loan is a higher-level flow; for now mark the loan approved
        const loans = state.finances?.loans ?? [];
        const nextLoans = loans.map((l) => (l.id === action.loanId ? { ...l, approved: true } : l));
        return { ...state, finances: { ...state.finances, loans: nextLoans } };
      })();

    case "APPLY_SEASON_RESULT": {
      const result = applySeasonPerformance(state.manager, action.tier);
      const clubName = state.currentClub.name;
      const baseNext: GameState = {
        ...state,
        manager: {
          ...state.manager,
          credit: result.creditAfter,
          reputation: result.reputationAfter,
          experience: (state.manager.experience ?? 0) + 1,
        },
        careerHistory: [
          ...state.careerHistory,
          {
            id: `career-season-${state.time.season}-${state.careerHistory.length + 1}`,
            season: String(state.time.season),
            clubId: state.currentClub.id,
            summary: describeSeasonReview(clubName, result),
            seasonReview: {
              tier: result.tier,
              creditDelta: result.creditDelta,
              creditAfter: result.creditAfter,
              reputationDelta: result.reputationDelta,
              reputationAfter: result.reputationAfter,
            },
          },
        ],
      };

      // record season memory for the current club (summary of outcome)
      const withMemory = addClubMemory(baseNext, state.currentClub.id, {
        kind: "season",
        summary: `Season ${state.time.season}: ${result.tier}`,
        meta: { tier: result.tier },
        relevance: result.tier === "great" ? 90 : result.tier === "terrible" ? 90 : 50,
      });
      // apply season outcome consequences (promotion/relegation, board/fans/manager)
      return consequences.applySeasonOutcomeConsequences(withMemory, state.currentClub.id, result.tier as string);
    }

    case "RESET_GAME":
      return action.state;

    case "ADD_TO_SHORTLIST": {
      const player = state.players[action.playerId];
      if (!player) return state;
      if ((state.shortlistPlayerIds ?? []).includes(action.playerId)) return state;
      return {
        ...state,
        shortlistPlayerIds: [...(state.shortlistPlayerIds ?? []), action.playerId],
      };
    }

    case "REMOVE_FROM_SHORTLIST": {
      if (!(state.shortlistPlayerIds ?? []).includes(action.playerId)) return state;
      return {
        ...state,
        shortlistPlayerIds: (state.shortlistPlayerIds ?? []).filter((id) => id !== action.playerId),
      };
    }

    case "CLEAR_SHORTLIST":
      if (!(state.shortlistPlayerIds ?? []).length) return state;
      return { ...state, shortlistPlayerIds: [] };

    case "HIRE_SCOUT":
      return hireScout(state, action.tierId, action.name);

    case "DEPLOY_SCOUTING_ASSIGNMENT":
      return deployScoutingAssignment(state, action);

    case "SHORTLIST_SCOUTED_PLAYER":
      return addScoutedPlayerToShortlist(state, action.reportId);

    case "DISMISS_SCOUTED_PLAYER":
      return dismissScoutedPlayer(state, action.reportId);

    case "ADD_SCOUTED_PLAYER_TO_ACADEMY":
      return addScoutedPlayerToAcademy(state, action.reportId);

    case "MARK_ACHIEVEMENT_SEEN": {
      const seen = state.seenAchievementIds ?? [];
      if (seen.includes(action.achievementId)) return state;
      return { ...state, seenAchievementIds: [...seen, action.achievementId] };
    }

    case "CREATE_NEGOTIATION": {
      if (action.negotiationType === "transfer") {
        const started = startTransferNegotiation(
          state,
          action.buyerClubId,
          action.playerId,
          action.offer,
          action.message ?? "",
        );
        const session = started.negotiations?.find(
          (item) =>
            item.type === "transfer" &&
            item.status === "open" &&
            item.playerId === action.playerId &&
            item.buyerClubId === action.buyerClubId,
        );
        return session ? submitTransferOffer(started, session.id, action.offer) : started;
      }
      return createNegotiationSession(
        state,
        action.buyerClubId,
        action.sellerClubId,
        action.playerId,
        action.offer,
        action.message ?? "",
        action.negotiationType ?? "transfer",
      );
    }

    case "START_TRANSFER_NEGOTIATION": {
      return startTransferNegotiation(
        state,
        action.buyerClubId,
        action.playerId,
        action.offer,
        action.message,
      );
    }

    case "ADD_NEGOTIATION_ENTRY": {
      return addNegotiationEntry(
        state,
        action.sessionId,
        action.fromClubId,
        action.offer,
        action.message ?? "",
      );
    }

    case "SUBMIT_TRANSFER_OFFER": {
      return submitTransferOffer(state, action.sessionId, action.offer);
    }

    case "CLOSE_NEGOTIATION": {
      return closeNegotiation(state, action.sessionId, action.status, action.message ?? "");
    }

    case "ACCEPT_CONTRACT_SESSION": {
      return acceptContractSession(state, action.sessionId, action.offer);
    }

    case "ACCEPT_TRANSFER_SESSION": {
      return acceptTransferSession(state, action.sessionId);
    }

    case "ACCEPT_JOB_OFFER": {
      // payload: clubId
      const clubId = (action as any).clubId as string;
      // apply manager job offer consequences (public link)
      const afterOffer = consequences.applyManagerJobOfferConsequences(state, clubId);
      return acceptJob(afterOffer, clubId);
    }

    case "SET_TACTICS": {
      return { ...state, tactics: action.tactics };
    }

    case "SET_FORMATION": {
      const clubId = action.clubId ?? state.currentClub.id;
      const club = state.clubs[clubId];
      if (!club) return state;
      const updatedClub = { ...club, formation: action.formation };
      const nextClubs = { ...state.clubs, [clubId]: updatedClub };
      const nextState: GameState =
        state.currentClub.id === clubId
          ? { ...state, clubs: nextClubs, currentClub: { ...state.currentClub, formation: action.formation } }
          : { ...state, clubs: nextClubs };
      return nextState;
    }

    case "SET_TRAINING_PLAN": {
      if (!state.training.some((plan) => plan.id === action.planId)) return state;
      return { ...state, selectedTrainingPlanId: action.planId };
    }

    case "UPDATE_TRAINING_PLAN_PLAYERS": {
      const plan = state.training.find((item) => item.id === action.planId);
      if (!plan) return state;
      const validPlayerIds = action.playerIds.filter((playerId) => Boolean(state.players[playerId]));
      return {
        ...state,
        training: state.training.map((item) =>
          item.id === action.planId ? { ...item, assignedPlayerIds: [...new Set(validPlayerIds)] } : item,
        ),
      };
    }

    case "UPDATE_TRAINING_PRESET": {
      const presets = state.trainPresets ?? [];
      const index = presets.findIndex((preset) => preset.id === action.presetId);
      if (index < 0) return state;
      const nextPresets = presets.slice();
      nextPresets[index] = { ...nextPresets[index], ...action.patch } as TrainingPreset;
      return { ...state, trainPresets: nextPresets };
    }

    case "APPLY_TRAINING_PRESET": {
      const preset = (state.trainPresets ?? []).find((item) => item.id === action.presetId);
      if (!preset) return state;
      const validation = applyPresetAsTrainingPlan(preset, state);
      if (validation.error) return state;
      const drillNames = preset.drills.map((id) => getDrillById(id)?.name).filter(Boolean).join(", ");
      const planId = `preset-plan-${preset.id}-${state.time.date}`;
      const plan = {
        id: planId,
        name: preset.name,
        focus: drillNames || "General",
        intensity: preset.intensity,
        assignedPlayerIds: [...preset.selectedPlayerIds],
        drillIds: [...preset.drills],
      };
      return {
        ...state,
        training: [...state.training, plan],
        selectedTrainingPlanId: planId,
        trainPresets: (state.trainPresets ?? []).map((item) =>
          item.id === preset.id ? { ...item, lastAppliedDate: state.time.date } : item,
        ),
      };
    }

    case "SET_PLAYER_ROLE": {
      const player = state.players[action.playerId];
      if (!player) return state;
      const nextPlayers = {
        ...state.players,
        [action.playerId]: {
          ...player,
          tacticalConfig: {
            ...(player.tacticalConfig ?? {}),
            roleId: action.roleId,
          },
        },
      };
      return { ...state, players: nextPlayers };
    }

    case "SET_PLAYER_INSTRUCTIONS": {
      const player = state.players[action.playerId];
      if (!player) return state;
      const nextPlayers = {
        ...state.players,
        [action.playerId]: {
          ...player,
          tacticalConfig: {
            ...(player.tacticalConfig ?? {}),
            instructions: action.instructions,
          },
        },
      };
      return { ...state, players: nextPlayers };
    }

    case "SET_PLAYER_ROLE_FAMILIARITY": {
      const player = state.players[action.playerId];
      if (!player) return state;
      const nextPlayers = {
        ...state.players,
        [action.playerId]: {
          ...player,
          tacticalConfig: {
            ...(player.tacticalConfig ?? {}),
            roleFamiliarity: Math.max(0, Math.min(100, action.familiarity)),
          },
        },
      };
      return { ...state, players: nextPlayers };
    }

    default:
      return state;
  }
}
