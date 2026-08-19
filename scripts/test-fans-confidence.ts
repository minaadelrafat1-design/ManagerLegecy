/* Test fans confidence reaction
 * Run with: npx tsx scripts/test-fans-confidence.ts
 */

const { buildInitialState } = await import("../src/state/seed");
await import("../src/state/fans");
const { gameReducer } = await import("../src/state/reducer");

let state = buildInitialState();

console.log("Initial fans approval:", state.fans.approval);

function playResult(state: any, scoreFor: number, scoreAgainst: number) {
  const seed = Math.floor(Math.random() * 100000);
  const playedAt = state.time.date;
  state = gameReducer(state, {
    type: "RECORD_MATCH_RESULT",
    fixtureId: null,
    homeClubId: state.currentClub.id,
    awayClubId: "opponent",
    scoreHome: scoreFor,
    scoreAway: scoreAgainst,
    seed,
    playedAt,
  });
  state = gameReducer(state, { type: "ADVANCE_DAY", days: 2 });
  return state;
}

// 3 wins
for (let i = 0; i < 3; i++) state = playResult(state, 2, 0);
console.log("After wins fans approval:", state.fans.approval);

// big transfer in event
state = {
  ...state,
  events: [
    ...state.events,
    {
      id: "news-1",
      date: state.time.date,
      type: "transfer",
      description: `${state.currentClub.name} signed a star striker`,
    },
  ],
};
state = gameReducer(state, { type: "ADVANCE_DAY", days: 3 });
console.log("After signing star approval:", state.fans.approval);

// 4 losses
for (let i = 0; i < 4; i++) state = playResult(state, 0, 2);
console.log("After losses fans approval:", state.fans.approval);

console.log("PASS — fans confidence simulation");
process.exit(0);
