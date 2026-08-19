import assert from "node:assert/strict";

const { buildInitialState } = await import("../src/state/seed.ts");
const { applyPromotionRelegation } = await import("../src/state/promotion.ts");

let state = buildInitialState();
console.log("Running promotion/relegation config integration test...");

const highLeagueId = "high-league";
const lowLeagueId = "low-league";
const highCompetitionId = "high-competition";
const lowCompetitionId = "low-competition";
const clubIds = Object.keys(state.clubs);
assert(clubIds.length >= 4, "Need at least 4 clubs for the test");

const [highWinner, highLoser, lowWinner, lowLoser] = clubIds.slice(0, 4);

state = {
  ...state,
  leagues: {
    ...state.leagues,
    [highLeagueId]: {
      id: highLeagueId,
      name: "High League",
      competitionId: highCompetitionId,
      season: state.time.season,
      matchday: 0,
    },
    [lowLeagueId]: {
      id: lowLeagueId,
      name: "Low League",
      competitionId: lowCompetitionId,
      season: state.time.season,
      matchday: 0,
    },
  },
  competitions: [
    ...state.competitions,
    { id: highCompetitionId, name: "High League", stage: "Season", status: "active" },
    { id: lowCompetitionId, name: "Low League", stage: "Season", status: "active" },
  ],
  clubs: {
    ...state.clubs,
    [highWinner]: { ...state.clubs[highWinner], leagueId: highLeagueId },
    [highLoser]: { ...state.clubs[highLoser], leagueId: highLeagueId },
    [lowWinner]: { ...state.clubs[lowWinner], leagueId: lowLeagueId },
    [lowLoser]: { ...state.clubs[lowLoser], leagueId: lowLeagueId },
  },
  fixtures: [
    {
      id: "f-test-low-1",
      competitionId: lowCompetitionId,
      season: state.time.season,
      homeClubId: lowWinner,
      awayClubId: lowLoser,
      date: "Test",
      matchday: 1,
      venue: "H",
      status: "played",
      result: null,
      scoreHome: 2,
      scoreAway: 0,
    },
    {
      id: "f-test-high-1",
      competitionId: highCompetitionId,
      season: state.time.season,
      homeClubId: highLoser,
      awayClubId: highWinner,
      date: "Test",
      matchday: 1,
      venue: "H",
      status: "played",
      result: null,
      scoreHome: 0,
      scoreAway: 2,
    },
  ],
  meta: {
    ...state.meta,
    worldConfig: {
      countries: [
        {
          id: "england",
          name: "England",
          divisions: [
            {
              id: lowLeagueId,
              name: "Low League",
              countryId: "england",
              level: 2,
              promotionTo: highLeagueId,
              promotionSpots: 3,
            },
            {
              id: highLeagueId,
              name: "High League",
              countryId: "england",
              level: 1,
              relegationTo: lowLeagueId,
              relegationSpots: 3,
            },
          ],
        },
      ],
      competitions: [
        {
          id: highCompetitionId,
          name: "High League",
          type: "league",
          countryId: "england",
          divisionIds: [highLeagueId],
        },
        {
          id: lowCompetitionId,
          name: "Low League",
          type: "league",
          countryId: "england",
          divisionIds: [lowLeagueId],
        },
      ],
    },
  },
};

const promotedBefore = state.clubs[lowWinner].leagueId;
assert(
  promotedBefore === lowLeagueId,
  "Precondition failed: low winner should start in low league",
);

const next = applyPromotionRelegation(state);

assert(
  next.clubs[lowWinner].leagueId === highLeagueId,
  "Top club in low league should be promoted to high league",
);
assert(
  next.clubs[highLoser].leagueId === lowLeagueId,
  "Bottom club in high league should be relegated to low league",
);

const testDivisions = state.meta?.worldConfig?.countries[0]?.divisions ?? [];
const lowDivision = testDivisions.find((division) => division.id === lowLeagueId);
const highDivision = testDivisions.find((division) => division.id === highLeagueId);
assert(lowDivision?.promotionSpots === 3, "Low division should promote 3 clubs");
assert(highDivision?.relegationSpots === 3, "High division should relegate 3 clubs");
assert(lowDivision?.promotionTo === highLeagueId, "Low division should point to the high division");
assert(
  highDivision?.relegationTo === lowLeagueId,
  "High division should point back to the low division",
);

// Edge-case validation: top tier never promotes, bottom tier never relegates,
// and a club only receives one destination in a single season. This uses a valid
// 12-club pyramid so the 3-up/3-down rule is meaningful and possible.
const topLeagueId = "top-tier";
const midLeagueId = "middle-tier";
const bottomLeagueId = "bottom-tier";
const baseState = buildInitialState();
const clubIdsForEdge = Object.keys(baseState.clubs);
assert(clubIdsForEdge.length >= 36, "Need at least 36 clubs for the edge-case pyramid test");
const topClubs = clubIdsForEdge.slice(0, 12);
const midClubs = clubIdsForEdge.slice(12, 24);
const bottomClubs = clubIdsForEdge.slice(24, 36);
const topWinner = topClubs[0];
const topLast = topClubs[topClubs.length - 1];
const midWinner = midClubs[0];
const midLast = midClubs[midClubs.length - 1];
const bottomWinner = bottomClubs[0];
const bottomLast = bottomClubs[bottomClubs.length - 1];

const edgeState = {
  ...baseState,
  leagues: {
    ...baseState.leagues,
    [topLeagueId]: {
      id: topLeagueId,
      name: "Top Tier",
      competitionId: "top-competition",
      season: baseState.time.season,
      matchday: 0,
    },
    [midLeagueId]: {
      id: midLeagueId,
      name: "Middle Tier",
      competitionId: "mid-competition",
      season: baseState.time.season,
      matchday: 0,
    },
    [bottomLeagueId]: {
      id: bottomLeagueId,
      name: "Bottom Tier",
      competitionId: "bottom-competition",
      season: baseState.time.season,
      matchday: 0,
    },
  },
  competitions: [
    ...baseState.competitions,
    { id: "top-competition", name: "Top Tier", stage: "Season", status: "active" },
    { id: "mid-competition", name: "Middle Tier", stage: "Season", status: "active" },
    { id: "bottom-competition", name: "Bottom Tier", stage: "Season", status: "active" },
  ],
  clubs: {
    ...baseState.clubs,
    ...Object.fromEntries(
      topClubs.map((clubId) => [clubId, { ...baseState.clubs[clubId], leagueId: topLeagueId }]),
    ),
    ...Object.fromEntries(
      midClubs.map((clubId) => [clubId, { ...baseState.clubs[clubId], leagueId: midLeagueId }]),
    ),
    ...Object.fromEntries(
      bottomClubs.map((clubId) => [
        clubId,
        { ...baseState.clubs[clubId], leagueId: bottomLeagueId },
      ]),
    ),
  },
  fixtures: [
    {
      id: "edge-top-a",
      competitionId: "top-competition",
      season: baseState.time.season,
      homeClubId: topLast,
      awayClubId: topWinner,
      date: "Edge",
      matchday: 1,
      venue: "H",
      status: "played",
      result: null,
      scoreHome: 0,
      scoreAway: 2,
    },
    {
      id: "edge-mid-a",
      competitionId: "mid-competition",
      season: baseState.time.season,
      homeClubId: midLast,
      awayClubId: midWinner,
      date: "Edge",
      matchday: 1,
      venue: "H",
      status: "played",
      result: null,
      scoreHome: 0,
      scoreAway: 2,
    },
    {
      id: "edge-bottom-a",
      competitionId: "bottom-competition",
      season: baseState.time.season,
      homeClubId: bottomLast,
      awayClubId: bottomWinner,
      date: "Edge",
      matchday: 1,
      venue: "H",
      status: "played",
      result: null,
      scoreHome: 0,
      scoreAway: 2,
    },
    {
      id: "edge-top-b",
      competitionId: "top-competition",
      season: baseState.time.season,
      homeClubId: topClubs[1],
      awayClubId: topClubs[2],
      date: "Edge",
      matchday: 2,
      venue: "H",
      status: "played",
      result: null,
      scoreHome: 2,
      scoreAway: 1,
    },
    {
      id: "edge-mid-b",
      competitionId: "mid-competition",
      season: baseState.time.season,
      homeClubId: midClubs[1],
      awayClubId: midClubs[2],
      date: "Edge",
      matchday: 2,
      venue: "H",
      status: "played",
      result: null,
      scoreHome: 2,
      scoreAway: 1,
    },
    {
      id: "edge-bottom-b",
      competitionId: "bottom-competition",
      season: baseState.time.season,
      homeClubId: bottomClubs[1],
      awayClubId: bottomClubs[2],
      date: "Edge",
      matchday: 2,
      venue: "H",
      status: "played",
      result: null,
      scoreHome: 2,
      scoreAway: 1,
    },
  ],
  meta: {
    ...baseState.meta,
    worldConfig: {
      countries: [
        {
          id: "england",
          name: "England",
          divisions: [
            {
              id: topLeagueId,
              name: "Top Tier",
              countryId: "england",
              level: 1,
              relegationTo: midLeagueId,
              relegationSpots: 3,
            },
            {
              id: midLeagueId,
              name: "Middle Tier",
              countryId: "england",
              level: 2,
              promotionTo: topLeagueId,
              promotionSpots: 3,
              relegationTo: bottomLeagueId,
              relegationSpots: 3,
            },
            {
              id: bottomLeagueId,
              name: "Bottom Tier",
              countryId: "england",
              level: 3,
              promotionTo: midLeagueId,
              promotionSpots: 3,
            },
          ],
        },
      ],
      competitions: [
        {
          id: "top-competition",
          name: "Top Tier",
          type: "league",
          countryId: "england",
          divisionIds: [topLeagueId],
        },
        {
          id: "mid-competition",
          name: "Middle Tier",
          type: "league",
          countryId: "england",
          divisionIds: [midLeagueId],
        },
        {
          id: "bottom-competition",
          name: "Bottom Tier",
          type: "league",
          countryId: "england",
          divisionIds: [bottomLeagueId],
        },
      ],
    },
  },
};

const edgeResult = applyPromotionRelegation(edgeState);
const topMoved = Object.values(edgeResult.clubs).filter(
  (club) => club.leagueId === topLeagueId,
).length;
const midMoved = Object.values(edgeResult.clubs).filter(
  (club) => club.leagueId === midLeagueId,
).length;
const bottomMoved = Object.values(edgeResult.clubs).filter(
  (club) => club.leagueId === bottomLeagueId,
).length;
assert(topMoved === 12, "Top tier should retain all 12 clubs and not promote anyone");
assert(
  midMoved === 12,
  "Middle tier should retain all 12 clubs after the season-end 3-up/3-down move",
);
assert(bottomMoved === 12, "Bottom tier should retain all 12 clubs and not relegate anyone");
assert(
  edgeResult.clubs[topWinner].leagueId === topLeagueId,
  "Top-tier winner should remain in the top tier",
);
assert(
  edgeResult.clubs[bottomWinner].leagueId === midLeagueId,
  "Bottom-tier winner should be promoted to the middle tier",
);
assert(
  edgeResult.clubs[midLast].leagueId === bottomLeagueId,
  "Middle-tier bottom club should be relegated to the bottom tier",
);

const uniqueDestinations = new Set(Object.values(edgeResult.clubs).map((club) => club.leagueId));
assert(uniqueDestinations.size >= 3, "Movement should keep clubs inside a valid pyramid");

console.log("PASS — promotion/relegation config applied correctly");
process.exit(0);
