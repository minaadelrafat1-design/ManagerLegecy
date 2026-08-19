# PRODUCTION LOGGING AUDIT

**Investigation Date**: 2026-08-20  
**Scope**: calendar, Advance Day, AI transfers, daily hooks, persistence, season processing, match simulation  
**Status**: AUDIT ONLY — NO CHANGES

---

## LOGGING CLASSIFICATION

### 1. SAFE PRODUCTION LOGGING

#### store.tsx (Persistence)
**Location**: src/state/store.tsx

```typescript
// Line 383-390: Load failure warnings
if (result.status === "corrupted") {
  console.warn(
    `[GameState] saved game could not be loaded (${result.reason}) — starting a fresh save.`,
  );
  clearStorage(STORAGE_KEY);
}

// Assessment: ✓ SAFE
// - Only logs on actual load failures (rare)
// - Informative for debugging corrupted saves
// - Does not spam console
```

**Recommendation**: Keep as-is, but ADD logging for:
- Save quota exceeded (currently silent failure)
- Save takes > 500ms
- State size exceeds 50MB threshold

#### persistence.ts (Save Mechanism)
**Location**: src/state/persistence.ts

```typescript
// Lines 51-75: saveToStorage() function
export function saveToStorage<T>(key: string, version: number, data: T): boolean {
  if (!isBrowser()) return false;
  try {
    const envelope: SaveEnvelope<T> = { version, savedAt: new Date().toISOString(), data };
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch {
    // Storage disabled, quota exceeded, private-browsing restrictions, ...
    // — persistence is best-effort and should never break the app.
    return false;  // ← SILENT FAILURE
  }
}

// Assessment: ⚠ PROBLEMATIC
// - Silent failure when quota exceeded
// - User has no indication save failed
// - Data loss consequence but no error logging
```

**Recommendation**: Log when save fails:
```typescript
catch (err) {
  console.warn(`[GameState] save failed: ${String(err)}`);
  return false;
}
```

---

### 2. DEVELOPMENT-ONLY DIAGNOSTICS

#### calendar.ts (Advance Day Profiling)
**Location**: src/state/calendar.ts, lines 370-480

```typescript
const DAY_ADVANCE_DEBUG = false;  // ← CONTROL FLAG

function debugAdvanceDay(...args: unknown[]) {
  if (DAY_ADVANCE_DEBUG) {
    console.log(...args);
  }
}

// When enabled, logs every hook execution:
// [ADVANCE_DAY] [DATE] 2026-01-01 [START] advanceGameStateOneDay day=1
// [ADVANCE_DAY] [DATE] 2026-01-01 [START] hook-group:fixtures hooks=2
// [ADVANCE_DAY] [DATE] 2026-01-01 [END] hook-group:fixtures elapsedMs=12.34
```

**Assessment**: ✓ SAFE
- Only logs when `DAY_ADVANCE_DEBUG = true` (disabled in production)
- Provides detailed timing data
- Can be enabled via flag for debugging

**Recommendation**: Keep as-is, add export for programmatic access:
```typescript
export function enableAdvanceDayDebug() { DAY_ADVANCE_DEBUG = true; }
export function disableAdvanceDayDebug() { DAY_ADVANCE_DEBUG = false; }
```

#### calendar.ts (Performance Timing Collection)
**Location**: src/state/calendar.ts, lines 413-480

```typescript
class TimingCollector {
  recordDayStart(date, dayNum, metrics)
  recordHookStart(hookName)
  recordHookEnd(hookName)
  recordDayEnd()
  getReport() // Generates comprehensive report
}

// Exported to window for browser access
window.__advanceDayProfiler = {
  start: () => timingCollector.startProfiling(),
  stop: () => timingCollector.stopProfiling(),
  report: () => console.log(timingCollector.getReport()),
  data: () => timingCollector.getTimings(),
  exportJSON: () => JSON.stringify(...),
  exportCSV: () => { ... },
}
```

**Assessment**: ✓ SAFE
- Disabled by default (only runs if explicitly started)
- Data saved to localStorage (not console spam)
- Accessible from DevTools console for profiling
- Does not affect gameplay

**Recommendation**: Keep as-is, document in dev wiki

---

### 3. POTENTIAL PERFORMANCE PROBLEMS

#### events-engine.ts (Event Array Scanning)
**Location**: src/state/events-engine.ts, lines 22-150

**No logging observed**, but analysis shows:

```typescript
// Line 23-30: Every day scans entire events array
for (let i = 0; i < events.length; i++) {
  const ev = events[i];
  if (!ev) continue;
  // ... check delayedUntil date
}

// Line 122-146: Cleanup scans entire array again
// At 1M events = 1M iterations daily with no logging
```

**Assessment**: 🔴 PROBLEM AREA
- No performance logging exists
- Scan is O(n) but no warning if array is large
- At 1M events, this silently takes 100+ ms

**Recommendation**: Add debug logging:
```typescript
if (events.length > 50000) {
  console.warn(`[Events] Large events array (${events.length} entries), cleanup may be slow`);
}
```

#### ai-world-scheduler.ts (Event Lookup)
**Location**: src/state/ai-world-scheduler.ts, lines 51-57, 101-108

```typescript
// Line 51-57: hasRecentEvent scans all events looking for injury/transfer
function hasRecentEvent(state, predicate) {
  return (state.events ?? []).some(event => predicate(event));
}

// Line 101-108: Called 5+ times during planning
if (hasRecentEvent(state, (event) => event.type === "injury" || event.meta?.["injury"])) {
  for (const event of state.events ?? []) {
    if (!event.meta?.["playerId"]) continue;
    const player = state.players[String(event.meta["playerId"])];
    if (player?.clubId) addReason(player.clubId, "injury-crisis");
  }
}

// Then scans again for transfer events, manager changes, etc.
```

**Assessment**: 🟡 MEDIUM RISK
- Multiple scans of events array during AI planning
- At 1M events: multiple 1M-iteration scans
- No logging of scan count or time

**Recommendation**: Add timing:
```typescript
function hasRecentEvent(state, predicate) {
  const start = performance.now();
  const result = (state.events ?? []).some(event => predicate(event));
  const elapsed = performance.now() - start;
  if (elapsed > 50) {
    console.warn(`[AI] hasRecentEvent scan took ${elapsed.toFixed(0)}ms (${state.events?.length} events)`);
  }
  return result;
}
```

#### finance.ts / enhanced-revenue.ts (Weekly Recalculation)
**Location**: src/state/finance.ts + src/state/enhanced-revenue.ts

**No logging observed** for weekly finance tick.

**Assessment**: 🟡 MEDIUM RISK
- Runs every week (52 times/year, 1,560 times/30 years)
- Full revenue recalculation for all clubs
- No performance logging

**Recommendation**: Add timing:
```typescript
export function applyWeeklyFinanceTick(state: GameState): GameState {
  const startTime = performance.now();
  let next = state;
  
  // ... calculations ...
  
  const elapsed = performance.now() - startTime;
  if (elapsed > 100) {
    console.warn(`[Finance] Weekly tick took ${elapsed.toFixed(0)}ms`);
  }
  return next;
}
```

---

## LOGGING INVENTORY

### By Category: Development-Only

| File | Feature | Severity | Status |
|---|---|---|---|
| calendar.ts | advanceDay debug logging | LOW | ✓ Controlled by flag |
| calendar.ts | Performance profiling API | LOW | ✓ Opt-in via __advanceDayProfiler |

### By Category: Production Safe

| File | Feature | Severity | Status |
|---|---|---|---|
| store.tsx | Load failure warning | SAFE | ✓ Logs on corruption |
| persistence.ts | Save quota failure | **NEEDS FIX** | ⚠ Currently silent |

### By Category: Potential Problems

| File | Feature | Severity | Status |
|---|---|---|---|
| events-engine.ts | Event array cleanup | 🔴 HIGH | ✗ No logging, O(n) scan |
| ai-world-scheduler.ts | Event lookups | 🟡 MEDIUM | ✗ No timing |
| finance.ts | Weekly calculations | 🟡 MEDIUM | ✗ No timing |
| training.ts | Player updates | 🟡 MEDIUM | ✗ No timing |
| ai-evolution.ts | Development calc | 🟡 MEDIUM | ✗ No timing |

---

## RECOMMENDED LOGGING ADDITIONS

### Priority 1: Add Error Tracking

```typescript
// persistence.ts - Track save failures
export function saveToStorage<T>(key: string, version: number, data: T): boolean {
  if (!isBrowser()) return false;
  try {
    const envelope: SaveEnvelope<T> = { version, savedAt: new Date().toISOString(), data };
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch (err) {
    // ← NEW: Log the error
    const errStr = String(err);
    if (errStr.includes("QuotaExceededError")) {
      console.warn("[GameState] ⚠ CRITICAL: localStorage quota exceeded! Saves are failing. Please clear old data.");
    } else {
      console.warn(`[GameState] Save failed: ${errStr}`);
    }
    return false;
  }
}
```

### Priority 2: Add Performance Warnings

```typescript
// calendar.ts - Warn if state is getting large
function countStateMetrics(state: GameState) {
  const counts = { /* ... */ };
  
  // ← NEW: Warn if arrays are too large
  if ((state.events ?? []).length > 50000) {
    console.warn(
      `[Advance Day] Warning: events array has ${state.events.length} entries. ` +
      `Cleanup may be slow. Consider archival.`
    );
  }
  if ((state.financialTransactions ?? []).length > 50000) {
    console.warn(
      `[Advance Day] Warning: financialTransactions array has ${state.financialTransactions.length} entries. ` +
      `Consider archival.`
    );
  }
  
  return counts;
}

// finance.ts - Warn if weekly calculation is slow
export function applyWeeklyFinanceTick(state: GameState): GameState {
  const start = performance.now();
  let next = state;
  // ... calculations ...
  const elapsed = performance.now() - start;
  
  // ← NEW: Warn if slow
  if (elapsed > 100) {
    console.warn(
      `[Finance] Weekly calculation took ${elapsed.toFixed(0)}ms. ` +
      `State size or club count may be too large.`
    );
  }
  
  return next;
}
```

### Priority 3: Add Diagnostic Logging

```typescript
// events-engine.ts - Log cleanup actions
if (events.length > 50000) {
  const before = events.length;
  // ... cleanup logic ...
  const after = events.length;
  console.debug(
    `[Events] Cleanup removed ${before - after} events ` +
    `(${after} remaining, size approx ${(after * 300 / 1024 / 1024).toFixed(1)}MB)`
  );
}

// ai-world-scheduler.ts - Log planning decisions
console.debug(
  `[AI] Planning: periodic=${periodicDue}, ` +
  `upcomingMatches=${clubsWithUpcomingMatches(state).size}, ` +
  `financialCrisis=${financialProblemClubs}, ` +
  `injuries=${injuryClubs}`
);
```

---

## LOGGING STATEMENT SUMMARY

### Current Logging in Production Code

**Counts**:
- Intentional warnings: 1 (store.tsx on load corruption)
- Silent failures: 1 (persistence.ts on save failure)
- Development-only: 2 (calendar.ts debug + profiling)
- Missing performance logging: 5+ hooks

**Assessment**: Logging is MINIMAL and INCOMPLETE

**Risk Level**: 🔴 HIGH
- Silent save failures hide data loss
- No performance monitoring
- Large state growth goes unnoticed

---

## DETAILED RECOMMENDATIONS

### Immediate (This Week)

1. **Add error logging to saveToStorage()**
   - Log when quota exceeded
   - Log any other exceptions
   - Effort: 15 minutes

2. **Add state size warnings to advanceGameDays()**
   - Warn if events > 50K
   - Warn if transactions > 50K
   - Effort: 30 minutes

### Short Term (This Sprint)

3. **Add performance timing to critical hooks**
   - applyWeeklyFinanceTick (weekly)
   - events cleanup (daily)
   - ai-world-scheduler (daily)
   - Effort: 2 hours

4. **Add diagnostic logging for debugging**
   - AI planning decisions
   - Event cleanup results
   - Finance recalculation details
   - Effort: 2 hours

### Medium Term (Next Quarter)

5. **Add performance dashboard**
   - Graph Advance Day times over 30 days
   - Track state size growth
   - Accessible via DevTools API
   - Effort: 8 hours

---

## SENSITIVE DATA CONSIDERATIONS

### What Should NEVER Be Logged

- Player personal data (names, ages, salaries) — can leak privacy
- Manager decisions (transfer targets, tactics) — can spoil gameplay
- Full state snapshots — exceeds storage, contains sensitive data

### What CAN Be Logged Safely

- Array lengths (events count, not content)
- Execution times (hook duration)
- Error messages (save failed, but not why)
- Aggregate statistics (average state size)

### Current Status

✓ Safe — No sensitive data is logged in current code
✓ Safe — Debug logging is disabled by default

---

## AUDIT CONCLUSION

**Status**: Logging is minimal but safe. Main gap is lack of error reporting for save failures.

**Critical Issue**: Silent save failure on quota exceeded must be fixed immediately.

**Performance Issue**: No monitoring of slow operations means user doesn't know when Advance Day is degrading.

**Recommendation**: Implement 5 logging additions (see above) to improve observability and prevent silent data loss.

---

## CHECKLIST FOR IMPLEMENTATION

- [ ] Add error logging to saveToStorage() for quota exceeded
- [ ] Add state size warning to advanceGameDays() when arrays exceed 50K
- [ ] Add performance timing to applyWeeklyFinanceTick()
- [ ] Add event cleanup logging to events-engine.ts
- [ ] Add AI planning logging to ai-world-scheduler.ts
- [ ] Test logging output doesn't spam console
- [ ] Document logging format in developer guide
- [ ] Add performance monitoring dashboard (future)
