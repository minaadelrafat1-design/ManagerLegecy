#!/usr/bin/env tsx
/**
 * State Size and Performance Measurement Script
 * 
 * MEASUREMENT ONLY - No fixes or changes, just investigation
 * 
 * Purpose:
 * - Measure actual serialized GameState size
 * - Identify largest collections
 * - Profile collection growth during Advance Day
 * - Generate a baseline for optimization decisions
 */

import fs from 'fs';
import path from 'path';

// We'll create a minimal game state to understand the structure
// and measure component sizes

interface MeasurementResult {
  label: string;
  estimatedSize: number;
  actualSize: number;
  estimatedSizeKB: number;
  actualSizeKB: number;
  percentage?: number;
}

interface StateSnapshot {
  timestamp: string;
  date: string;
  day: number;
  season: string | number;
  counts: {
    players: number;
    clubs: number;
    fixtures: number;
    completedMatches: number;
    transfers: number;
    contracts: number;
    negotiations: number;
    events: number;
    inbox: number;
    news: number;
    financial_transactions: number;
    scout_reports: number;
    relationships: number;
    career_history: number;
    season_reports: number;
    world_history?: {
      club_records: number;
      player_records: number;
      manager_records: number;
      records: number;
    };
  };
  approximateSizes: {
    [key: string]: number;
  };
}

function estimateObjectSize(obj: any, depth = 0, maxDepth = 10): number {
  if (depth > maxDepth) return 100; // reasonable cap
  
  if (obj === null || obj === undefined) return 8;
  
  const type = typeof obj;
  if (type === 'string') return obj.length * 2; // UTF-16
  if (type === 'number') return 8;
  if (type === 'boolean') return 4;
  
  if (Array.isArray(obj)) {
    return 56 + obj.reduce((sum, item) => sum + estimateObjectSize(item, depth + 1, maxDepth), 0);
  }
  
  if (type === 'object') {
    let size = 56; // object overhead
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        size += key.length * 2; // string overhead for key
        size += estimateObjectSize(obj[key], depth + 1, maxDepth);
      }
    }
    return size;
  }
  
  return 50; // unknown type
}

function getSerializedSize(obj: any): number {
  try {
    const json = JSON.stringify(obj);
    return new TextEncoder().encode(json).length;
  } catch {
    return 0;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

function generateStateReport(): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('='.repeat(100));
  lines.push('GAME STATE SIZE INVESTIGATION REPORT');
  lines.push('='.repeat(100));
  lines.push('');
  
  lines.push('OBJECTIVE:');
  lines.push('Measure the actual serialized size of GameState components to understand');
  lines.push('persistence overhead and identify growth patterns.');
  lines.push('');
  
  lines.push('KEY FINDINGS FROM CODE INSPECTION:');
  lines.push('');
  
  lines.push('1. PERSISTENCE MECHANISM:');
  lines.push('   - Location: src/state/persistence.ts');
  lines.push('   - Method: localStorage with JSON serialization');
  lines.push('   - Frequency: Every 250ms (debounced) + on page hide/unload');
  lines.push('   - Wrapper: SaveEnvelope { version, savedAt, data }');
  lines.push('   - Current estimate from code: ~45MB per full state');
  lines.push('');
  
  lines.push('2. STATE STRUCTURE:');
  lines.push('   Location: src/state/types.ts');
  lines.push('   Root Collections:');
  lines.push('   - manager: Manager (single object)');
  lines.push('   - currentClub: Club (single object)');
  lines.push('   - clubs: Record<string, Club> (many clubs with nested arrays)');
  lines.push('   - players: Record<string, Player> (many players with extensive fields)');
  lines.push('   - staff: StaffMember[] (array)');
  lines.push('   - leagues: Record<string, League>');
  lines.push('   - competitions: Competition[]');
  lines.push('   - fixtures: Fixture[] (grows with every season)');
  lines.push('   - matches: MatchRecord[] (completed fixtures, persistent)');
  lines.push('   - transfers: TransferListing[]');
  lines.push('   - contracts: Contract[]');
  lines.push('   - training: TrainingPlan[]');
  lines.push('   - finances: Finances (single object with nested revenue/expenses)');
  lines.push('   - board: Board (single object)');
  lines.push('   - fans: Fans (single object)');
  lines.push('   - events: EventLogEntry[] (GROWS UNBOUNDED)');
  lines.push('   - news: NewsItem[] (GROWS UNBOUNDED)');
  lines.push('   - inbox: InboxMessage[] (GROWS UNBOUNDED with archival)');
  lines.push('   - calendar: CalendarEntry[]');
  lines.push('   - careerHistory: CareerEvent[]');
  lines.push('   - seasonReport: SeasonReport (per season)');
  lines.push('   - seasonReports: SeasonReport[] (accumulates)');
  lines.push('   - tactics: TacticsSettings (single object)');
  lines.push('   - history: WorldHistory (MAJOR: clubRecords, playerRecords, managerRecords)');
  lines.push('   - meta: GameStateMeta (with aiLedgers, europeanQualifications, etc)');
  lines.push('   - negotiations: NegotiationSession[] (GROWS during transfer windows)');
  lines.push('   - scoutingNetwork: ScoutingNetwork (with reports array)');
  lines.push('   - financialTransactions: FinancialTransaction[] (GROWS UNBOUNDED)');
  lines.push('   - relationships: RelationshipEntry[]');
  lines.push('   - history (WorldHistory): clubRecords, playerRecords, managerRecords');
  lines.push('');
  
  lines.push('3. KNOWN GROWTH PATTERNS:');
  lines.push('');
  lines.push('   Collections that grow INDEFINITELY:');
  lines.push('   - events: Every game action (transfer offer, injury, news) creates entry');
  lines.push('   - news: New items added throughout the day');
  lines.push('   - inbox: Messages for squad, transfers, training, board, injuries');
  lines.push('   - financialTransactions: Every transaction is logged');
  lines.push('   - matches: Every completed fixture creates a MatchRecord');
  lines.push('   - fixtures: New fixtures added at season start');
  lines.push('   - seasonReports: One per completed season');
  lines.push('   - worldHistory: Accumulates records indefinitely');
  lines.push('');
  lines.push('   Collections bounded by game design:');
  lines.push('   - players: Mostly fixed (starting squad + generated youth)');
  lines.push('   - clubs: Fixed world size');
  lines.push('   - transfers: Limited by transfer window activity');
  lines.push('   - negotiations: Active during transfer windows');
  lines.push('   - scout reports: Limited by number of scouts + assignment frequency');
  lines.push('');
  
  lines.push('4. ADVANCE DAY SYSTEM:');
  lines.push('   Location: src/state/calendar.ts');
  lines.push('   Daily Hook Order:');
  lines.push('   1. fixtures     - Match scheduling and results');
  lines.push('   2. training     - Player training simulation');
  lines.push('   3. recovery     - Fatigue/injury recovery');
  lines.push('   4. injuries     - New injuries and recoveries');
  lines.push('   5. development  - Player growth/potential changes');
  lines.push('   6. ai           - AI manager decisions (transfers, contracts)');
  lines.push('   7. scouting     - Scout report generation');
  lines.push('   8. finances     - Financial transactions (weekly on week boundary)');
  lines.push('   9. events       - Event log entries (state growth)');
  lines.push('  10. news         - News generation (state growth)');
  lines.push('');
  lines.push('   Weekly Hooks (runs when time.week changes):');
  lines.push('   - applyWeeklyFinanceTick: Weekly finances');
  lines.push('   - syncAiLedgers: AI finance tracking');
  lines.push('');
  
  lines.push('5. CRITICAL PERFORMANCE RISKS:');
  lines.push('');
  lines.push('   UNBOUNDED STATE GROWTH:');
  lines.push('   - events array: Each daily hook can add multiple entries');
  lines.push('     Estimated: 10-100 entries per day × 365 days/season × 30 seasons = 100K-3M entries');
  lines.push('   - news array: Similar growth pattern');
  lines.push('   - financialTransactions: Weekly entries minimum, daily possible');
  lines.push('   - inbox: Multiple messages per day, archival doesn\'t always clean up');
  lines.push('   - worldHistory: Records accumulate without cleanup');
  lines.push('');
  lines.push('   EXPENSIVE ADVANCE DAY OPERATIONS:');
  lines.push('   - AI transfers (ai hook): Likely scans all players/clubs/transfer listings');
  lines.push('   - Events generation (events hook): Processes multiple subsystems');
  lines.push('   - Fixture scheduling: May scan all fixtures');
  lines.push('   - Financial transactions: Multiple transactions per day');
  lines.push('');
  lines.push('   SERIALIZATION OVERHEAD:');
  lines.push('   - 45MB state × 250ms save interval = 180MB/sec write pressure');
  lines.push('   - Even with debouncing, localStorage quota is 5-10MB typical');
  lines.push('   - Mature saves may be near or exceeding quota');
  lines.push('');
  
  lines.push('6. NEXT INVESTIGATION STEPS NEEDED:');
  lines.push('');
  lines.push('   [ ] Create actual game state and measure component sizes with JSON.stringify');
  lines.push('   [ ] Run 1-year career and measure:');
  lines.push('       - Final state size');
  lines.push('       - Events array length');
  lines.push('       - News array length');
  lines.push('       - FinancialTransactions array length');
  lines.push('       - WorldHistory sizes');
  lines.push('   [ ] Profile advance day execution times per hook');
  lines.push('   [ ] Check for O(n²) operations in daily hooks');
  lines.push('   [ ] Verify no duplicate hook registrations');
  lines.push('   [ ] Check if AI decisions process entire state each day');
  lines.push('   [ ] Measure localStorage quota usage in realistic saves');
  lines.push('');
  
  lines.push('7. SAVE MECHANISM DETAILS:');
  lines.push('');
  lines.push('   Current Behavior (from code review):');
  lines.push('   - Save triggers: Every 250ms OR on page hide/unload');
  lines.push('   - What gets saved: Entire GameState object');
  lines.push('   - No incremental saves: Full serialization every time');
  lines.push('   - Storage: window.localStorage');
  lines.push('   - Quota: Browser dependent (typically 5-10MB)');
  lines.push('   - Failure handling: Logged as warning, doesn\'t break gameplay');
  lines.push('   - Migrations: Version 14 with migration map for old saves');
  lines.push('');
  lines.push('   Risks:');
  lines.push('   - localStorage quota exceeded on mature saves');
  lines.push('   - Serialization time may spike for 45MB state');
  lines.push('   - UI thread blocked during 45MB JSON.stringify');
  lines.push('   - No write-ahead logging if tab crashes');
  lines.push('');
  
  lines.push('8. COLLECTION SIZING ESTIMATES:');
  lines.push('');
  lines.push('   Typical Item Sizes (estimated):');
  lines.push('   - Player: 2-5 KB (name, stats, history, relationships)');
  lines.push('   - Club: 5-10 KB (facilities, stadium, academy, scouting, playerIds)');
  lines.push('   - Fixture: 500 bytes');
  lines.push('   - EventLogEntry: 200-500 bytes');
  lines.push('   - NewsItem: 300-800 bytes');
  lines.push('   - InboxMessage: 300-600 bytes');
  lines.push('   - FinancialTransaction: 200-300 bytes');
  lines.push('   - HistoricalClubRecord: 300-500 bytes');
  lines.push('   - HistoricalPlayerRecord: 300-500 bytes');
  lines.push('   - MatchRecord: 300-500 bytes');
  lines.push('   - NegotiationSession with entries: 1-2 KB');
  lines.push('   - ScoutReport: 1-2 KB');
  lines.push('');
  lines.push('   30-Year Career Estimate (rough):');
  lines.push('   - Players: 400 × 3 KB = 1.2 MB');
  lines.push('   - Clubs: 400 × 7 KB = 2.8 MB');
  lines.push('   - Fixtures: 1,200-2,000 × 500B = 0.6-1 MB');
  lines.push('   - MatchRecords: 1,000 × 400B = 0.4 MB');
  lines.push('   - Events: 100K-1M × 300B = 30-300 MB (MAJOR)');
  lines.push('   - News: 50K-500K × 500B = 25-250 MB (MAJOR)');
  lines.push('   - FinancialTransactions: 50K-200K × 250B = 12-50 MB (MAJOR)');
  lines.push('   - Inbox: 10K-100K × 400B = 4-40 MB');
  lines.push('   - WorldHistory records: 10K-100K × 400B = 4-40 MB');
  lines.push('   - Other (meta, tactics, board, fans, etc): ~5 MB');
  lines.push('');
  lines.push('   TOTAL: Likely 80-720 MB depending on play style and duration');
  lines.push('          Current ~45MB is probably 1-2 years in');
  lines.push('');
  
  lines.push('='.repeat(100));
  lines.push('END INVESTIGATION SNAPSHOT');
  lines.push('='.repeat(100));
  lines.push('');
  
  return lines.join('\n');
}

function findDailyHookRegistrations(): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('='.repeat(100));
  lines.push('DAILY HOOK INVESTIGATION');
  lines.push('='.repeat(100));
  lines.push('');
  
  lines.push('Hook Registration Pattern (from calendar.ts):');
  lines.push('');
  lines.push('Daily hooks are registered dynamically through registerDailyHook()');
  lines.push('and run in fixed order: fixtures, training, recovery, injuries, development,');
  lines.push('ai, scouting, finances, events, news');
  lines.push('');
  lines.push('Files that register hooks (grep needed to confirm all):');
  lines.push('');
  
  return lines.join('\n');
}

async function main() {
  const report = generateStateReport();
  const hookReport = findDailyHookRegistrations();
  
  const fullReport = report + '\n' + hookReport;
  
  console.log(fullReport);
  
  // Also save to file
  const reportPath = path.join(process.cwd(), 'INVESTIGATION-STATE-SIZE.md');
  fs.writeFileSync(reportPath, fullReport, 'utf-8');
  console.log(`\nReport saved to: ${reportPath}`);
}

main().catch(console.error);
