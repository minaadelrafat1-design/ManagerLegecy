#!/usr/bin/env npx tsx
import { buildInitialState } from "../src/state/seed";

const state = buildInitialState("0");

// Check all clubs to see if any share the same ending
const clubs = Object.values(state.clubs);
const clubNames: Record<string, string[]> = {};

for (const club of clubs) {
  const last10 = club.id.slice(-20);
  if (!clubNames[last10]) clubNames[last10] = [];
  clubNames[last10].push(club.id);
}

const collisions = Object.entries(clubNames).filter(([, ids]) => ids.length > 1);

console.log(`\n=== CLUB NAME COLLISIONS ===`);
console.log(`Total clubs: ${clubs.length}`);
console.log(`Collisions found: ${collisions.length}`);

for (const [suffix, ids] of collisions) {
  console.log(`\n  Suffix: ${suffix}`);
  for (const id of ids) {
    console.log(`    ${id}`);
  }
}

// Check specifically for the problematic clubs
console.log(`\n=== CHECKING CHAMPIONSHIP CLUBS ===`);
const champs = clubs.filter((c) => c.id.includes("championship"));
console.log(`Total championship clubs: ${champs.length}`);

const grouped: Record<string, string[]> = {};
for (const club of champs) {
  const normalizedId = club.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!grouped[normalizedId]) grouped[normalizedId] = [];
  grouped[normalizedId].push(club.id);
}

for (const [norm, ids] of Object.entries(grouped).filter(([, ids]) => ids.length > 1)) {
  console.log(`\nNormalized name: ${norm}`);
  for (const id of ids) {
    const club = clubs.find((c) => c.id === id);
    console.log(`  ${id} (${club?.name})`);
  }
}
