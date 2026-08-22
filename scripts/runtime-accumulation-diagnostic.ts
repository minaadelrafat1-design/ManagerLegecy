import { createHash } from "node:crypto";
import { buildInitialState } from "../src/state/seed";
import { simulateSeasonQuick } from "../src/state/season";
import {
  advanceGameDays,
  getAdvanceDayTimings,
  getRegisteredDailyHookCount,
  startAdvanceDayProfiling,
  stopAdvanceDayProfiling,
} from "../src/state/calendar";
import type { GameState } from "../src/state/types";
import "../src/state/store";
import "../src/state/ai-contracts";
import "../src/state/ai-evolution";
import "../src/state/ai-transfers";
import "../src/state/training";
import "../src/state/world-tick";
import "../src/state/media";
import "../src/state/inbox";
import "../src/state/board";
import "../src/state/events-engine";

const hookNames = ["fixtures", "training", "recovery", "injuries", "development", "ai", "scouting", "finances", "events", "news"] as const;

function fingerprint(state: GameState) {
  const payload = {
    time: state.time,
    events: state.events,
    players: Object.keys(state.players ?? {}).sort(),
    clubs: Object.keys(state.clubs ?? {}).sort(),
    negotiations: state.negotiations,
    contracts: state.contracts,
    fixtures: state.fixtures,
    matches: state.matches,
  };
  const serialized = JSON.stringify(payload);
  return { sha256: createHash("sha256").update(serialized).digest("hex"), bytes: serialized.length };
}

function counts(state: GameState) {
  const players = Object.values(state.players ?? {});
  const referenced = new Set<string>();
  for (const club of Object.values(state.clubs ?? {})) for (const playerId of club.playerIds ?? []) referenced.add(playerId);
  return {
    players: players.length,
    activeReferenced: players.filter((player) => player.status !== "retired" && referenced.has(player.id)).length,
    unreferenced: players.filter((player) => player.status !== "retired" && player.clubId !== "free-agent" && !referenced.has(player.id)).length,
    retired: players.filter((player) => player.status === "retired").length,
    events: (state.events ?? []).length,
    negotiations: (state.negotiations ?? []).length,
    contracts: (state.contracts ?? []).length,
    fixtures: (state.fixtures ?? []).length,
    matches: (state.matches ?? []).length,
  };
}

function hooks() {
  return Object.fromEntries(hookNames.map((name) => [name, getRegisteredDailyHookCount(name)]));
}

async function main() {
  const run = process.env.DIAGNOSTIC_RUN ?? "unknown";
  let state = buildInitialState("0");
  for (let season = 0; season < 5; season += 1) {
    state = simulateSeasonQuick(state);
    console.log(`[${run}] setup season ${season + 1}/5: ${state.time.season}`);
  }
  const setupCounts = counts(state);
  const setupFingerprint = fingerprint(state);
  console.log(`[${run}] setup complete: players=${setupCounts.players} events=${setupCounts.events} fingerprint=${setupFingerprint.sha256}`);

  const days: unknown[] = [];
  for (let day = 1; day <= 3; day += 1) {
    const before = counts(state);
    const memoryBefore = process.memoryUsage();
    startAdvanceDayProfiling();
    const started = performance.now();
    state = advanceGameDays(state, 1);
    const runtimeMs = performance.now() - started;
    const timing = getAdvanceDayTimings().at(-1);
    const after = counts(state);
    const memoryAfter = process.memoryUsage();
    const row = {
      day,
      date: state.time.date,
      runtimeMs,
      eventsStart: before.events,
      eventsAdded: after.events - before.events,
      eventsEnd: after.events,
      eventsHookMs: timing?.hooks.events ?? null,
      players: after.players,
      activeReferenced: after.activeReferenced,
      unreferenced: after.unreferenced,
      retired: after.retired,
      negotiations: after.negotiations,
      contracts: after.contracts,
      fixtures: after.fixtures,
      matches: after.matches,
      hooks: hooks(),
      memoryBefore,
      memoryAfter,
    };
    days.push(row);
    console.log(`[${run}] day ${day}/3: runtime=${runtimeMs.toFixed(2)}ms events=${before.events}->${after.events} (+${after.events - before.events}) eventsHook=${timing?.hooks.events?.toFixed(2) ?? "n/a"} players=${after.players} hooks=${JSON.stringify(hooks())}`);
    stopAdvanceDayProfiling();
  }

  const result = { run, setup: { ...setupCounts, fingerprint: setupFingerprint }, hooksAfterSetup: hooks(), days, final: { ...counts(state), fingerprint: fingerprint(state) } };
  console.log(JSON.stringify(result));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
