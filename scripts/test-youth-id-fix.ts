#!/usr/bin/env npx tsx
import { buildYouthPlayerId } from "../src/state/academy";

// Test the fixed function with club IDs that previously collided
const testCases = [
  { seed: "country-8-championship-club-3:0", lastName: "Mendes", age: 18 },
  { seed: "norland-championship-club-3:0", lastName: "Mendes", age: 18 },
  { seed: "england-championship-club-3:0", lastName: "Mendes", age: 18 },
  { seed: "country-4-championship-club-3:0", lastName: "Mendes", age: 18 },
  { seed: "country-8-championship-club-3:1", lastName: "Mendes", age: 18 }, // Different index
];

const ids = testCases.map((tc) => ({
  seed: tc.seed,
  id: buildYouthPlayerId(tc.seed, tc.lastName, tc.age),
}));

console.log(`\n=== YOUTH ID GENERATION TEST (AFTER FIX) ===`);
console.log(`Testing ${testCases.length} cases...\n`);

for (const result of ids) {
  console.log(`Seed: ${result.seed}`);
  console.log(`  ID:  ${result.id}\n`);
}

// Check for duplicates
const idSet = new Set(ids.map((i) => i.id));
const hasDuplicates = idSet.size !== ids.length;

console.log(`\nUnique IDs generated: ${idSet.size}/${ids.length}`);
console.log(`Status: ${hasDuplicates ? "❌ DUPLICATES FOUND!" : "✅ All unique"}`);

if (hasDuplicates) {
  console.log(`\nDuplicate details:`);
  for (const id of idSet) {
    const count = ids.filter((i) => i.id === id).length;
    if (count > 1) {
      console.log(`  ID "${id}" generated ${count} times:`);
      for (const match of ids.filter((i) => i.id === id)) {
        console.log(`    - ${match.seed}`);
      }
    }
  }
}
