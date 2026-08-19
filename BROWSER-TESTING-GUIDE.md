# BROWSER PERFORMANCE TESTING GUIDE

## Quick Start: Test Performance in Browser

### Step 1: Start Development Server
```bash
npm run dev
# Opens at http://localhost:8083/
```

### Step 2: Create a New Game or Load Existing
- Start a new career, or
- Load an existing persisted game from localStorage

### Step 3: Open Browser Console
- Press F12 to open Developer Tools
- Go to Console tab

### Step 4: Run Profiling Commands

```javascript
// Check if profiler is loaded
window.__advanceDayProfiler

// Start profiling
window.__advanceDayProfiler.start()

// (Play the game - advance days through UI)

// Advance 7 days using UI:
// Click "Advance Day" button 7 times
// OR use calendar navigation

// Stop profiling
window.__advanceDayProfiler.stop()

// View results
window.__advanceDayProfiler.report()

// Export data as JSON
const data = window.__advanceDayProfiler.exportJSON()
console.log(data)

// Copy and save to file
copy(data)
```

### Step 5: Interpret Results

**Good Performance Indicators**:
- Average time per day: < 2ms ✅
- Max time per day: < 5ms ✅
- No progressive slowdown over 7+ days ✅
- Consistent timing patterns ✅

**Red Flags**:
- Average time per day: > 10ms ⚠️
- Max time per day: > 50ms ⚠️
- Slowdown increases over multiple days ❌
- Spikes without explanation ❌

---

## Detailed Testing Scenarios

### Scenario 1: Fresh Career Performance
1. Create new game
2. Profile 7 consecutive days of advancement
3. Expected: 1-2ms average per day

### Scenario 2: With Active Transfers
1. Load game during transfer window
2. Profile 7 consecutive days
3. Expected: 1-3ms average per day

### Scenario 3: Mature Career Performance
1. Load a persisted game that's been played for multiple seasons
2. Profile 7 consecutive days  
3. Expected: 1-5ms average per day (may be higher due to accumulated state)

### Scenario 4: Calendar Accuracy
1. Note current date (e.g., 2026-11-14)
2. Advance 7 days through UI
3. Verify date is 2026-11-21 (exactly 7 days later)
4. Verify no calendar jumps (e.g., to next season)

### Scenario 5: Event Processing
1. Check events queue before advancing
2. Advance 7 days
3. Verify new events appear correctly
4. Verify no duplicate events
5. Verify delayed events process at correct times

---

## Advanced: Hook-by-Hook Profiling

To see which daily hooks are slowest:

```javascript
// View detailed hook timings from last profiling run
const data = window.__advanceDayProfiler.data()

// Analyze by hook
data.forEach((dayRecord, index) => {
  console.log(`Day ${index + 1} (${dayRecord.date}):`)
  console.log(`  Total: ${dayRecord.totalMs.toFixed(2)}ms`)
  console.log(`  Hooks:`)
  Object.entries(dayRecord.hooks).forEach(([hookName, hookMs]) => {
    if (hookMs > 0) {
      console.log(`    ${hookName}: ${hookMs.toFixed(2)}ms`)
    }
  })
})
```

**Hook Execution Order** (should see these):
1. fixtures
2. training
3. recovery
4. injuries
5. development
6. ai (transfers)
7. scouting
8. finances (every 7 days: ~2-3ms)
9. events
10. news

---

## Troubleshooting

**Q: Profiler shows undefined in console**
- A: Page might not have loaded calendar.ts yet
- A: Reload page and try again
- A: Check that build completed successfully

**Q: Times are 100ms+, much slower than expected**
- A: Browser may be throttled in DevTools Performance tab
- A: Disable DevTools throttling
- A: Close other tabs/extensions
- A: Check browser console for JavaScript errors

**Q: No hooks show in detailed profiling**
- A: Profiler might not have been started before advancing days
- A: Run profiler.start() BEFORE advancing days through UI
- A: Make sure you're looking at the right day's data

**Q: Calendar jumps when advancing days**
- A: This would indicate a bug (should be fixed)
- A: Report exact dates before/after jump
- A: Save profiling data for debugging

---

## Performance Baseline Targets

| Scenario | Target | Good | Acceptable | Red Flag |
|----------|--------|------|------------|----------|
| Fresh Career | <2ms | <3ms | <5ms | >10ms |
| With Transfers | <2ms | <3ms | <5ms | >10ms |
| Mature Career | <3ms | <5ms | <10ms | >20ms |
| Weekly Finance | <3ms | <3ms | <5ms | >10ms |

---

## Collecting Performance Data

To gather data for analysis:

```javascript
// Profiling script for copy-paste into console

// Start fresh profiling
window.__advanceDayProfiler.clear()
window.__advanceDayProfiler.start()

// Wait for user to advance days through UI...
// Then run:

// Collect data
const perfData = window.__advanceDayProfiler.data()
const report = window.__advanceDayProfiler.report()

// Export for saving
const json = window.__advanceDayProfiler.exportJSON()
const csv = window.__advanceDayProfiler.exportCSV()

// Copy JSON to clipboard
copy(json)
// Paste into a text file and save

// Or export to localStorage
localStorage.setItem('lastPerfProfile', json)
```

---

## Next Steps After Testing

1. **If performance is acceptable** (< 5ms average):
   - Profile with full 10-year career progression
   - Test with multiple transfer windows
   - Confirm calendar advances correctly without jumps

2. **If performance is slow** (> 10ms average):
   - Collect profiling data showing which day is slowest
   - Check console for any errors
   - Run diagnostic: which hooks are taking time?
   - Report slowest hook for further optimization

3. **If calendar jumps** (e.g., 14/11 → 01/08):
   - This indicates a regression in season progression logic
   - Check if season.ts changes are applied correctly
   - Verify finalizeSeasonIfNeeded() not forcing date changes

---

## Success Criteria

✅ All of these must be true for "PERFORMANCE OPTIMIZATION COMPLETE":

1. ✓ Advance Day completes in < 5ms average
2. ✓ No calendar date jumps when advancing
3. ✓ No progressive slowdown over 7+ days
4. ✓ All daily hooks execute and don't error
5. ✓ Events process correctly (no duplicates)
6. ✓ Transfers/negotiations handled without crashes
7. ✓ 30-day continuous advancement stable
8. ✓ Performance matches Node.js test baseline (within 2x)

---

## Reporting Results

When testing completes, create a performance report including:

1. **Baseline Measurements**
   - Average time per day
   - Max and min times
   - Daily breakdown (all 7 days)

2. **Profiling Data**
   - Hook-by-hook timing breakdown
   - Which hooks are slowest
   - Whether time increases over days

3. **Regression Testing**
   - Calendar accuracy (dates correct)
   - No new errors or crashes
   - Gameplay features working

4. **Recommendation**
   - Is performance acceptable?
   - Should further optimizations be considered?
   - Any blockers for production deployment?
