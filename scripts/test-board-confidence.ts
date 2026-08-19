/* Test board confidence trends
 * Run with: npx tsx scripts/test-board-confidence.ts
 */

const { buildInitialState } = await import("../src/state/seed");
// register board hook
await import("../src/state/board");
const { gameReducer } = await import("../src/state/reducer");

let state = buildInitialState();

function bandLabel(conf: number) {
  if (conf >= 80) return "Excellent";
  if (conf >= 60) return "Strong";
  if (conf >= 40) return "Concerned";
  if (conf >= 20) return "Serious pressure";
  return "Dismissal likely";
}

console.log("Initial board confidence:", state.board.confidence, bandLabel(state.board.confidence));

// helper to record a match result for our club
function recordMatch(
  state: any,
  home: string,
  away: string,
  scoreH: number,
  scoreA: number,
  daysAfter = 1,
) {
  const playedAt = state.time.date; // use current date stamp
  const seed = Math.floor(Math.random() * 100000);
  state = gameReducer(state, {
    type: "RECORD_MATCH_RESULT",
    fixtureId: null,
    homeClubId: home,
    awayClubId: away,
    scoreHome: scoreH,
    scoreAway: scoreA,
    seed,
    playedAt,
  });
  // advance one day to let daily hooks run when week boundary hits
  state = gameReducer(state, { type: "ADVANCE_DAY", days: daysAfter });
  return state;
}

// Simulate a run of good results (4 wins) across two weeks
for (let i = 0; i < 4; i++) {
  state = recordMatch(state, state.currentClub.id, "opponent", 2, 0, 2);
}
console.log("After good run:", state.board.confidence, bandLabel(state.board.confidence));

// Now simulate several bad results (6 losses)
for (let i = 0; i < 6; i++) {
  state = recordMatch(state, state.currentClub.id, "opponent", 0, 2, 2);
}
console.log("After bad run:", state.board.confidence, bandLabel(state.board.confidence));

// Depress objectives and finances to push confidence lower
state = {
  ...state,
  board: {
    ...state.board,
    expectations: state.board.expectations.map((e: any) => ({
      ...e,
      progress: Math.max(0, (e.progress ?? 0) - 40),
    })),
  },
};
state = { ...state, finances: { ...state.finances, balance: "-€200K" } };

// Advance two weeks to let weekly evaluation incorporate new data
state = gameReducer(state, { type: "ADVANCE_DAY", days: 14 });

console.log(
  "After objectives/finances hit:",
  state.board.confidence,
  bandLabel(state.board.confidence),
);

// Ensure manager is not auto-fired: just check confidence and events
console.log("Events count:", state.events.length);
console.log("PASS — board confidence trend simulation complete");
process.exit(0);
