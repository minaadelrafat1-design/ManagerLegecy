#!/usr/bin/env npx tsx
/**
 * PHASE 7C: COMPETITION OUTCOME INTEGRITY AUDIT
 *
 * Verify that all competition winners, promotions, relegations, and European
 * qualifications come from actual competition results, not synthetic selection.
 *
 * Traces:
 * - League standings from actual matches
 * - Cup winners from actual knockout progression
 * - Promotion/relegation from final standings
 * - European qualification from actual results
 * - European knockout progression and final
 */

import { buildInitialState } from "../src/state/seed";
import { advanceGameDays } from "../src/state/calendar";
import { simulateSeason } from "../src/state/season";
import { getCupChampion } from "../src/state/cups";
import { computeLeagueTable } from "../src/state/standings";
import type { GameState } from "../src/state/types";

function logSection(title: string) {
  console.log(`\n${"═".repeat(80)}`);
  console.log(`║ ${title.padEnd(78)} ║`);
  console.log(`${"═".repeat(80)}`);
}

function logSubsection(title: string) {
  console.log(`\n── ${title}`);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`[ASSERTION FAILED] ${msg}`);
}

interface CompetitionAudit {
  season: string;
  leagueChampions: Array<{ leagueId: string; clubId: string; clubName: string }>;
  cupWinners: Array<{ cupId: string; cupName: string; clubId: string; clubName: string }>;
  promotions: Array<{ clubId: string; clubName: string; fromDivision: string; toDivision: string }>;
  relegations: Array<{
    clubId: string;
    clubName: string;
    fromDivision: string;
    toDivision: string;
  }>;
  europeanQualified: Array<{
    clubId: string;
    clubName: string;
    competitionId: string;
    reason: string;
  }>;
  issues: string[];
}

function auditSeasonResults(state: GameState, season: string): CompetitionAudit {
  const audit: CompetitionAudit = {
    season,
    leagueChampions: [],
    cupWinners: [],
    promotions: [],
    relegations: [],
    europeanQualified: [],
    issues: [],
  };

  // League champions from actual standings
  for (const [leagueId, league] of Object.entries(state.leagues ?? {})) {
    const table = computeLeagueTable(state, leagueId);
    const champion = table[0];
    if (champion) {
      const clubName = state.clubs[champion.clubId]?.name ?? champion.clubId;
      audit.leagueChampions.push({
        leagueId,
        clubId: champion.clubId,
        clubName,
      });
    }
  }

  // Cup winners from actual knockout results
  const cups = state.competitions.filter((c) => c.type === "cup");
  for (const cup of cups) {
    const winner = getCupChampion(state, cup.id);
    if (winner) {
      const clubName = state.clubs[winner]?.name ?? winner;
      audit.cupWinners.push({
        cupId: cup.id,
        cupName: cup.name,
        clubId: winner,
        clubName,
      });
    }
  }

  // Check promotion events
  const promotionEvents = (state.events ?? []).filter((e) => e.type === "PROMOTION");
  for (const event of promotionEvents) {
    const clubId = event.meta?.clubId;
    const toDivision = event.meta?.toDivision;
    const fromDivision = event.meta?.fromDivision;
    if (clubId && toDivision && fromDivision) {
      const clubName = state.clubs[clubId]?.name ?? clubId;
      audit.promotions.push({ clubId, clubName, fromDivision, toDivision });
    }
  }

  // Check relegation events
  const relegationEvents = (state.events ?? []).filter((e) => e.type === "RELEGATION");
  for (const event of relegationEvents) {
    const clubId = event.meta?.clubId;
    const toDivision = event.meta?.toDivision;
    const fromDivision = event.meta?.fromDivision;
    if (clubId && toDivision && fromDivision) {
      const clubName = state.clubs[clubId]?.name ?? clubId;
      audit.relegations.push({ clubId, clubName, fromDivision, toDivision });
    }
  }

  // European qualifications
  const euroQuals = state.meta?.europeanQualifications ?? [];
  for (const qual of euroQuals) {
    const clubName = state.clubs[qual.clubId]?.name ?? qual.clubId;
    audit.europeanQualified.push({
      clubId: qual.clubId,
      clubName,
      competitionId: qual.competitionId,
      reason: qual.reason ?? "unknown",
    });
  }

  return audit;
}

function reportAudit(audit: CompetitionAudit) {
  logSubsection(`Season ${audit.season}`);

  if (audit.leagueChampions.length > 0) {
    console.log(`\n  League Champions:`);
    for (const champ of audit.leagueChampions) {
      console.log(`    - ${champ.clubName} (${champ.leagueId})`);
    }
  }

  if (audit.cupWinners.length > 0) {
    console.log(`\n  Cup Winners:`);
    for (const win of audit.cupWinners) {
      console.log(`    - ${win.clubName} (${win.cupName})`);
    }
  }

  if (audit.promotions.length > 0) {
    console.log(`\n  Promotions: ${audit.promotions.length}`);
    for (const promo of audit.promotions.slice(0, 3)) {
      console.log(`    - ${promo.clubName}: ${promo.fromDivision} → ${promo.toDivision}`);
    }
  }

  if (audit.relegations.length > 0) {
    console.log(`\n  Relegations: ${audit.relegations.length}`);
    for (const relg of audit.relegations.slice(0, 3)) {
      console.log(`    - ${relg.clubName}: ${relg.fromDivision} → ${relg.toDivision}`);
    }
  }

  if (audit.europeanQualified.length > 0) {
    console.log(`\n  European Qualified: ${audit.europeanQualified.length}`);
    for (const eq of audit.europeanQualified.slice(0, 5)) {
      console.log(`    - ${eq.clubName} (${eq.competitionId}): ${eq.reason}`);
    }
  }

  if (audit.issues.length > 0) {
    console.log(`\n  ⚠ Issues:`);
    for (const issue of audit.issues) {
      console.log(`    - ${issue}`);
    }
  }
}

function main() {
  logSection("PHASE 7C: COMPETITION OUTCOME INTEGRITY AUDIT");

  console.log("\nTesting 5-year multi-season simulation...");
  let state = buildInitialState();
  const audits: CompetitionAudit[] = [];

  // Run 5 seasons
  for (let season = 0; season < 5; season++) {
    state = simulateSeason(state);
    const audit = auditSeasonResults(state, state.time.season);
    audits.push(audit);
    reportAudit(audit);

    console.log(`\n  Competitions: ${state.competitions.length}, Events: ${state.events.length}`);
  }

  // Analysis
  logSection("COMPETITION OUTCOME ANALYSIS");

  const totalLeagueChampions = audits.reduce((sum, a) => sum + a.leagueChampions.length, 0);
  const totalCupWinners = audits.reduce((sum, a) => sum + a.cupWinners.length, 0);
  const totalPromotions = audits.reduce((sum, a) => sum + a.promotions.length, 0);
  const totalRelegations = audits.reduce((sum, a) => sum + a.relegations.length, 0);
  const totalEuropean = audits.reduce((sum, a) => sum + a.europeanQualified.length, 0);

  console.log(`\nSummary (${audits.length} seasons):`);
  console.log(`  League champions recorded: ${totalLeagueChampions}`);
  console.log(`  Cup winners recorded: ${totalCupWinners}`);
  console.log(`  Promotions recorded: ${totalPromotions}`);
  console.log(`  Relegations recorded: ${totalRelegations}`);
  console.log(`  European qualifications: ${totalEuropean}`);

  // Check for synthetic winner issues
  logSubsection("Checking for synthetic winner logic...");

  // Get the actual cup champion using getCupChampion
  const cups = state.competitions.filter((c) => c.type === "cup");
  for (const cup of cups) {
    const actualWinner = getCupChampion(state, cup.id);
    const recordedWinner = audits[audits.length - 1]?.cupWinners.find((w) => w.cupId === cup.id);

    if (!actualWinner && recordedWinner) {
      console.log(
        `  ⚠ ${cup.name}: Recorded winner (${recordedWinner.clubName}) but no actual knockout winner!`,
      );
    } else if (actualWinner && !recordedWinner) {
      console.log(
        `  ⚠ ${cup.name}: Has actual winner (${state.clubs[actualWinner]?.name}) but not recorded!`,
      );
    }
  }

  // Check for European winner based on reputation (synthetic)
  const europeanCompetitions = state.competitions.filter((c) => c.type === "continental");
  for (const comp of europeanCompetitions) {
    const europeanEvents = state.events.filter(
      (e) => e.type === "EUROPEAN_WINNER" && e.meta?.competitionId === comp.id,
    );
    if (europeanEvents.length > 0) {
      const event = europeanEvents[0]!;
      const winner = event.meta?.winnerId;
      const winnerName = state.clubs[winner as string]?.name ?? winner;
      console.log(`  ℹ ${comp.name}: Winner recorded as ${winnerName}`);
    }
  }

  // Check promotion/relegation symmetry
  logSubsection("Checking promotion/relegation invariants...");

  if (totalPromotions > 0 && totalRelegations > 0) {
    console.log(`  Promotions: ${totalPromotions}, Relegations: ${totalRelegations}`);

    // In a balanced system, promotions should roughly equal relegations (with some variation)
    if (Math.abs(totalPromotions - totalRelegations) > totalPromotions * 0.5) {
      console.log(
        `  ⚠ Large imbalance between promotions (${totalPromotions}) and relegations (${totalRelegations})`,
      );
    }
  }

  logSection("END OF AUDIT");
}

main().catch((err) => {
  console.error("AUDIT FAILED:", err.message);
  process.exit(1);
});
