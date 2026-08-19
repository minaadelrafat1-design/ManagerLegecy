/**
 * PHASE 1 BASELINE MEASUREMENTS
 *
 * Measures real Advance Day performance in both fresh and realistic careers.
 *
 * Output format: CSV with per-day metrics
 * Date,Day,TotalMs,DayNum,Season,Week,Clubs,Players,Transfers,Negotiations,
 * Events,News,Fixtures,Inbox,Contracts,CareerHistory,fixtures,training,recovery,
 * injuries,development,ai,scouting,finances,events,news
 */

import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";
import {
  advanceGameDays,
  DAILY_HOOK_ORDER,
  getAdvanceDayTimings,
  startAdvanceDayProfiling,
  stopAdvanceDayProfiling,
} from "../src/state/calendar";
import "../src/state/store";

// Import all modules so hooks register
import "../src/state/ai-contracts";
import "../src/state/ai-evolution";
import "../src/state/ai-transfers";
import "../src/state/training";
import "../src/state/world-tick";
import "../src/state/media";
import "../src/state/inbox";
import "../src/state/board";
import "../src/state/events-engine";

import type { GameState } from "../src/state/types";

interface MeasurementRow {
  date: string;
  day: number;
  season: string;
  week: number;
  totalMs: number;
  clubs: number;
  players: number;
  transfers: number;
  negotiations: number;
  events: number;
  news: number;
  fixtures: number;
  inbox: number;
  contracts: number;
  careerHistory: number;
  hooks: Record<string, number>;
}

function countStateMetrics(state: GameState): Omit<MeasurementRow, 'totalMs' | 'date' | 'day' | 'season' | 'week' | 'hooks'> {
  return {
    clubs: Object.keys(state.clubs ?? {}).length,
    players: Object.keys(state.players ?? {}).length,
    transfers: (state.transfers ?? []).length,
    negotiations: (state.negotiations ?? []).length,
    events: (state.events ?? []).length,
    news: (state.news ?? []).length,
    fixtures: (state.fixtures ?? []).length,
    inbox: (state.inbox ?? []).length,
    contracts: (state.contracts ?? []).length,
    careerHistory: (state.careerHistory ?? []).length,
  };
}

function serializeRow(row: MeasurementRow): string {
  return [
    row.date,
    row.day,
    row.season,
    row.week,
    row.totalMs.toFixed(2),
    row.clubs,
    row.players,
    row.transfers,
    row.negotiations,
    row.events,
    row.news,
    row.fixtures,
    row.inbox,
    row.contracts,
    row.careerHistory,
    ...DAILY_HOOK_ORDER.map(h => (row.hooks[h] ?? 0).toFixed(2))
  ].join(',');
}

function getCSVHeader(): string {
  return [
    'Date',
    'Day',
    'Season',
    'Week',
    'TotalMs',
    'Clubs',
    'Players',
    'Transfers',
    'Negotiations',
    'Events',
    'News',
    'Fixtures',
    'Inbox',
    'Contracts',
    'CareerHistory',
    ...DAILY_HOOK_ORDER.map(h => `${h}Ms`)
  ].join(',');
}

async function measureScenario(label: string, state: GameState, days: number): Promise<string> {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`BASELINE MEASUREMENT: ${label}`);
  console.log(`Advancing ${days} consecutive days...`);
  console.log(`${'='.repeat(100)}`);

  const results: MeasurementRow[] = [];
  let current = state;
  const startStateSize = JSON.stringify(current).length;

  for (let i = 0; i < days; i++) {
    startAdvanceDayProfiling();

    const dayStart = performance.now();
    const beforeMetrics = countStateMetrics(current);
    
    current = advanceGameDays(current, 1);
    
    const totalMs = performance.now() - dayStart;
    const metrics = countStateMetrics(current);

    // Extract hook timings if available
    let hooks: Record<string, number> = {};
    const data = getAdvanceDayTimings();
    if (data.length > 0) {
      const lastDay = data[data.length - 1];
      if (lastDay) {
        hooks = lastDay.hooks ?? {};
      }
    }

    const row: MeasurementRow = {
      date: current.time.date,
      day: current.time.day,
      season: String(current.time.season),
      week: current.time.week,
      totalMs,
      ...metrics,
      hooks,
    };

    results.push(row);

    // Log progress every 10 days or at end
    if ((i + 1) % 10 === 0 || i === days - 1) {
      console.log(`  Day ${i + 1}/${days}: ${totalMs.toFixed(2)}ms | Transfers=${metrics.transfers} Negotiations=${metrics.negotiations} Events=${metrics.events}`);
    }

    stopAdvanceDayProfiling();
  }

  const endStateSize = JSON.stringify(current).length;
  const stateGrowth = endStateSize - startStateSize;

  // Create CSV output
  let csv = getCSVHeader() + '\n';
  for (const row of results) {
    csv += serializeRow(row) + '\n';
  }

  // Add summary
  const totalMs = results.reduce((sum, r) => sum + r.totalMs, 0);
  const avgMs = totalMs / results.length;
  const maxMs = Math.max(...results.map(r => r.totalMs));
  const minMs = Math.min(...results.map(r => r.totalMs));

  console.log(`\n  SUMMARY:`);
  console.log(`    Total time: ${totalMs.toFixed(2)}ms (${days} days)`);
  console.log(`    Average per day: ${avgMs.toFixed(2)}ms`);
  console.log(`    Max day: ${maxMs.toFixed(2)}ms`);
  console.log(`    Min day: ${minMs.toFixed(2)}ms`);
  console.log(`    State size growth: ${stateGrowth} bytes (${(stateGrowth / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`    Initial state size: ${(startStateSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`    Final state size: ${(endStateSize / 1024 / 1024).toFixed(2)} MB`);

  // Per-hook averages
  console.log(`\n  HOOK TIMING SUMMARY (if available):`);
  const hookTotals: Record<string, { total: number; count: number }> = {};
  for (const row of results) {
    for (const [hook, ms] of Object.entries(row.hooks)) {
      if (!hookTotals[hook]) {
        hookTotals[hook] = { total: 0, count: 0 };
      }
      hookTotals[hook].total += ms;
      hookTotals[hook].count += 1;
    }
  }
  
  const sortedHooks = Object.entries(hookTotals).sort((a, b) => b[1].total - a[1].total);
  for (const [hook, stats] of sortedHooks.slice(0, 10)) {
    const avg = stats.total / stats.count;
    console.log(`    ${hook}: ${(stats.total).toFixed(2)}ms total (avg ${avg.toFixed(2)}ms)`);
  }

  return csv;
}

async function main() {
  try {
    console.log('PHASE 1: ADVANCE DAY PERFORMANCE BASELINE MEASUREMENTS');
    console.log('Building initial state...');
    
    let freshState = buildInitialState();
    const csvResults: Record<string, string> = {};

    // Fresh career: 7 days
    csvResults['fresh-7'] = await measureScenario('FRESH CAREER - 7 DAYS', freshState, 7);

    // Fresh career: 30 days (continuing from previous)
    const freshAfter7 = (() => {
      let s = freshState;
      for (let i = 0; i < 7; i++) {
        s = advanceGameDays(s, 1);
      }
      return s;
    })();
    
    csvResults['fresh-30'] = await measureScenario('FRESH CAREER - 30 DAYS TOTAL', freshAfter7, 23);

    // Mature career: use the existing season progression path to create a
    // populated five-season state, then exercise the real daily path.
    console.log('\nBuilding mature five-season state with simulateSeasonQuick...');
    let matureState = buildInitialState('0');
    for (let season = 0; season < 5; season++) {
      matureState = simulateSeasonQuick(matureState);
      console.log(`  Mature setup season ${season + 1}/5: ${matureState.time.season}`);
    }
    csvResults['mature-30'] = await measureScenario('MATURE CAREER - 5 SEASONS + 30 DAYS', matureState, 30);

    if (process.argv.includes('--fresh-only')) {
      console.log('\nFresh-career measurements complete (--fresh-only).');
      return;
    }

    // Try to load a realistic career if it exists
    try {
      console.log('\nAttempting to load realistic career from localStorage...');
      // This would need to be provided by the user or loaded from a save file
      // For now, we'll note it in the output
      console.log('  (No realistic career available in test environment)');
    } catch (e) {
      console.log('  Could not load realistic career:', String(e));
    }

    // Output all CSVs
    console.log('\n' + '='.repeat(100));
    console.log('MEASUREMENT RESULTS - CSV DATA');
    console.log('='.repeat(100));

    for (const [scenario, csv] of Object.entries(csvResults)) {
      console.log(`\n## ${scenario.toUpperCase()}\n`);
      console.log(csv);
    }

    // Write to files if possible
    const fs = await import('fs/promises');
    for (const [scenario, csv] of Object.entries(csvResults)) {
      const filename = `outputs/baseline-${scenario}.csv`;
      try {
        await fs.mkdir('outputs', { recursive: true });
        await fs.writeFile(filename, csv);
        console.log(`✓ Wrote ${filename}`);
      } catch (e) {
        console.log(`  Could not write ${filename}: ${String(e)}`);
      }
    }

  } catch (error) {
    console.error('FATAL ERROR:', error);
    process.exit(1);
  }
}

main();
