import type { Club, ClubIdentity, GameState, GameStateMeta, Player } from "./types";
import { computeLeagueTable } from "./standings";
import computeClubFinancials from "./club-finance";
import { seededUnit } from "./utils";
import { generateAIManager } from "./ai-manager";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function ensureMeta(state: GameState) {
  const meta = { ...(state.meta ?? {}), aiLedgers: state.meta?.aiLedgers ?? {} } as GameStateMeta;
  if (!meta.aiLedgers) {
    meta.aiLedgers = {};
  }
  state.meta = meta;
  return state;
}

export function applyLongTermEvolution(state: GameState): GameState {
  let next = { ...state } as GameState;
  next = ensureMeta(next);

  const events = [...(next.events ?? [])];

  // Update clubs deterministically based on recent league performance
  for (const clubId of Object.keys(next.clubs)) {
    const club = next.clubs[clubId];
    if (!club) continue;

    // league performance (if club's league exists)
    const leagueId = club.leagueId;
    let perfScore = 0.5; // neutral
    try {
      const table = computeLeagueTable(next, leagueId);
      const row = table.find((r) => r.clubId === clubId);
      if (row) {
        const n = table.length || 1;
        perfScore = (n - row.position + 1) / n; // 0..1, higher is better
      }
    } catch (e) {
      perfScore = 0.5;
    }

    // Reputation shifts: reward overperform, penalize underperform
    const repDelta = Math.round(
      (perfScore - 0.5) * 6 + (seededUnit(`${clubId}:rep:${next.time.season}`) - 0.5) * 2,
    );
    const newReputation = clamp(club.reputation + repDelta, 1, 100);

    // Update academy rating slowly, influenced by identity.academyFocus and facilities.youth
    const academyFocus = club.identity?.academyFocus ?? 50;
    const youthFac = club.facilities?.youth ?? 50;
    const academyDelta = Math.round(
      ((academyFocus - 50) / 100) * 2 +
        (youthFac - 50) / 100 +
        (seededUnit(`${clubId}:aca:${next.time.season}`) - 0.5),
    );
    const newAcademy = clamp((club.academy?.rating ?? 50) + academyDelta, 1, 100);

    // Facilities investment decision: deterministic chance based on perf and available AI ledger
    const ledger = (next.meta!.aiLedgers ?? {})[clubId] ?? null;
    const facilityLevels = {
      training: club.facilityLevels?.training ?? 1,
      youth: club.facilityLevels?.youth ?? 1,
      medical: club.facilityLevels?.medical ?? 1,
      scouting: club.facilityLevels?.scouting ?? 1,
    };
    if (ledger) {
      // successful clubs reinvest some funds into facilities
      const investChance = perfScore * 0.6 + seededUnit(`${clubId}:inv:${next.time.season}`) * 0.4;
      if (investChance > 0.65) {
        // pick one facility to improve if not maxed
        const choices = ["training", "youth", "medical", "scouting"] as const;
        const idx = Math.floor(seededUnit(`${clubId}:pick:${next.time.season}`) * choices.length);
        const key = choices[idx] as (typeof choices)[number];
        facilityLevels[key] = Math.min(5, (facilityLevels[key] ?? 1) + 1);
      }
    }

    // Financial model: prefer the authoritative computeClubFinancials output
    if (ledger) {
      try {
        const cf = computeClubFinancials(next, clubId);
        // use snapshot income/expenses as weekly estimates
        const weeklyIncome = cf.income.total;
        const weeklyExpenses = cf.expenses.total;

        const surplusWeekly = weeklyIncome - weeklyExpenses;
        const tb = Math.round(ledger.transferBudget + surplusWeekly * 0.15);
        const wb = Math.round(ledger.wageBudgetWeekly + surplusWeekly * 0.02);

        // If surplus is meaningfully positive, invest in facilities occasionally
        if (surplusWeekly > 50_000 && seededUnit(`${clubId}:invest:${next.time.season}`) > 0.5) {
          const choices = ["training", "youth", "medical", "scouting"] as const;
          const idx = Math.floor(
            seededUnit(`${clubId}:finpick:${next.time.season}`) * choices.length,
          );
          const key = choices[idx] as (typeof choices)[number];
          facilityLevels[key] = Math.min(5, (facilityLevels[key] ?? 1) + 1);
          events.push({
            id: `event-invest-${events.length + 1}`,
            date: next.time.date,
            type: "milestone",
            description: `${club.name} invested in ${key}`,
          });
        }

        // If in deficit, board may decide to take a loan
        if (tb < 0 || ledger.transferBudget < 0) {
          const loan = Math.round(Math.max(100_000, Math.abs(tb) * 0.5));
          const newTb = tb + loan;
          events.push({
            id: `event-loan-${events.length + 1}`,
            date: next.time.date,
            type: "milestone",
            description: `${club.name} secured a loan of €${loan}`,
          });
          next.meta!.aiLedgers = {
            ...(next.meta!.aiLedgers ?? {}),
            [clubId]: { ...ledger, transferBudget: newTb, wageBudgetWeekly: Math.max(0, wb) },
          };
        } else {
          next.meta!.aiLedgers = {
            ...(next.meta!.aiLedgers ?? {}),
            [clubId]: {
              ...ledger,
              transferBudget: Math.max(0, tb),
              wageBudgetWeekly: Math.max(0, wb),
            },
          };
        }
      } catch (err) {
        // fall back to legacy behaviour if compute fails

        console.error("evolution: computeClubFinancials failed", err);
      }
    }

    // Apply small facility rating changes (training/medical/stadium)
    const fac = {
      training: club.facilities?.training ?? 50,
      medical: club.facilities?.medical ?? 50,
      youth: club.facilities?.youth ?? 50,
      stadium: club.facilities?.stadium ?? 50,
    };
    fac.training = clamp(
      fac.training +
        Math.round(
          (perfScore - 0.5) * 3 + (seededUnit(`${clubId}:fac:${next.time.season}`) - 0.5) * 2,
        ),
    );
    fac.medical = clamp(
      fac.medical +
        Math.round(
          (perfScore - 0.5) * 2 + (seededUnit(`${clubId}:med:${next.time.season}`) - 0.5) * 1,
        ),
    );
    fac.youth = clamp(fac.youth + Math.round(((academyFocus - 50) / 100) * 2));

    // Manager / AI manager churn: underperforming clubs may replace their AI manager
    let aiManager = club.aiManager;
    if (aiManager) {
      const sackRisk =
        (1 - perfScore) * 0.6 + (seededUnit(`${clubId}:mgr:${next.time.season}`) - 0.3);
      if (sackRisk > 0.6) {
        // replace with a new deterministic ai manager
        aiManager = generateAIManager({
          id: club.id,
          name: club.name,
          formation: club.formation,
          reputation: newReputation,
          facilities: fac,
        });
        events.push({
          id: `event-mgr-${events.length + 1}`,
          date: next.time.date,
          type: "milestone",
          description: `Manager change at ${club.name}`,
        });
      }
      // small chance to adjust manager training/playerDevelopment ratings based on finances
      const ledger = (next.meta!.aiLedgers ?? {})[clubId] ?? null;
      if (ledger) {
        const mgrTrainingDelta = Math.round(
          (seededUnit(`${clubId}:mgrtrain:${next.time.season}`) - 0.5) * 4,
        );
        aiManager.training = clamp((aiManager.training ?? 50) + mgrTrainingDelta);
        aiManager.playerDevelopment = clamp(
          (aiManager.playerDevelopment ?? 50) +
            Math.round((seededUnit(`${clubId}:mgrdev:${next.time.season}`) - 0.5) * 4),
        );
      }
    }

    // Player retirement: PHASE AAA-REPAIR-4: Retirement now handled solely in runSeasonalPlayerLifecycle
    // This ensures age calculation and retirement checks use DOB-based age and happen once per season.
    // The old retirement logic here has been removed to prevent duplicate events.
    const nextPlayers = { ...next.players } as Record<string, Player>;
    const nextClubPlayerIds = [...(club.playerIds ?? [])];

    // Board decision: minor adjustments to club.identity.transferBudgetFactor based on finances
    if (next.meta!.aiLedgers && next.meta!.aiLedgers[clubId]) {
      const ledgerNow = next.meta!.aiLedgers[clubId];
      const identityBase: ClubIdentity = {
        archetype: club.identity?.archetype ?? "balanced",
        academyFocus: club.identity?.academyFocus ?? 50,
        boardPatience: club.identity?.boardPatience ?? 50,
        transferBudgetFactor: club.identity?.transferBudgetFactor ?? 1,
        expectations: club.identity?.expectations ?? "normal",
        preferExperienced: club.identity?.preferExperienced ?? 50,
        ...(club.identity?.confidence ? { confidence: club.identity.confidence } : {}),
      };

      if (
        ledgerNow.transferBudget > 1_000_000 &&
        (club.identity?.transferBudgetFactor ?? 1) < 1.6
      ) {
        // board grows ambition slightly
        const newFactor = Math.min(1.6, (club.identity?.transferBudgetFactor ?? 1) + 0.05);
        events.push({
          id: `event-board-${events.length + 1}`,
          date: next.time.date,
          type: "milestone",
          description: `${club.name} board increases transfer appetite`,
        });
        club.identity = { ...identityBase, transferBudgetFactor: newFactor };
      }
      if (ledgerNow.transferBudget < 0 && (club.identity?.transferBudgetFactor ?? 1) > 0.5) {
        const newFactor = Math.max(0.5, (club.identity?.transferBudgetFactor ?? 1) - 0.08);
        events.push({
          id: `event-board-${events.length + 1}`,
          date: next.time.date,
          type: "milestone",
          description: `${club.name} board tightens purse strings`,
        });
        club.identity = { ...identityBase, transferBudgetFactor: newFactor };
      }
    }

    const { aiManager: existingAiManager, identity: existingIdentity, ...clubBase } = club;
    const updatedClub: Club = {
      ...clubBase,
      reputation: newReputation,
      academy: {
        ...(club.academy ?? {}),
        rating: newAcademy,
        prospectIds: club.academy?.prospectIds ?? [],
      },
      facilityLevels: facilityLevels,
      facilities: fac,
      playerIds: nextClubPlayerIds,
      ...(existingAiManager ? { aiManager: existingAiManager } : {}),
      ...(existingIdentity ? { identity: existingIdentity } : {}),
      ...(aiManager ? { aiManager } : {}),
      ...(club.identity ? { identity: club.identity } : {}),
    };

    next = {
      ...next,
      players: nextPlayers,
      clubs: {
        ...next.clubs,
        [clubId]: updatedClub,
      },
      events,
    };
  }

  return next;
}

export default applyLongTermEvolution;
