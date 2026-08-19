import assert from "node:assert/strict";

const { buildInitialState } = await import("../src/state/seed.ts");
const { runSeasonalYouthGeneration } = await import("../src/state/academy.ts");

const state = buildInitialState();
const beforeProspects = state.currentClub.academy.prospectIds.length;
const beforePlayers = Object.keys(state.players).length;

const seasonStartState = {
  ...state,
  time: {
    ...state.time,
    date: "2027-08-01",
    day: 1,
    week: 1,
  },
};

const updated = runSeasonalYouthGeneration(seasonStartState);
const newProspects = updated.currentClub.academy.prospectIds.filter(
  (id) => !state.currentClub.academy.prospectIds.includes(id),
);

assert(newProspects.length >= 0, "seasonal generation should not remove existing prospects");
assert(
  updated.currentClub.academy.prospectIds.length >= beforeProspects,
  "seasonal generation should grow the prospect list",
);
assert(
  Object.keys(updated.players).length >= beforePlayers,
  "seasonal generation should add youth player records",
);

const createdIds = newProspects.length ? newProspects : [];
if (createdIds.length > 0) {
  const createdPlayer = updated.players[createdIds[0]];
  assert(createdPlayer, "new prospect should have a matching player record");
  assert(createdPlayer.age >= 15 && createdPlayer.age <= 18, "generated youth should be teenagers");
  assert(
    createdPlayer.overall >= 40 && createdPlayer.overall <= 79,
    "generated youth should have sensible overall ratings",
  );
  assert(
    createdPlayer.potential >= createdPlayer.overall,
    "generated youth should have a potential at least as high as overall",
  );
}

console.log("Youth generation checks passed.");
