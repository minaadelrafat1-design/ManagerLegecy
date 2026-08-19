import { getTransferWindowStatus, registerDailyHook } from "./calendar";
import { runAiActions } from "./ai-actions";
import { seededUnit } from "./utils";
import type { GameState } from "./types";

export type AiWorkReason =
  | "periodic-review"
  | "upcoming-match"
  | "transfer-window"
  | "injury-crisis"
  | "manager-change"
  | "transfer-event"
  | "financial-problem";

export interface AiWorkItem {
  clubId: string;
  reasons: AiWorkReason[];
  priority: number;
}

export interface AiSchedulerPlan {
  date: string;
  items: AiWorkItem[];
}

interface AiSchedulerMeta {
  lastRunDate?: string;
  lastPeriodicReviewDate?: string;
  lastPlanDate?: string;
  lastProcessedClubIds?: string[];
}

const PERIODIC_REVIEW_DAYS = 7;
const UPCOMING_MATCH_DAYS = 3;
const PERIODIC_BATCH_SIZE = 4;
const MAX_DAILY_AI_CLUBS = 4;

function schedulerMeta(state: GameState): AiSchedulerMeta {
  return (state.meta?.["aiScheduler"] as AiSchedulerMeta | undefined) ?? {};
}

function daysUntil(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  return Math.round((toTime - fromTime) / 86_400_000);
}

function clubsWithUpcomingMatches(state: GameState): Set<string> {
  const result = new Set<string>();
  for (const fixture of state.fixtures ?? []) {
    if (fixture.status !== "scheduled") continue;
    const days = daysUntil(state.time.date, fixture.calendarDate);
    if (days < 0 || days > UPCOMING_MATCH_DAYS) continue;
    result.add(fixture.homeClubId);
    result.add(fixture.awayClubId);
  }
  return result;
}

function periodicBatch(state: GameState): Set<string> {
  return new Set(
    Object.values(state.clubs)
      .filter((club) => club.aiManager)
      .sort(
        (a, b) =>
          seededUnit(`${state.time.date}:${a.id}`) - seededUnit(`${state.time.date}:${b.id}`),
      )
      .slice(0, PERIODIC_BATCH_SIZE)
      .map((club) => club.id),
  );
}

export function planAiWorldWork(state: GameState): AiSchedulerPlan {
  const today = state.time.date;
  const meta = schedulerMeta(state);
  const reasonsByClub = new Map<string, Set<AiWorkReason>>();
  const addReason = (clubId: string, reason: AiWorkReason) => {
    if (!state.clubs[clubId]?.aiManager) return;
    const reasons = reasonsByClub.get(clubId) ?? new Set<AiWorkReason>();
    reasons.add(reason);
    reasonsByClub.set(clubId, reasons);
  };

  const periodicDue =
    !meta.lastPeriodicReviewDate ||
    daysUntil(meta.lastPeriodicReviewDate, today) >= PERIODIC_REVIEW_DAYS;
  if (periodicDue) {
    for (const clubId of periodicBatch(state)) addReason(clubId, "periodic-review");
  }

  for (const clubId of clubsWithUpcomingMatches(state)) addReason(clubId, "upcoming-match");

  const transferWindow = getTransferWindowStatus(today, String(state.time.season));
  if (transferWindow.isOpen) {
    for (const clubId of periodicBatch(state)) addReason(clubId, "transfer-window");
  }

  for (const club of Object.values(state.clubs)) {
    if (!club.aiManager) continue;
    const ledger = state.meta?.aiLedgers?.[club.id];
    if (ledger && (ledger.balance ?? 0) < 0) addReason(club.id, "financial-problem");
  }

  for (const event of state.events ?? []) {
    const eventAge = daysUntil(event.date.slice(0, 10), today);
    const isRecent = eventAge >= 0 && eventAge <= 1;
    const meta = event.meta;

    if (isRecent && (event.type === "injury" || meta?.["injury"])) {
      const playerId = meta?.["playerId"];
      const player = playerId ? state.players[String(playerId)] : undefined;
      if (player?.clubId) addReason(player.clubId, "injury-crisis");
    }

    if (event.type === "manager" && meta?.["action"] === "appointed" && meta["clubId"]) {
      addReason(String(meta["clubId"]), "manager-change");
    }

    if (isRecent && (event.type === "transfer" || event.type === "TRANSFER_OFFER")) {
      for (const key of ["clubId", "buyerClubId", "sellerClubId", "fromClubId", "toClubId"]) {
        if (meta?.[key]) addReason(String(meta[key]), "transfer-event");
      }
    }
  }

  const items = [...reasonsByClub.entries()]
    .map(([clubId, reasons]) => ({
      clubId,
      reasons: [...reasons],
      priority: [...reasons].reduce(
        (score, reason) =>
          score + (reason === "upcoming-match" ? 40 : reason === "financial-problem" ? 35 : 20),
        0,
      ),
    }))
    .sort((a, b) => b.priority - a.priority || a.clubId.localeCompare(b.clubId))
    .slice(0, MAX_DAILY_AI_CLUBS);

  return { date: today, items };
}

export function runAiWorldScheduler(state: GameState): GameState {
  const plan = planAiWorldWork(state);
  const meta = schedulerMeta(state);
  const alreadyRanToday = meta.lastRunDate === state.time.date;
  if (alreadyRanToday || plan.items.length === 0) {
    return {
      ...state,
      meta: {
        ...(state.meta ?? {}),
        aiScheduler: {
          ...meta,
          lastPlanDate: state.time.date,
        },
      },
    };
  }

  const next = runAiActions(state, new Set(plan.items.map((item) => item.clubId)));
  return {
    ...next,
    meta: {
      ...(next.meta ?? {}),
      aiScheduler: {
        ...meta,
        lastRunDate: state.time.date,
        lastPlanDate: state.time.date,
        ...(plan.items.some((item) => item.reasons.includes("periodic-review"))
          ? { lastPeriodicReviewDate: state.time.date }
          : {}),
        lastProcessedClubIds: plan.items.map((item) => item.clubId),
      },
    },
  };
}

registerDailyHook("ai", (state) => runAiWorldScheduler(state));
