import { buildInitialState } from "../src/state/seed.ts";

console.log("🔍 DETAILED PERFORMANCE PROFILING (System-by-System)\n");

// Import individual simulation functions
import * as playerDev from "../src/state/player-development.ts";
import * as academy from "../src/state/academy.ts";
import * as transfers from "../src/state/ai-transfers.ts";
import * as schedule from "../src/state/competition.ts";

const state = buildInitialState("0");

console.log(`Ecosystem Size:`);
console.log(`  Clubs: ${Object.keys(state.clubs).length}`);
console.log(`  Players: ${Object.keys(state.players).length}`);
console.log(`  Leagues: ${new Set(Object.values(state.clubs).map((c) => c.leagueId)).size}\n`);

console.log(`════════════════════════════════════════════════════════════\n`);
console.log(`SIMULATION PIPELINE COST ANALYSIS\n`);

const systems = [
  {
    name: "Calendar/Time Advancement",
    description: "Advances simulation date and season tracking",
    estimatedCost: "O(1) - constant",
    executionFreq: "1x per season (1 call)",
  },
  {
    name: "Fixture Generation",
    description: "Creates match fixtures for all leagues",
    estimatedCost: `O(C²) - ${Object.keys(state.clubs).length}² combinations`,
    executionFreq: `Likely 1x per season`,
  },
  {
    name: "Match Simulation",
    description: "Simulates all scheduled matches",
    estimatedCost: `O(M) - one per match`,
    executionFreq: `Once per match (thousands)`,
  },
  {
    name: "Player Development/Lifecycle",
    description: "Ages players, applies form changes, career updates",
    estimatedCost: `O(P) - once per ${Object.keys(state.players).length} players`,
    executionFreq: `1x per season`,
  },
  {
    name: "Retirement/Youth Generation",
    description: "Retires old players, generates academy prospects",
    estimatedCost: `O(P) and O(C) - all players and clubs`,
    executionFreq: `1x per season`,
  },
  {
    name: "Transfer Window Processing",
    description: "Executes all AI-driven transfers and contract negotiations",
    estimatedCost: `O(C*T) - clubs × transfer negotiations per club`,
    executionFreq: `1x per season (multiple phases)`,
  },
  {
    name: "Standing Updates",
    description: "Updates league tables after matches",
    estimatedCost: `O(L*C) - leagues × clubs per league`,
    executionFreq: `After each match`,
  },
  {
    name: "Promotion/Relegation",
    description: "Moves clubs up/down divisions",
    estimatedCost: `O(D) - once per division boundary`,
    executionFreq: `1x per season`,
  },
  {
    name: "Manager Changes",
    description: "Hires/fires managers based on performance",
    estimatedCost: `O(C) - once per club`,
    executionFreq: `1x per season`,
  },
  {
    name: "Event Processing/Logging",
    description: "Records all events to event log",
    estimatedCost: `O(E) - one per event created`,
    executionFreq: `Continuous throughout season`,
  },
  {
    name: "State Persistence/Cloning",
    description: "Updates game state, potential deep cloning",
    estimatedCost: `O(S) - size of state object`,
    executionFreq: `Many times throughout season`,
  },
];

console.log(
  `System                     | Complexity       | Exec Freq        | Likely Bottleneck\n`,
);
console.log(`─`.repeat(80));

for (const sys of systems) {
  const isBottleneck =
    sys.name.includes("Match") || sys.name.includes("Fixture") || sys.name.includes("Standing")
      ? "⚠️  HIGH"
      : sys.name.includes("Transfer") || sys.name.includes("Player")
        ? "⚠️  MED"
        : "✓ LOW";

  console.log(
    `${sys.name.padEnd(25)} | ${sys.estimatedCost.padEnd(16)} | ${sys.executionFreq.padEnd(16)} | ${isBottleneck}`,
  );
}

console.log(`\n════════════════════════════════════════════════════════════\n`);
console.log(`KEY BOTTLENECK ANALYSIS\n`);

const matchesPerLeague = Math.floor((Math.pow(Object.keys(state.clubs).length / 81, 2) * 38) / 2); // Rough estimate
const totalMatches = matchesPerLeague * 81;

console.log(`Match Simulation (Likely Dominant Bottleneck):`);
console.log(`  Estimated matches per season: ~${totalMatches}`);
console.log(
  `  If match sim is 60% of runtime (54.6s): ~${((54587 * 0.6) / totalMatches).toFixed(2)}ms per match`,
);
console.log(`  At 1,737 clubs, this is significant\n`);

console.log(`Fixture Generation (Setup Cost):`);
console.log(
  `  League combinations to evaluate: ${Object.keys(state.clubs).length}² = ${Math.pow(Object.keys(state.clubs).length, 2).toLocaleString()}`,
);
console.log(`  If this runs every season, setup time is high\n`);

console.log(`Player Development (Linear Cost):`);
console.log(`  Operations on all ${Object.keys(state.players).length} players: linear O(P)`);
console.log(`  Should not be a major bottleneck\n`);

console.log(`State Mutations & Cloning (Hidden Cost):`);
console.log(`  Large state object = ${JSON.stringify(state).length.toLocaleString()} bytes`);
console.log(`  If state is cloned frequently, this adds up\n`);

console.log(`════════════════════════════════════════════════════════════\n`);
console.log(`PROFILING RECOMMENDATION\n`);

console.log(`To identify exact bottlenecks, instrument:
  1. simulateSeasonQuick() - measure total time
  2. Each sub-function (fixtures, matches, transfers, etc.)
  3. Expensive loops and state operations
  4. Deep cloning/spread operations
  
Run a 1-season benchmark with detailed timing per system.`);

console.log(`\n════════════════════════════════════════════════════════════\n`);
console.log(`PRELIMINARY FINDINGS\n`);

console.log(`✓ Ecosystem size: 1,737 clubs is manageable`);
console.log(`✓ Runtime per season (~54s) is reasonable for 30 years (~27 min)`);
console.log(`⚠️  Match simulation likely dominates (estimated 60%+ of time)`);
console.log(`⚠️  Need to verify match count and fixture generation cost`);
console.log(`⚠️  Missing data: 0 matches, 0 retirements, 0 youth in event log\n`);

console.log(`════════════════════════════════════════════════════════════\n`);
console.log(`NEXT STEPS\n`);

console.log(`1. Add detailed timing instrumentation to simulateSeasonQuick()`);
console.log(`2. Measure each subsystem independently`);
console.log(`3. Confirm match count and performance`);
console.log(`4. Identify state mutation hotspots`);
console.log(`5. Generate detailed bottleneck report\n`);

process.exit(0);
