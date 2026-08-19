#!/usr/bin/env npx tsx
import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";

let state = buildInitialState("0");
const before = (state.events ?? []).filter((e) => e.type === "TRANSFER_COMPLETED").length;

state = simulateSeasonQuick(state);

const after = (state.events ?? []).filter((e) => e.type === "TRANSFER_COMPLETED").length;
const dupes: Record<string, number> = {};
for (const [clubId, club] of Object.entries(state.clubs)) {
  for (const playerId of club.playerIds) {
    dupes[playerId] = (dupes[playerId] ?? 0) + 1;
  }
}
const dupCount = Object.values(dupes).filter((c) => c > 1).length;

console.log(
  `Season 1: ${before} -> ${after} transfer events (new: ${after - before}), Duplicates: ${dupCount}`,
);
