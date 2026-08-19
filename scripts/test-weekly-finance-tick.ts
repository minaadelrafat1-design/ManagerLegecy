import { buildInitialState } from "../src/state/seed";
import { advanceGameDays } from "../src/state/calendar";

let state = buildInitialState();

const daysToAdvance = 14; // two weeks
const observedWeeks: number[] = [];
const observedLastUpdatedWeeks: number[] = [];

for (let i = 0; i < daysToAdvance; i++) {
  state = advanceGameDays(state, 1);
  observedWeeks.push(state.time.week);
  observedLastUpdatedWeeks.push(state.finances?.lastUpdatedWeek ?? -1);
}

// Count how many times `finances.lastUpdatedWeek` changed across the run.
let changes = 0;
for (let i = 1; i < observedLastUpdatedWeeks.length; i++) {
  if (observedLastUpdatedWeeks[i] !== observedLastUpdatedWeeks[i - 1]) changes++;
}

const expectedWeekBoundaries = Math.floor(daysToAdvance / 7);

if (changes === expectedWeekBoundaries) {
  console.log(`PASS — weekly finance tick ran ${changes} time(s) as expected.`);
  process.exit(0);
} else {
  console.error(
    `FAIL — expected ${expectedWeekBoundaries} weekly finance tick(s), observed ${changes}.`,
  );
  console.error("Observed weeks:", observedWeeks.join(","));
  console.error("Observed lastUpdatedWeek:", observedLastUpdatedWeeks.join(","));
  process.exit(1);
}
