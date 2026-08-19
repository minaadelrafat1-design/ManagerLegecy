import type { GameState, EventLogEntry, Manager } from "./types";
import type { CareerEvent } from "./types";
import { seededUnit } from "./utils";
import { generateAIManager } from "./ai-manager";

/** Generate job offers for the player's manager based on real club state.
 * Runs monthly from `ai-evolution` so offers come from real club performance
 * and board confidence rather than scripted triggers. Returns new state
 * with `events` entries for any offers and a `news` item for the manager.
 */
export function generateJobOffers(state: GameState): GameState {
  const mgr = state.manager;
  if (!mgr) return state;

  const offers: EventLogEntry[] = [];
  const news: typeof state.news = [];

  for (const club of Object.values(state.clubs)) {
    if (club.id === mgr.clubId) continue;
    const aiMgr = club.aiManager;
    const seedStr = `${state.time.date}:job:${club.id}:${mgr.id}`;
    const r = seededUnit(seedStr, 11);

    const clubReputation = club.reputation ?? 50;
    const clubPatience = club.identity?.boardPatience ?? 50;
    const repGap = clubReputation - (mgr.reputation ?? 50);
    const reputationEdge = (mgr.reputation ?? 50) - (aiMgr?.reputation ?? 50);
    const leagueIdentity =
      state.meta?.worldConfig?.countries
        .flatMap((country) => country.divisions)
        .find((division) => division.id === club.leagueId)?.identity ?? null;
    const countryIdentity =
      state.meta?.worldConfig?.countries.find((country) =>
        country.divisions.some((division) => division.id === club.leagueId),
      )?.identity ?? null;
    const prestigeBonus =
      leagueIdentity?.prestige === "Elite" ? 0.07 : leagueIdentity?.prestige === "High" ? 0.04 : 0;
    const youthBonus = (club.identity?.academyFocus ?? 50) > 70 ? 0.03 : 0;
    const urgency =
      0.04 +
      Math.max(0, repGap) / 260 +
      Math.max(0, reputationEdge) / 280 +
      prestigeBonus +
      youthBonus;
    const restless = Math.max(0, (50 - clubPatience) / 900);
    const expectationBonus = club.identity?.expectations === "high" ? 0.03 : 0;
    const desire = Math.max(0, Math.min(0.85, urgency + restless + expectationBonus));

    if (r < desire) {
      const nationalStyleBoost = countryIdentity?.footballStyle?.includes("press")
        ? 250
        : countryIdentity?.footballStyle?.includes("possession")
          ? 180
          : 0;
      const offerSalary = Math.round(
        1_200 +
          clubReputation * 40 +
          (club.facilities?.stadium ?? 50) * 10 +
          nationalStyleBoost +
          (club.identity?.expectations === "high" ? 600 : 0),
      );
      const ev: EventLogEntry = {
        id: `event-job-${(state.events?.length ?? 0) + offers.length + 1}`,
        date: state.time.date,
        type: "milestone",
        description: `${club.name} approach you with a managerial offer`,
        meta: {
          type: "job_offer",
          clubId: club.id,
          offerSalary,
          clubReputation,
          managerReputation: mgr.reputation,
        },
      };
      offers.push(ev);
      const identityTag =
        (club.identity?.archetype ?? "balanced") === "youth"
          ? "youth-focused"
          : (club.identity?.archetype ?? "balanced") === "traditional"
            ? "established"
            : "ambitious";
      news.push({
        id: `news-job-${news.length + 1}`,
        tag: "TRANSFER",
        time: state.time.date,
        text: `${club.name} linked with ${mgr.name} in a ${identityTag} project`,
      });
    }
  }

  if (offers.length === 0) return state;

  return {
    ...state,
    events: [...(state.events ?? []), ...offers],
    news: [...(state.news ?? []), ...news],
  };
}

export function acceptJob(state: GameState, clubId: string): GameState {
  const mgr = state.manager;
  if (!mgr || !mgr.clubId) return state;
  const prevClubId = mgr.clubId;
  if (prevClubId === clubId) return state;

  const prevClub = state.clubs[prevClubId];
  const nextClubs = { ...state.clubs };
  if (prevClub) {
    const ai = generateAIManager(
      {
        id: prevClub.id,
        name: prevClub.name,
        formation: prevClub.formation,
        reputation: prevClub.reputation,
        facilities: prevClub.facilities,
      },
      {
        worldSeed: state.gameSeed ?? state.meta?.["worldSeed"] ?? "0",
        generation: (prevClub.aiManager?.generation ?? 0) + 1,
      },
    );
    nextClubs[prevClub.id] = { ...prevClub, aiManager: ai };
  }

  const newClub = state.clubs[clubId];
  if (!newClub) return state;
  const { aiManager: _removedAiManager, ...clubWithoutAiManager } = newClub;
  nextClubs[clubId] = clubWithoutAiManager;

  const salary = Math.round(
    1_200 + newClub.reputation * 40 + (newClub.facilities?.stadium ?? 50) * 10,
  );
  const contractUntil = `Jun ${Number(String(state.time.season).split("/")[0]) + 3}`;

  const appointmentEvent = {
    id: `career-${(state.careerHistory?.length ?? 0) + 1}`,
    season: String(state.time.season),
    clubId,
    summary: `Appointed manager of ${newClub.name}`,
  } satisfies CareerEvent;

  const updatedManager = {
    id: mgr.id,
    name: mgr.name,
    clubId,
    credit: 50,
    boardConfidence: 50,
    fanConfidence: 50,
    squadConfidence: 50,
    contract: { clubId, salary: `€${salary} / wk`, until: contractUntil },
    reputation: mgr.reputation ?? 50,
    ...(mgr.nationality !== undefined && { nationality: mgr.nationality }),
    ...(mgr.trophies !== undefined && { trophies: mgr.trophies }),
    ...(mgr.experience !== undefined && { experience: mgr.experience }),
    ...(mgr.tactics !== undefined && { tactics: mgr.tactics }),
    ...(mgr.training !== undefined && { training: mgr.training }),
    ...(mgr.motivation !== undefined && { motivation: mgr.motivation }),
    ...(mgr.scouting !== undefined && { scouting: mgr.scouting }),
    ...(mgr.negotiation !== undefined && { negotiation: mgr.negotiation }),
    ...(mgr.manManagement !== undefined && { manManagement: mgr.manManagement }),
    ...(mgr.playerDevelopment !== undefined && { playerDevelopment: mgr.playerDevelopment }),
    ...(mgr.philosophy !== undefined && { philosophy: mgr.philosophy }),
  } as Manager;

  return {
    ...state,
    clubs: nextClubs,
    manager: updatedManager,
    currentClub: newClub,
    careerHistory: [...(state.careerHistory ?? []), appointmentEvent],
    events: [
      ...(state.events ?? []),
      {
        id: `event-appoint-${(state.events?.length ?? 0) + 1}`,
        date: state.time.date,
        type: "milestone",
        description: `You were appointed manager of ${newClub.name}`,
      },
    ],
    news: [
      ...(state.news ?? []),
      {
        id: `news-appoint-${(state.news ?? []).length + 1}`,
        tag: "CLUB",
        time: state.time.date,
        text: `Official: ${newClub.name} appoint ${mgr.name}`,
      },
    ],
  };
}

export function evaluateJobSecurity(state: GameState): GameState {
  const mgr = state.manager;
  if (!mgr || !mgr.clubId) return state;
  const club = state.clubs[mgr.clubId];
  if (!club) return state;

  const boardConf = state.board?.confidence ?? 50;
  const managerBoardConf = mgr.boardConfidence ?? 50;
  const mgrCredit = mgr.credit ?? 50;

  if (boardConf >= 45 && managerBoardConf >= 45 && mgrCredit >= 45) return state;

  const chance = seededUnit(`${state.time.date}:sack:${mgr.id}`);
  const boardRisk = Math.max(0, (45 - boardConf) / 80);
  const managerRisk = Math.max(0, (45 - managerBoardConf) / 80);
  const creditRisk = Math.max(0, (45 - mgrCredit) / 80);
  const risk = Math.min(0.95, boardRisk * 0.45 + managerRisk * 0.35 + creditRisk * 0.2 + 0.08);

  // Very low confidence and credit should guarantee a sack.
  if (boardConf <= 25 && managerBoardConf <= 25 && mgrCredit <= 25) {
    // fall through to sacking immediately
  } else if (chance >= risk) {
    return state;
  }

  const ai = generateAIManager(
    {
      id: club.id,
      name: club.name,
      formation: club.formation,
      reputation: club.reputation,
      facilities: club.facilities,
    },
    {
      worldSeed: state.gameSeed ?? state.meta?.["worldSeed"] ?? "0",
      generation: (club.aiManager?.generation ?? 0) + 1,
    },
  );
  const nextClubs = { ...state.clubs, [club.id]: { ...club, aiManager: ai } };

  const sackedEvent = {
    id: `career-${(state.careerHistory?.length ?? 0) + 1}`,
    season: String(state.time.season),
    clubId: club.id,
    summary: `Sacked by ${club.name}`,
  } satisfies CareerEvent;

  const nextManager = {
    ...mgr,
    clubId: "",
  };

  const ev = {
    id: `event-sack-${(state.events?.length ?? 0) + 1}`,
    date: state.time.date,
    type: "board" as const,
    description: `${club.name} sacked their manager`,
  };
  const news = {
    id: `news-sack-${(state.news ?? []).length + 1}`,
    tag: "PRESS",
    time: state.time.date,
    text: `${club.name} relieve manager duties`,
  };

  return {
    ...state,
    clubs: nextClubs,
    manager: nextManager,
    careerHistory: [...(state.careerHistory ?? []), sackedEvent],
    events: [...(state.events ?? []), ev],
    news: [...(state.news ?? []), news],
  };
}

export {};
