/**
 * Direct profiling test for Advance Day performance.
 * Runs in Node.js without browser, using persisted game state.
 *
 * Usage: npm run build && node test-advance-day-profiling.js
 */

import fs from "fs";
import path from "path";

// Import the game state
const stateFile = path.join(process.cwd(), "src", "lib", "new-career-defaults.ts");

console.log("Starting Advance Day Performance Profile...\n");

try {
  // Try to load from localStorage if in browser
  if (typeof localStorage !== "undefined") {
    const data = localStorage.getItem("ml_game_state");
    if (data) {
      const state = JSON.parse(data);
      console.log(`✓ Loaded game state from localStorage`);
      console.log(`  Date: ${state.time.date}`);
      console.log(`  Club: ${state.currentClub?.name}`);
      console.log(`  Clubs: ${Object.keys(state.clubs).length}`);
      console.log(`  Players: ${Object.keys(state.players).length}`);
      console.log(`  Fixtures: ${state.fixtures.length}`);
      console.log(`  Transfers: ${state.transfers.length}`);
      console.log(`  Negotiations: ${state.negotiations.length}`);
      console.log(`  Events: ${state.events.length}`);
    }
  } else {
    console.log(`✗ Not running in browser environment`);
  }
} catch (e) {
  console.error("Error:", e);
}

console.log(`
To run the profiler in the browser:
1. Open http://localhost:8083/
2. Press F12 to open Developer Console
3. Run these commands:

  // Start profiling
  window.__advanceDayProfiler.start();

  // Click "Advance Day" button 7 times in the UI

  // Stop and get report
  window.__advanceDayProfiler.stop();
  window.__advanceDayProfiler.report();

  // Or get raw data
  const data = window.__advanceDayProfiler.data();
  console.log(JSON.stringify(data, null, 2));

  // Export as CSV for analysis
  const csv = window.__advanceDayProfiler.exportCSV();
  console.log(csv);
`);
