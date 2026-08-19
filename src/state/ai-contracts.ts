import { daysBetweenISO, registerDailyHook } from "./calendar";
import { buildFinancialProfile } from "./ai-decisions";
import { createNegotiationSession } from "./negotiation-sessions";
import type { GameState } from "./types";

function shouldInitiateRenewal(state: GameState, playerId: string) {
  const p = state.players[playerId];
  if (!p) return false;
  if ((p.contractYears ?? 0) <= 1) return true;

  const until = p.contractUntil ?? "";
  if (!until || !/^Jun\s+\d{4}$/i.test(until)) return false;

  const seasonStartYear =
    Number.parseInt(String(state.time.season).split("/")[0] || "2026", 10) || 2026;
  const expirationYear = Number.parseInt(until.replace(/[^0-9]/g, ""), 10) || seasonStartYear;
  const daysRemaining = Math.max(0, expirationYear - seasonStartYear) * 365;
  return daysRemaining <= 120;
}

function buildClubPlayerIndex(state: GameState): Map<string, string[]> {
  const playersByClub = new Map<string, Set<string>>();
  for (const [clubId, club] of Object.entries(state.clubs)) {
    if (!club.aiManager) continue;
    playersByClub.set(clubId, new Set(club.playerIds ?? []));
  }
  for (const player of Object.values(state.players)) {
    if (!player.clubId || !playersByClub.has(player.clubId)) continue;
    playersByClub.get(player.clubId)!.add(player.id);
  }
  return new Map(
    [...playersByClub.entries()].map(([clubId, playerIds]) => [clubId, [...playerIds]]),
  );
}

function hasExpiringAIContracts(state: GameState, playersByClub: Map<string, string[]>) {
  return Object.values(state.clubs).some((club) => {
    if (!club.aiManager) return false;
    return (playersByClub.get(club.id) ?? []).some((playerId) =>
      shouldInitiateRenewal(state, playerId),
    );
  });
}

function aiDailyContracts(state: GameState): GameState {
  let next = state;
  const playersByClub = buildClubPlayerIndex(next);
  const openContractPlayers = new Set(
    (next.negotiations ?? [])
      .filter((session) => session.type === "contract" && session.status === "open")
      .map((session) => session.playerId),
  );
  const maxContractsPerDay = 12;
  let createdToday = 0;

  for (const club of Object.values(next.clubs)) {
    if (!club.aiManager) continue;
    for (const pid of playersByClub.get(club.id) ?? []) {
      if (createdToday >= maxContractsPerDay) break;
      if (openContractPlayers.has(pid)) continue;
      if (!shouldInitiateRenewal(next, pid)) continue;

      const player = next.players[pid];
      if (!player) continue;
      const currentSalary = Number(String(player.salary).replace(/[€,]/g, "").split(" ")[0]) || 0;
      const weekly = Math.max(1000, Math.round(currentSalary * 1.08));
      const offer = { salaryWeekly: weekly, years: 2, signingBonus: 0, guaranteedStarts: false };
      next = createNegotiationSession(
        next,
        club.id,
        club.id,
        pid,
        {
          salaryWeekly: offer.salaryWeekly,
          years: offer.years,
          signingBonus: offer.signingBonus,
          guaranteedStarts: offer.guaranteedStarts,
        },
        "AI renewal offer",
        "contract",
      );
      openContractPlayers.add(pid);
      createdToday += 1;
    }
    if (createdToday >= maxContractsPerDay) break;
  }
  return next;
}

registerDailyHook("events", (state, time) => {
  const dayOfCycle = state.time.day % 7;
  const dueForWeeklyReview = dayOfCycle === 0;
  const playersByClub = buildClubPlayerIndex(state);
  const dueForExpiryReview = hasExpiringAIContracts(state, playersByClub);

  if (!dueForWeeklyReview && !dueForExpiryReview) return state;

  const reviewKey = state.meta?.["lastAiContractReviewDate"];
  if (reviewKey && daysBetweenISO(reviewKey, state.time.date) < 7) return state;

  return aiDailyContracts({
    ...state,
    meta: {
      ...(state.meta ?? {}),
      lastAiContractReviewDate: state.time.date,
    },
  });
});

export {};
