import { registerDailyHook, addDaysISO } from "./calendar";
import type { GameState } from "./types";
import { seededUnit } from "./utils";

// Simple media hook: adds news items based on recent match outcomes and board changes
registerDailyHook("events", (state: GameState, time) => {
  const next = state;

  // run once per day but create items only when there are recent matches
  const recent = (next.matches ?? []).slice(-3);
  const news = [...(next.news ?? [])];

  for (const m of recent) {
    // big win/loss detection
    const margin = Math.abs((m.scoreHome ?? 0) - (m.scoreAway ?? 0));
    if (margin >= 3) {
      const club =
        m.scoreHome! > m.scoreAway! ? next.clubs[m.homeClubId] : next.clubs[m.awayClubId];
      if (!club) continue;
      const identity = club.identity;
      const leagueIdentity =
        next.meta?.worldConfig?.countries
          .flatMap((country) => country.divisions)
          .find((division) => division.id === club.leagueId)?.identity ?? null;
      const styleNote =
        identity?.archetype === "youth"
          ? "on the back of a young, dynamic side"
          : identity?.archetype === "traditional"
            ? "in a measured, experienced display"
            : "with a bold, ambition-driven approach";
      const prestigeNote =
        leagueIdentity?.prestige === "Elite"
          ? "at the top end of the pyramid"
          : "in a demanding domestic fight";
      const seed = seededUnit(`${next.time.date}:media:${m.id}`);
      if (seed < 0.5) {
        news.push({
          id: `news-${news.length + 1}`,
          tag: "MATCH",
          time: next.time.date,
          text: `${club.name} record a ${margin}-goal win ${styleNote} ${prestigeNote}.`,
        });
      }
    }
  }

  // board confidence drops create press items
  const lastEvents = next.events?.slice(-6) ?? [];
  for (const ev of lastEvents) {
    if (ev.type === "board") {
      const seed = seededUnit(`${next.time.date}:press:${ev.id}`);
      if (seed < 0.6) {
        news.push({
          id: `news-${news.length + 1}`,
          tag: "PRESS",
          time: next.time.date,
          text: ev.description,
        });
      }
    }
  }

  return { ...next, news };
});

export {};
