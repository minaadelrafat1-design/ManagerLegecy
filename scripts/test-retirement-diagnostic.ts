import assert from "node:assert/strict";

const { buildInitialState } = await import("../src/state/seed.ts");
const { runSeasonalPlayerLifecycle } = await import("../src/state/player-development.ts");

const base = buildInitialState();
const clubId = base.currentClub.id;
const playerId = "retirement-diagnostic-player";
const player = {
  ...base.players[Object.keys(base.players)[0]],
  id: playerId,
  name: "Retirement Diagnostic Player",
  pos: "ST",
  age: 50,
  overall: 62,
  potential: 62,
  fitness: 50,
  morale: 60,
  status: "available",
  contractYears: 2,
  contractUntil: "Jun 2028",
  salary: "€20K",
  starter: true,
  clubId,
  injury: null,
  playingTime: { appearancesThisSeason: 20, startsThisSeason: 18, minutesThisSeason: 1500 },
};

const state = {
  ...base,
  time: {
    ...base.time,
    date: "2027-08-01",
    season: "2027/28",
    seasonStartDate: "2027-08-01",
    day: 1,
    week: 1,
  },
  players: { ...base.players, [playerId]: player },
  clubs: {
    ...base.clubs,
    [clubId]: {
      ...base.clubs[clubId],
      playerIds: [...base.clubs[clubId].playerIds, playerId],
    },
  },
};

const next = runSeasonalPlayerLifecycle(state as any) as any;
const updatedPlayer = next.players[playerId];
assert(updatedPlayer, "player should still exist after lifecycle");
assert(updatedPlayer.age === 51, `age should advance on season start: ${updatedPlayer.age}`);
assert(
  updatedPlayer.status === "retired",
  `player should retire at age 51: ${updatedPlayer.status}`,
);
assert(
  next.events.some((event: any) => /retired/i.test(event.description ?? "")),
  "retirement event should be created",
);
console.log(
  JSON.stringify(
    {
      beforeAge: player.age,
      afterAge: updatedPlayer.age,
      status: updatedPlayer.status,
      retiredEventCount: next.events.filter((event: any) =>
        /retired/i.test(event.description ?? ""),
      ).length,
    },
    null,
    2,
  ),
);
