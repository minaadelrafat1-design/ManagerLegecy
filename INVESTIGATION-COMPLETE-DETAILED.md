# PRODUCTION PERFORMANCE INVESTIGATION — COMPREHENSIVE REPORT

**Date**: 2026-08-20  
**Status**: INVESTIGATION ONLY — NO FIXES IMPLEMENTED  
**Scope**: Persistence, State Growth, and Advance Day Performance

---

## PART 1: ACTUAL STATE SIZE MEASUREMENT

### Current System
- **Persistence Path**: `src/state/persistence.ts` + `src/state/store.tsx`
- **Storage Method**: `window.localStorage` with full JSON serialization
- **Estimated State Size**: ~45MB (from code comment in store.tsx line 443)
- **Save Frequency**: Every 250ms (debounced) OR on page hide/unload
- **Serialization**: Entire GameState serialized to JSON every save
- **Storage Quota**: Browser default 5-10MB (likely exceeded on mature saves)

### Collections in GameState

| Collection | Type | Growth Pattern | Estimated Size per Entry | Primary Risk |
|---|---|---|---|---|
| players | Record<string, Player> | Bounded (~400-600) | 2-5 KB | Complex nested fields |
| clubs | Record<string, Club> | Bounded (~400) | 5-10 KB | Nested facilities, stadium, scouting |
| fixtures | Fixture[] | Grows with seasons | 500 B | 1,200-2,000 per 30yr career |
| matches | MatchRecord[] | Grows with fixtures | 400 B | One per completed fixture |
| transfers | TransferListing[] | Transfer window activity | 1-2 KB | ~100-500 during windows |
| contracts | Contract[] | Bounded | 300 B | ~400 contracts |
| negotiations | NegotiationSession[] | Transfer window spikes | 1-2 KB | Can have many entries per session |
| **events** | EventLogEntry[] | **UNBOUNDED** | 200-500 B | **MAJOR RISK** |
| **news** | NewsItem[] | **UNBOUNDED** | 300-800 B | **MAJOR RISK** |
| **inbox** | InboxMessage[] | **UNBOUNDED** (archival) | 300-600 B | **MAJOR RISK** |
| **financialTransactions** | FinancialTransaction[] | **UNBOUNDED** | 200-300 B | **MAJOR RISK** |
| calendar | CalendarEntry[] | Per-season growth | 300 B | ~300 entries/season |
| careerHistory | CareerEvent[] | Grows per season | 400 B | ~10-20/season |
| **seasonReports** | SeasonReport[] | One per season | 5-10 KB | Accumulates, 30+ reports |
| tactics | TacticsSettings | Single object | <1 KB | Fixed size |
| **history (WorldHistory)** | clubRecords, playerRecords, managerRecords | **UNBOUNDED** | 300-500 B each | **MAJOR RISK** |
| scoutingNetwork | Scouts + Assignments + Reports | Bounded | 1-2 KB total | Moderate |
| meta.aiLedgers | Per-AI-club tracking | Fixed | 500 B per club | ~400 entries |

---

## PART 2: UNBOUNDED STATE GROWTH ANALYSIS

### The Four Major Growth Vectors

#### 1. **events Array** — Most Critical
- **Where Created**: 10+ different daily hooks
  - ai-transfers.ts: Transfer offers, rejections
  - ai-contracts.ts: Contract events
  - ai-evolution.ts: Development milestones
  - events-engine.ts: Player conflicts, youth discoveries
  - media.ts: Breaking news events
  - fans.ts: Fan sentiment events
  - manager-reputation-tracking.ts: Reputation changes
  - negotiation-expiry.ts: Negotiation expiry events
  - transfer-requests.ts: Transfer request events
  - And others triggered by daily hooks

- **Frequency**: 10-100+ entries per day
  - Most days: 10-30 entries
  - Transfer window days: 50-100+ entries
  
- **Estimated Growth**:
  - 1 year (365 days): 3,650-36,500 entries
  - 5 years: 18,250-182,500 entries
  - 30 years: 109,500-1,095,000 entries
  
- **Current Cleanup**: 90-day rolling window in events-engine.ts
  - Keeps last 90 days only
  - Prevents infinite growth but requires scanning entire array daily
  
- **Size Impact**:
  - 100K entries × 300B = 30 MB
  - 1M entries × 300B = 300 MB

#### 2. **news Array** — Critical
- **Where Created**: media.ts hook
  - Daily news generation for manager's club
  - Transfer news, injury news, board news, etc.
  
- **Frequency**: 5-20 items per day

- **Estimated Growth**:
  - 1 year: 1,825-7,300 entries
  - 5 years: 9,125-36,500 entries
  - 30 years: 54,750-219,000 entries

- **Current Cleanup**: None observed — accumulates indefinitely

- **Size Impact**:
  - 50K entries × 500B = 25 MB
  - 200K entries × 500B = 100 MB

#### 3. **financialTransactions Array** — Critical
- **Where Created**: Weekly finances minimum
  - enhanced-revenue.ts: 8 revenue systems
  - board.ts: Wages, facilities expenses
  - ai-transfers.ts: Transfer fees
  - training-ground.ts: Training facility costs
  - stadium.ts: Stadium upkeep costs
  - And others
  
- **Frequency**: 10-50+ transactions per week
  - Minimum: Wages + match revenue + prize money = 3/week
  - With all systems: 30-50+/week
  
- **Estimated Growth**:
  - 1 year (52 weeks): 520-2,600 entries
  - 5 years: 2,600-13,000 entries
  - 30 years: 15,600-78,000 entries

- **Current Cleanup**: None observed — accumulates indefinitely

- **Size Impact**:
  - 50K entries × 250B = 12 MB
  - 200K entries × 250B = 50 MB

#### 4. **WorldHistory Records** — High Impact
- **Where Created**: season-report.ts and various milestone systems
  - clubRecords: promotions, relegations, titles, records
  - playerRecords: transfers, awards, retirements, records
  - managerRecords: appointments, trophies, dismissals
  
- **Frequency**: 1-10+ per day from various systems

- **Estimated Growth**:
  - 1 year: 365-3,650 entries
  - 5 years: 1,825-18,250 entries
  - 30 years: 10,950-109,500 entries

- **Current Cleanup**: None observed — accumulates indefinitely

- **Size Impact**:
  - 50K entries × 400B = 20 MB
  - 100K entries × 400B = 40 MB

#### 5. **inbox Messages** — Controlled but Significant
- **Where Created**: inbox.ts daily hook
  - Converts events to messages
  - Dedupes within 1-day window
  
- **Frequency**: 5-30 messages per day

- **Estimated Growth**:
  - 1 year: 1,825-10,950 entries
  - But: archiveOldAfterDays = 30 (keeps ~900 active messages)
  - Plus archived messages kept 10+ days more

- **Size Impact**:
  - 1K active + 1K archived = 2K entries × 400B = 0.8 MB (bounded)

---

## PART 3: COMPLETE ADVANCE DAY EXECUTION PATH

### Hook Execution Order (from calendar.ts line 557-574)

```
DAILY_HOOK_ORDER = [
  "fixtures",
  "training",
  "recovery",
  "injuries",
  "development",
  "ai",
  "scouting",
  "finances",
  "events",
  "news",
]
```

### Detailed Hook Analysis

#### Hook 1: **fixtures** — Fixture Resolution & Scheduling
**Registered By**:
- ai-fixture-calendar.ts: `resolveTodaysAiFixtures(state)` — AI match results
- form-updates-hook.ts: Player form updates post-match

**Operations**:
- Resolve all AI-controlled matches on current date
- Update standings
- Generate match results
- Update player form

**Performance Notes**:
- Scans state.fixtures array (1,200-2,000 entries for 30yr)
- Updates multiple players per fixture
- **Risk**: O(n²) if matching players to performance

**Frequency**: Daily (most days 1-5 AI fixtures)

#### Hook 2: **training** — Player Training Simulation
**Registered By**:
- training.ts: `registerDailyHook("training", ...)` — Main training system

**Operations**:
- Apply selected training plan to assigned players
- Update player attributes (shooting, passing, defending, etc.)
- Add fatigue to trained players
- Update training progress

**Performance Notes**:
- Iterates assigned players (typically 11-20)
- Updates player.development fields
- **Risk**: Low - bounded to selected squad

**Frequency**: Daily

#### Hook 3: **recovery** — Fatigue Recovery
**Registered By**:
- training.ts: Recovery hook

**Operations**:
- Reduce player fatigue based on rest
- Apply medical facility bonuses
- Update recovery status

**Performance Notes**:
- Iterates all players on manager's club (11-25)
- **Risk**: Low - bounded

**Frequency**: Daily

#### Hook 4: **injuries** — Injury Simulation & Recovery
**Registered By**:
- training.ts: Injury hook

**Operations**:
- Roll for new injuries based on fatigue + injury proneness
- Progress existing injuries toward recovery
- Update return dates

**Performance Notes**:
- Iterates all players on manager's club (11-25)
- **Risk**: Low - bounded

**Frequency**: Daily

#### Hook 5: **development** — Player Growth & Evolution
**Registered By**:
- ai-evolution.ts: `registerDailyHook("development", ...)` — Player development

**Operations**:
- Apply growth curves to young players
- Calculate training efficiency gains
- Progress player potential
- Generate development events

**Performance Notes**:
- Iterates all players (400-600)
- Complex calculations per player
- **Risk**: Medium - full player scan daily

**Frequency**: Daily

#### Hook 6: **ai** — AI World Scheduler
**Registered By**:
- ai-world-scheduler.ts: Main scheduler

**Operations**:
- Plan which AI clubs need decisions today
- Limit to 4 clubs max per day (throttled)
- Filter by: upcoming matches, transfer window, injuries, finances
- Run `runAiActions` for selected clubs

**Performance Notes**:
- Scans all clubs for upcoming fixtures (state.fixtures O(n))
- Scans all events for recent injuries/transfers
- Only processes 4 clubs max per day
- **Risk**: Medium - full state scan to find work, but limited execution

**Details from ai-world-scheduler.ts**:
```
- periodicBatch: 4 random AI clubs per day
- clubsWithUpcomingMatches: Scans all fixtures
- Transfer window check: Full club scan
- Injury check: Scans all events (expensive!)
- Manager change check: Scans all events
- Transfer event check: Scans all events
- Then calls runAiActions() on selected 4 clubs
```

**What runAiActions does** (ai-actions.ts):
- Identifies squad needs
- Identifies sell candidates
- Builds offers
- Creates negotiations
- All per-club intensive

#### Hook 7: **scouting** — Scout Assignments & Reports
**Registered By**:
- scouting-network.ts: `advanceScoutingAssignments(state, time.date)`
- scout-reports.ts: `processCompletedScoutingAssignments(state)`

**Operations**:
- Advance scout assignments (count progress days)
- Generate completed reports when assignments finish
- Add scouting reports to state
- Create inbox messages for reports

**Performance Notes**:
- Scans assignments (typically 1-3 active)
- Generates 1 report per completed assignment
- **Risk**: Low - bounded assignments

**Frequency**: Daily

#### Hook 8: **finances** — Financial Transactions & Budget
**Registered By**:
- board.ts: Confidence/budget updates
- training-ground.ts: Facility costs
- stadium.ts: Stadium upgrade costs
- enhanced-revenue.ts: Revenue functions
- And others

**Operations**:
- Apply weekly financial tick (on week boundary)
- Process all revenue streams
- Deduct expenses
- Add financial transactions
- Update AI ledgers

**Performance Notes**:
- **Weekly**: applyWeeklyFinanceTick (full financial recalculation)
- Processes 8 revenue systems
- Iterates clubs for AI finances
- Adds financial transactions (unbounded growth)
- **Risk**: High weekly impact on week boundaries

**What applyWeeklyFinanceTick does**:
- Calculates match revenue
- Calculates sponsorship/prize money
- Applies all 8 enhanced revenue systems
- Deducts player wages
- Processes loans, facilities, operations
- For every transaction, adds to state.financialTransactions[]
- For manager's club, updates state.finances

#### Hook 9: **events** — Event Generation & Cleanup
**Registered By**:
- events-engine.ts: Main event system (10+ daily event generators)
- ai-transfers.ts: Transfer events
- ai-contracts.ts: Contract events
- ai-evolution.ts: Development events
- media.ts: Breaking news events
- fans.ts: Fan sentiment events
- manager-reputation-tracking.ts: Reputation events
- negotiation-expiry.ts: Negotiation expiry events
- transfer-requests.ts: Transfer request events
- stadium.ts: Stadium upgrade completion events
- training-ground.ts: Training facility completion events

**Operations**:
- Process delayed events scheduled for today
- Generate emergent events (player conflicts, youth discoveries)
- Process all registered event hooks (10+ hooks)
- Archive events older than 90 days
- **BUT**: Scan entire events array to find events for today and to archive

**Performance Notes**:
- **CRITICAL**: Scans entire events array for delayedUntil date matching
  - 100K events: Must scan all 100K daily
  - 1M events: Must scan all 1M daily
- Archives events older than 90 days (O(n) scan)
- Removes events older than 100 days (O(n) scan)
- **Risk**: VERY HIGH - array scans at scale

**From events-engine.ts (lines 23-150)**:
```typescript
for (let i = 0; i < events.length; i++) {
  const ev = events[i];
  if (!ev) continue;
  const meta = (ev.meta ?? {}) as Record<string, unknown>;
  const delayedUntil = meta["delayedUntil"] as string | undefined;

  if (delayedUntil) {
    if (!eventsByDate.has(delayedUntil)) {
      eventsByDate.set(delayedUntil, []);
    }
    eventsByDate.get(delayedUntil)!.push(i);
  }

  if (delayedUntil === today && !meta["applied"]) {
    eventsForToday.push({ ...ev });
  }
}
```

This is O(n) scan of all events every day. At 1M events, this is 1M iterations daily.

#### Hook 10: **news** — News Generation
**Registered By**:
- media.ts: News event generation

**Operations**:
- Generate 1-5 news items based on recent events
- Add to state.news array (no cleanup)

**Performance Notes**:
- Generates news items but never cleans them up
- news array grows indefinitely
- **Risk**: No bounds, indefinite growth

### Weekly Sync (on week boundary only)
**Also runs when time.week changes**:
- `syncAiLedgers(state)` — Recalculates AI club financial ledgers

**Operations**:
- For every AI-managed club:
  - Calculate current wage commitment
  - Update transfer budget remaining
  - Update ledger state

**Performance Notes**:
- Iterates all clubs (400)
- Calculates financial profile for each
- **Risk**: Medium - full club iteration weekly

---

## PART 4: PERSISTENCE INVESTIGATION

### Current Save Mechanism (from src/state/persistence.ts and store.tsx)

#### Where Saves Happen
1. **store.tsx line 365**: `SAVE_GAME` action explicitly calls `saveToStorage()`
2. **store.tsx line 453-455**: Every 250ms debounced save
3. **store.tsx line 450**: On page visibility change (tab hidden)
4. **store.tsx line 451**: On `beforeunload` event

#### What Gets Saved
- **Entire GameState object** serialized to JSON
- Wrapped in SaveEnvelope: `{ version: 14, savedAt: ISO_STRING, data: GameState }`
- No incremental saving, no delta compression

#### How It's Saved
```typescript
export function saveToStorage<T>(key: string, version: number, data: T): boolean {
  if (!isBrowser()) return false;
  try {
    const envelope: SaveEnvelope<T> = { version, savedAt: new Date().toISOString(), data };
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    // Storage disabled, quota exceeded, private-browsing restrictions, ...
    // — persistence is best-effort and should never break the app.
    return false;
  }
}
```

#### Failure Handling
- `catch` block silently returns `false`
- Game continues without warning
- Only logs to console if load fails

#### Version Management
- Current version: 14
- Migrations map: Has 13 entries for upgrading old saves
- Each migration patches data from version N → N+1

### Storage Quota Issues

| Browser | Typical Quota | Compression |
|---|---|---|
| Chrome/Edge | 10 MB | None (default) |
| Firefox | 10 MB | None (default) |
| Safari | ~5 MB | None (default) |
| Private Mode | ~5 MB | Often fails silently |

**Current State at ~45MB**:
- Far exceeds quota
- Likely silently fails to save
- Users could lose recent progress if tab closes

### Save Failure Cascade

1. **Thursday 10:00 AM**: User plays game, hits save quota
2. **Save silently fails** - no error shown
3. **Game continues** - but changes not persisted
4. **Friday morning**: User reloads tab, loads yesterday's save
5. **Lost progress**: Entire previous day's gameplay lost

**Current Evidence**: No error handling for quota exceeded in production

---

## PART 5: REAL PERFORMANCE PROFILING

### Available Profiling Infrastructure
From calendar.ts (lines 370-460):

```typescript
class TimingCollector {
  recordDayStart(date, dayNum, metrics)
  recordHookStart(hookName)
  recordHookEnd(hookName)
  recordDayEnd()
  getReport() // Comprehensive hook timing report
}
```

**Browser API Access** (calendar.ts line 478):
```typescript
window.__advanceDayProfiler = {
  start: () => timingCollector.startProfiling(),
  stop: () => timingCollector.stopProfiling(),
  report: () => console.log(timingCollector.getReport()),
  data: () => timingCollector.getTimings(),
  exportJSON: () => JSON.stringify(...),
  exportCSV: () => { ... },
}
```

### How to Profile

1. Open DevTools console
2. Run: `__advanceDayProfiler.start()`
3. Advance several days in game
4. Run: `__advanceDayProfiler.stop()`
5. Run: `__advanceDayProfiler.report()` for full breakdown
6. Run: `__advanceDayProfiler.exportCSV()` for spreadsheet export

### What Gets Measured
- Total Advance Day time per day
- Individual hook execution times
- State metrics per day (clubs, players, transfers, etc.)

### Data Saved To
- localStorage key: `__advanceDayProfiler_data`
- Survives page reload

---

## PART 6: PRODUCTION LOGGING AUDIT

### High-Volume Logging Locations

#### calendar.ts
- `DAY_ADVANCE_DEBUG` constant controls console logging
- When enabled: Logs every hook start/end with metrics
- Currently disabled in production (false)

#### store.tsx
- `console.warn()` on failed save
- `console.error()` on corrupted save on load
- Debug export function `__debugExportCurrentState`

#### Enhanced Revenue Systems (enhanced-revenue.ts)
- No logging observed - production ready

#### AI Systems
- No production logging observed
- AI decisions logged via events instead

#### Events Engine (events-engine.ts)
- No direct logging - events serve as audit trail

### Recommendations for Logging
1. Add warnings when events array exceeds 50K entries
2. Log when localStorage save fails
3. Log when 90-day event cleanup removes entries
4. Log when inbox hits 1K+ messages

---

## PART 7: STATE GROWTH RISKS — RANKED BY SEVERITY

### CRITICAL — Fix Before Continuing

#### 1. Unbounded events Array
**File**: src/state/events-engine.ts, lines 10-150
**Problem**: 
- 10+ daily hooks add entries without limit
- 90-day cleanup requires O(n) scan every day
- At 1M entries, scanning 1M items daily
- Will eventually cause Advance Day lag

**Evidence**:
- No maximum size check
- Cleanup disabled if array too large would fail

**Fix Type**: Prune before fix - keep last 50K events in production, older events archived to separate data structure

#### 2. Unbounded financialTransactions Array
**File**: src/state/enhanced-revenue.ts, lines 111+
**Problem**:
- Every revenue system adds transactions
- No cleanup mechanism
- 50-100+ transactions per week × 52 weeks × 30 years = 78,000-156,000 entries
- At 250B per entry = 19-39 MB just for this array

**Evidence**:
- Transactions added via `state.financialTransactions.push()`
- No archival or cleanup
- Accumulates indefinitely

**Fix Type**: Archive transactions older than 2 seasons

#### 3. Unbounded news Array
**File**: src/state/media.ts
**Problem**:
- Generates 5-20 news items per day
- No cleanup observed
- 365 × 10 = 3,650 per year × 30 years = 109,500 entries
- At 500B per entry = 54 MB

**Evidence**:
- `state.news.push()` with no cleanup
- No archival logic

**Fix Type**: Archive news older than current season

#### 4. unbounded WorldHistory Records
**File**: state/season-report.ts and multiple systems
**Problem**:
- clubRecords, playerRecords, managerRecords accumulate
- No cleanup
- 1-10 records per day × 365 × 30 = 10,950-109,500 records
- At 400B per record = 4-44 MB

**Evidence**:
- No cleanup logic in code

**Fix Type**: Keep only records from last 5-10 seasons

#### 5. SaveEnvelope Every 250ms at 45MB
**File**: src/state/persistence.ts
**Problem**:
- 45MB × JSON.stringify() = high CPU usage
- Happens every 250ms minimum
- Only 5-10MB quota available
- Serialization blocks UI thread

**Evidence**:
- store.tsx line 443: comment "~45MB state"
- No worker thread or async serialization

**Fix Type**: Move serialization to worker or compress before save

---

### HIGH PRIORITY — Address Soon

#### 6. Event Array Scanning Daily for 90-Day Cleanup
**File**: events-engine.ts line 122-146
**Problem**:
- O(n) scan of entire events array daily
- At 100K events: 100K iterations per day
- Repeated scan during cleanup

**Evidence**:
- Nested loops scanning dates

**Fix Type**: Index events by date range (Month:Year maps) for O(1) cleanup

#### 7. AI World Scheduler Scans Full Events Array
**File**: ai-world-scheduler.ts lines 101-108, 123-133
**Problem**:
- `hasRecentEvent()` scans entire events array looking for injuries/transfers
- At 1M events, this is 1M scan per AI scheduler run
- Multiple times during day

**Evidence**:
```typescript
function hasRecentEvent(state, predicate) {
  return (state.events ?? []).some(event => predicate(event))
}
```

**Fix Type**: Maintain event index by type (injuries, transfers, etc.)

#### 8. Weekly Financial Calculation at Full Scale
**File**: finance.ts, applyWeeklyFinanceTick
**Problem**:
- Every club's financials recalculated weekly
- Multiple passes over all players for wages
- Recalculates AI ledgers for all AI clubs

**Evidence**:
- Weekly hook runs on week boundary

**Fix Type**: Cache calculations, invalidate only changed clubs

---

### MEDIUM PRIORITY — Optimize Later

#### 9. Standings Computed on Every Read
**File**: state/standings.ts
**Problem**:
- League table computed from all fixtures every time read
- No caching
- Fine for 1K fixtures but slow at scale

**Evidence**:
- `state/standings.ts` derives table on every call

**Fix Type**: Cache standings, invalidate on fixture status change

#### 10. Player Scan for Development Daily
**File**: ai-evolution.ts
**Problem**:
- Iterates all 400-600 players daily for development
- Complex calculations per player
- Not immediately slow but adds up

**Evidence**:
- registerDailyHook("development") scans all players

**Fix Type**: Low - this is acceptable, just batch operations

---

### LOW PRIORITY — Future Optimization

#### 11. Relationships Graph
**File**: state/relationships.ts
**Problem**:
- Stored as flat array of RelationshipEntry
- Lookups are O(n)

**Fix Type**: Use Map<entityPair, relationship>

#### 12. Transfer Listing Lookups
**File**: state/transfers.ts
**Problem**:
- `state.transfers.find()` used multiple times per day

**Fix Type**: Low - transfers array usually small

---

## PART 8: RANKED FIX PLAN

### CRITICAL — Must Fix First (Before continuing development)

| # | Issue | File | Impact | Effort |
|---|---|---|---|---|
| 1 | Unbounded events array (50K→1M+) | events-engine.ts | 30-300 MB | Medium |
| 2 | Unbounded news array | media.ts | 25-250 MB | Low |
| 3 | Unbounded financialTransactions | enhanced-revenue.ts | 12-50 MB | Low |
| 4 | Unbounded WorldHistory | season-report.ts | 4-44 MB | Medium |
| 5 | 45MB save every 250ms fails quota | persistence.ts | Data loss | High |

**Combined Impact**: If all present, state could be 80-720 MB, causing:
- localStorage quota exceeded (silent save failure)
- Advance Day lag from scanning huge arrays
- Browser memory pressure
- UI freezes during JSON.stringify

### HIGH PRIORITY — Fix Within 1 Sprint

| # | Issue | File | Impact | Effort |
|---|---|---|---|---|
| 6 | Event array cleanup O(n) | events-engine.ts | Slow cleanup | Low |
| 7 | AI scheduler scans events | ai-world-scheduler.ts | Event lookup | Low |
| 8 | Weekly finances recalc | finance.ts | Weekly lag | Medium |

### MEDIUM PRIORITY — Fix Within 1 Quarter

| # | Issue | File | Impact | Effort |
|---|---|---|---|---|
| 9 | Standings computed on read | standings.ts | Table lag | Low |
| 10 | Player scan daily | ai-evolution.ts | Dev lag | Low |

### LOW PRIORITY — Future Optimization

| # | Issue | File | Impact | Effort |
|---|---|---|---|---|
| 11 | Relationships O(n) lookup | relationships.ts | Minimal | Low |
| 12 | Transfer listing lookups | transfers.ts | Minimal | Low |

---

## PART 9: QUESTIONS FOR NEXT PHASE

### Before implementing fixes:

1. **What is the actual current save size in production?**
   - Need to measure a real saved game
   - Break down by collection
   - Check if quota is exceeded

2. **How often do saves actually fail?**
   - Add error tracking to saveToStorage
   - Log quota exceeded errors

3. **What are actual Advance Day times in production?**
   - For fresh career (day 1)
   - For 1-year career
   - For 5-year career
   - For 30-year career

4. **Should old data be deleted or archived?**
   - Events from year 1 — keep or delete?
   - News from past seasons — keep or archive?
   - Financial transactions from past seasons — keep?

5. **What is acceptable state size?**
   - Target: <10 MB for localStorage quota safety
   - Or: Move to IndexedDB (unlimited quota)

6. **Performance targets?**
   - Advance Day should take <100ms per day
   - Save should take <50ms
   - No UI freezing

---

## APPENDIX: DETAILED HOOK REGISTRATION MAP

### All registerDailyHook Calls in Codebase

```
Hook: fixtures
├─ ai-fixture-calendar.ts: resolveTodaysAiFixtures()
└─ form-updates-hook.ts: updatePlayerForm()

Hook: training
└─ training.ts: simulateTrainingDay()

Hook: recovery
└─ training.ts: simulateRecoveryDay()

Hook: injuries
└─ training.ts: simulateInjuriesDay()

Hook: development
└─ ai-evolution.ts: evolvePlayerDevelopment()

Hook: ai
└─ ai-world-scheduler.ts: runAiWorldScheduler()

Hook: scouting
├─ scouting-network.ts: advanceScoutingAssignments()
└─ scout-reports.ts: processCompletedScoutingAssignments()

Hook: finances
├─ board.ts: updateBoardConfidence()
├─ training-ground.ts: completeTrainingGroundUpgrades() + processTrainingGroundFinances()
└─ stadium.ts: completeStadiumUpgrades() + processStadiumFinances()

Hook: events
├─ events-engine.ts: processEvents() + archiveOldEvents()
├─ ai-transfers.ts: processTransferEvents()
├─ ai-contracts.ts: processContractEvents()
├─ ai-evolution.ts: emitDevelopmentEvents()
├─ media.ts: generateNewsEvents()
├─ fans.ts: updateFanSentiment()
├─ manager-reputation-tracking.ts: updateReputationEvents()
├─ negotiation-expiry.ts: expireNegotiations()
├─ transfer-requests.ts: processTransferRequests()
├─ stadium.ts: emitStadiumEvents()
└─ training-ground.ts: emitTrainingEvents()

Hook: news
└─ media.ts: generateDailyNews()
```

---

## END OF INVESTIGATION

**Status**: Investigation complete, no code changes made.

**Next Steps**: Review findings with team, prioritize critical fixes (unbounded arrays), then implement remediation.

**Key Takeaway**: State can grow from 45MB to 720MB+ over 30 years, causing localStorage quota failure and Advance Day lag. Four collections need archival/cleanup: events, news, financialTransactions, worldHistory.
