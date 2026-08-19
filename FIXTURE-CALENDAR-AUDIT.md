# Fixture Calendar Audit — Root Cause Analysis

**Date**: 2025-01-24
**Status**: AUDIT COMPLETE — Root cause identified and documented
**Focus**: League fixture generation extending into September instead of ending by May

---

## Executive Summary

**ROOT CAUSE IDENTIFIED**: The fixture generation algorithm uses a fixed 7-day spacing between matchdays without adapting to realistic season windows (August 1 – May 31). This causes small leagues to complete their seasons in 2-4 months instead of spreading across the full 9-month window.

**Impact**: 
- 6-club Regional Third Division: Season runs August 15 – October 17 (only 10 matchdays, spans 63 days)
- 20-club Premier League: Season would run August 15 – May 27 (38 matchdays, spans 286 days)
- Problem: September fixtures exist for small leagues; season windows are unrealistic

**Severity**: HIGH — Violates user requirement: "final league match should occur within May, not extend into June/July/September"

---

## Code Location

**File**: `src/state/season.ts`  
**Function**: `generateLeagueFixtures()` (Lines 33–127)  
**Problem Code**:

```typescript
const preseasonDays = 14;
const seasonStartDate = state.time.seasonStartDate;  // "2026-08-01"

for (let r = 0; r < rounds; r++) {
  // ... circle method pairings ...
  
  // PROBLEM: Fixed 7-day spacing with no window validation
  const calendarDate1 = addDaysISO(seasonStartDate, preseasonDays + r * 7);
  const calendarDate2 = addDaysISO(seasonStartDate, preseasonDays + (rounds + r) * 7);
}
```

---

## Detailed Analysis

### Current Algorithm

1. **Preseason offset**: 14 days (Aug 1 + 14 = Aug 15 for MD1)
2. **Matchday spacing**: Fixed 7 days between each matchday
3. **Formula for first leg**: `seasonStartDate + 14 + (round_index * 7)`
4. **Formula for second leg**: `seasonStartDate + 14 + ((rounds + round_index) * 7)`

### Example: 6-Club League (Regional Third Division)

**Matchday Calculations**:

| Matchday | Round Index | Formula | Calculation | Date | Month |
|----------|-------------|---------|------------|------|-------|
| MD1 (1st leg round 0) | 0 | 14 + 0×7 | Aug 1 + 14 | **Aug 15** | ✓ |
| MD2 (1st leg round 1) | 1 | 14 + 1×7 | Aug 1 + 21 | **Aug 22** | ✓ |
| MD3 (1st leg round 2) | 2 | 14 + 2×7 | Aug 1 + 28 | **Aug 29** | ✓ |
| MD4 (1st leg round 3) | 3 | 14 + 3×7 | Aug 1 + 35 | **Sep 05** | ✗ SEPTEMBER |
| MD5 (1st leg round 4) | 4 | 14 + 4×7 | Aug 1 + 42 | **Sep 12** | ✗ SEPTEMBER |
| MD6 (2nd leg round 0) | 0 | 14 + 5×7 | Aug 1 + 49 | **Sep 19** | ✗ SEPTEMBER |
| MD7 (2nd leg round 1) | 1 | 14 + 6×7 | Aug 1 + 56 | **Oct 03** | ✗ October |
| MD8 (2nd leg round 2) | 2 | 14 + 7×7 | Aug 1 + 63 | **Oct 10** | ✗ October |
| MD9 (2nd leg round 3) | 3 | 14 + 8×7 | Aug 1 + 70 | **Oct 17** | ✗ October |
| MD10 (2nd leg round 4) | 4 | 14 + 9×7 | Aug 1 + 77 | **Oct 24** | ✗ October |

**Season span**: August 15 – October 24 = 70 days = ~2.3 months (unrealistic — should be 9 months)

---

### Why This Is Wrong

**Realistic European Football Calendar**:
- **Target**: August 1 (season start) → May 31 (final matchday) = 273 days
- **Matchdays available**: ~40-42 weekends + occasional midweeks across 9 months
- **Expected matchday spacing**: 7-10 days (one week between fixtures, realistic for modern football)
- **Problem**: Current algorithm spaces ALL matchdays 7 days apart regardless of season window
  - For 6 clubs (10 matchdays): Completes in 10 weeks instead of 40+ weeks
  - For 20 clubs (38 matchdays): Completes in 38 weeks (correct by accident, but still 2026-08-15 to 2027-05-27, spanning calendar years)

---

### Related Issues

**File**: `src/state/cups.ts` (Lines 16–21)  
**Issue**: Hardcoded cup start after matchday 38

```typescript
function calculateCupFixtureDate(...) {
  const cupStartMatchday = 39 + roundIndex * 2 + fixtureIndex;  // Assumes 38 league matchdays
  const calendarDate = addDaysISO(state.time.seasonStartDate, preseasonDays + (cupStartMatchday - 1) * 7);
}
```

**Problem**: Assumes all leagues have exactly 38 matchdays. This fails for 6-club leagues (only 10 matchdays) or 30+ club leagues (40+ matchdays).

---

## Impact Assessment

| League | Clubs | Matchdays | Current Season Span | Realistic Span | Gap |
|--------|-------|-----------|---------------------|-----------------|-----|
| Regional 3rd Div | 6 | 10 | Aug 15 – Oct 24 (70 days) | Aug 1 – May 31 (273 days) | 203 days short |
| Championship | 18 | 34 | Aug 15 – Apr 17 (245 days) | Aug 1 – May 31 (273 days) | ~OK |
| Premier League | 20 | 38 | Aug 15 – May 27 (286 days) | Aug 1 – May 31 (273 days) | 13 days over |
| Large League | 30 | 58 | Aug 15 – Aug 24+1 (406 days) | Aug 1 – May 31 (273 days) | **BREAKS YEAR** |

**Conclusion**: Only 20-club leagues work by accident; smaller/larger leagues break the calendar window.

---

## Files Affected

### Direct Involvement
1. **`src/state/season.ts`** (Lines 33–127)
   - `generateLeagueFixtures()` — generates all league fixtures with broken spacing formula
   
2. **`src/state/cups.ts`** (Lines 16–21)
   - `calculateCupFixtureDate()` — assumes fixed league structure, hardcodes matchday 38 as cup start

### Indirect Dependencies
3. **`src/state/calendar.ts`**
   - `addDaysISO()` — performs date arithmetic (correct, no changes needed)
   - `getDayOfWeekLabel()` — formats display dates (correct, no changes needed)

4. **`src/state/reducer.ts`**
   - ADVANCE_DAY action checks fixtures (no changes needed)
   - RECORD_MATCH_RESULT checks season completion via `isSeasonComplete()` (no changes needed)

5. **`src/state/world.ts`**
   - `finalizeSeasonIfNeeded()` triggers season end (no changes needed — relies on fixtures)

### Test Files (Require Updates)
6. **`test-season-calendar-separation.test.ts`**
   - Tests currently validate sequential calendar progression
   - After fix, need to validate: fixtures fit in Aug 1 – May 31 window

---

## Solution Design

### New Algorithm: Adaptive Season-Window Spacing

**Inputs**:
- Season start date: `2026-08-01`
- Season end date: `2027-05-31`
- Number of clubs: `N`
- Matchdays needed: `2*(N-1)` (double round-robin)

**Calculation**:
1. Available calendar days: `daysBetweenISO("2026-08-01", "2027-05-31")` = 273 days
2. Preseason buffer: 14 days (Aug 1 – Aug 15 for preparation)
3. League fixture window: 273 - 14 = 259 days
4. Matchday spacing: `259 / 2*(N-1)` = average days between matchdays
5. Distribute matchdays using spacing, ensuring no fixture after May 31

**For 6 clubs**:
- Matchdays: 10
- Available: 259 days
- Spacing: 259 / 10 = 25.9 days between matchdays
- MD1: Aug 15
- MD2: Sep 10
- MD3: Oct 05
- MD4: Oct 31
- MD5: Nov 25
- MD6: Dec 21
- MD7: Jan 15
- MD8: Feb 10
- MD9: Mar 07
- MD10: Apr 02
- ✓ All fixtures fit within Aug 1 – May 31

**For 20 clubs**:
- Matchdays: 38
- Available: 259 days
- Spacing: 259 / 38 = 6.8 days between matchdays
- Season runs: Aug 15 – May 12 ✓ (before May 31)

---

## Implementation Plan

### Phase 1: Fix League Fixture Generation (season.ts)
- [ ] Replace hardcoded `preseasonDays + r * 7` formula
- [ ] Implement adaptive spacing based on season window
- [ ] Ensure last fixture is before May 31
- [ ] Add validation that no fixture exceeds season window

### Phase 2: Fix Cup Fixture Generation (cups.ts)
- [ ] Calculate dynamic cup start date (after last league fixture, not matchday 38)
- [ ] Ensure cup fixtures fit within June (season wrap-up)
- [ ] Validate cup finals before June 30

### Phase 3: Validation & Testing
- [ ] Create test scenarios: 6-club, 18-club, 20-club, 30-club leagues
- [ ] Verify all fixtures fit Aug 1 – May 31 window
- [ ] Check no overlapping matchdays for same club
- [ ] Ensure determinism (same seed = same output)

### Phase 4: Update Documentation
- [ ] Document new scheduling algorithm
- [ ] Update test expectations
- [ ] Provide season calendar examples in comments

---

## Next Steps

1. **Verify this audit** with user approval
2. **Implement Phase 1-2** fixtures generation fixes
3. **Run validation suite** (test-season-calendar-separation.test.ts + new tests)
4. **Document final calendar** showing realistic season progression
5. **Measure outcomes**: Verify final fixtures end by May 31 across all league sizes

---

## Appendix: Key Code References

### Current Broken Code (season.ts, Lines 70-85)
```typescript
for (let r = 0; r < rounds; r++) {
  const pairings: [string, string][] = [];
  // ... circle method ...
  
  for (const [home, away] of pairings) {
    const matchday1 = r + 1;
    const matchday2 = r + 1 + rounds;
    
    // PROBLEM: Fixed 7-day spacing
    const calendarDate1 = addDaysISO(seasonStartDate, preseasonDays + r * 7);
    const calendarDate2 = addDaysISO(seasonStartDate, preseasonDays + (rounds + r) * 7);
    
    // Create fixtures with these dates...
  }
}
```

### Calendar Constants (calendar.ts)
- `SEASON_START_DATE = "2026-08-01"` (hardcoded in seed.ts)
- `SEASON_END_DATE` should be `"2027-05-31"` (currently implicit)
- Transfer windows: June 1 – Sept 1 (summer), Jan 1 – Feb 1 (winter)

### Season Completion Check (season.ts, Lines 152-202)
```typescript
export function isSeasonComplete(state: GameState): boolean {
  // Checks if ALL fixtures played AND current date past latest fixture
  // Will work correctly once fixtures are generated with realistic dates
}
```

---

**Report Status**: ✅ COMPLETE — Ready for implementation
