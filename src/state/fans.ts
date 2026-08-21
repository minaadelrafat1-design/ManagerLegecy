import { registerDailyHook } from "./calendar";
import type { GameState } from "./types";
import { FAN_CONFIDENCE_WEIGHTS, FAN_SENSITIVITY_BASE } from "./confidence-config";
import { getRelationship } from "./relationships";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

registerDailyHook("events", (state: GameState, time) => {
  const next = state;

  const clubId = next.manager?.clubId ?? next.currentClub?.id;
  if (!clubId) return next;

  const old = next.fans?.approval ?? 50;

  const recent = (next.matches ?? [])
    .filter((m) => m.homeClubId === clubId || m.awayClubId === clubId)
    .slice(-6);
  let resultsScore = 50;
  if (recent.length > 0) {
    let points = 0;
    for (const m of recent) {
      const forGoals = m.homeClubId === clubId ? m.scoreHome : m.scoreAway;
      const against = m.homeClubId === clubId ? m.scoreAway : m.scoreHome;
      if (forGoals > against) points += 3;
      else if (forGoals === against) points += 1;
    }
    const ppg = points / recent.length; // 0..3
    resultsScore = clamp((ppg / 3) * 100);
  }

  const leagueClubs = Object.values(next.clubs ?? {}).filter(
    (c) => c.leagueId === next.currentClub?.leagueId && c.id !== clubId,
  );
  let rivalPenalty = 0;
  if (leagueClubs.length > 0) {
    const rival = leagueClubs.sort((a, b) => (b.reputation ?? 50) - (a.reputation ?? 50))[0];
    if (!rival) return next;
    const rivalRecent = (next.matches ?? [])
      .filter((m) => m.homeClubId === rival.id || m.awayClubId === rival.id)
      .slice(-6);
    let rpoints = 0;
    if (rivalRecent.length > 0) {
      for (const m of rivalRecent) {
        const forGoals = m.homeClubId === rival.id ? m.scoreHome : m.scoreAway;
        const against = m.homeClubId === rival.id ? m.scoreAway : m.scoreHome;
        if (forGoals > against) rpoints += 3;
        else if (forGoals === against) rpoints += 1;
      }
      const rppg = rpoints / rivalRecent.length; // 0..3
      const ourPpg = recent.length ? (resultsScore / 100) * 3 : 1.0;
      rivalPenalty = Math.max(0, Math.round((rppg - ourPpg) * 10));
    }
  }

  const styleScore = clamp(
    next.manager
      ? (next.manager.tactics ?? 50) * 0.9 + (next.manager.playerDevelopment ?? 50) * 0.1
      : 50,
  );

  const recentEvents = (next.events ?? []).slice(-40);
  let transferScore = 50;
  let transferDelta = 0;
  for (const e of recentEvents) {
    if (e.type === "transfer") {
      const meta = (e as any).meta;
      if (meta && meta.clubId === clubId) {
        if (meta.action === "in") transferDelta += 8;
        if (meta.action === "out") transferDelta -= 6;
      } else if (typeof e.description === "string") {
        if (
          e.description.includes(next.currentClub?.name ?? clubId) &&
          e.description.includes("signed")
        )
          transferDelta += 8;
        if (
          e.description.includes(next.currentClub?.name ?? clubId) &&
          e.description.includes("left")
        )
          transferDelta -= 6;
      }
    }
  }
  transferScore = clamp(50 + transferDelta);

  const identity = next.currentClub?.identity;
  const identityScore = clamp(
    50 +
      ((identity?.academyFocus ?? 50) - 50) * 0.3 +
      ((identity?.preferExperienced ?? 50) - 50) * -0.1,
  );

  const players = Object.values(next.players ?? {}).filter((p) => p.clubId === clubId);
  let starBoost = 0;
  let avgMorale = 50;
  let avgRelationship = 50;
  if (players.length > 0) {
    const top = players
      .map((p) => p.overall ?? 50)
      .sort((a, b) => b - a)
      .slice(0, 3);
    starBoost = Math.round(top.reduce((s, v) => s + (v > 85 ? 6 : v > 80 ? 3 : 0), 0));
    avgMorale = players.reduce((sum, p) => sum + (p.morale ?? 50), 0) / players.length;
    avgRelationship =
      players.reduce(
        (sum, p) => sum + (getRelationship(next, "manager", next.manager.id, "player", p.id) ?? 50),
        0,
      ) / players.length;
  }

  const clubFanWeights = next.currentClub?.identity?.confidence?.fanWeights;
  const w = { ...FAN_CONFIDENCE_WEIGHTS, ...(clubFanWeights ?? {}) };
  const target = clamp(
    Math.round(
      resultsScore * w.results +
        (100 - rivalPenalty) * w.rival +
        styleScore * w.style +
        transferScore * w.transfers +
        identityScore * w.identity +
        (50 + starBoost) * w.stars,
    ),
  );

  const patience = next.currentClub?.identity?.boardPatience ?? 50;
  const clubPatienceAlpha = next.currentClub?.identity?.confidence?.patienceAlpha;
  const alpha = clubPatienceAlpha ?? FAN_SENSITIVITY_BASE + (1 - patience / 100) * 0.4; // 0.05..0.45
  const nextApproval = clamp(Math.round(old * (1 - alpha) + target * alpha));

  const managerFanOld = next.manager?.fanConfidence ?? 50;
  const managerFanTarget = clamp(
    Math.round(
      resultsScore * 0.18 +
        (100 - rivalPenalty) * 0.14 +
        styleScore * 0.18 +
        transferScore * 0.12 +
        identityScore * 0.1 +
        (50 + starBoost) * 0.1 +
        avgMorale * 0.1 +
        avgRelationship * 0.08,
    ),
  );
  const managerFanAlpha = clubPatienceAlpha ?? FAN_SENSITIVITY_BASE + (1 - patience / 100) * 0.35;
  const nextManagerFanConfidence = clamp(
    Math.round(managerFanOld * (1 - managerFanAlpha) + managerFanTarget * managerFanAlpha),
  );

  const managerSquadOld = next.manager?.squadConfidence ?? 50;
  const managerSquadTarget = clamp(
    Math.round(
      avgMorale * 0.35 + avgRelationship * 0.35 + styleScore * 0.15 + (50 + starBoost) * 0.15,
    ),
  );
  const managerSquadAlpha = clubPatienceAlpha ?? FAN_SENSITIVITY_BASE + (1 - patience / 100) * 0.32;
  const nextManagerSquadConfidence = clamp(
    Math.round(managerSquadOld * (1 - managerSquadAlpha) + managerSquadTarget * managerSquadAlpha),
  );

  const out = {
    ...next,
    fans: {
      ...(next.fans ?? { approval: 50, attendanceAvg: 0 }),
      approval: nextApproval,
      attendanceAvg: next.fans?.attendanceAvg ?? 0,
    },
    manager: {
      ...next.manager,
      fanConfidence: nextManagerFanConfidence,
      squadConfidence: nextManagerSquadConfidence,
    },
  };

  if (Math.abs(nextApproval - old) >= 8) {
    const ev = {
      id: `event-fans-${(next.events?.length ?? 0) + 1}`,
      date: next.time.date,
      type: "board" as const,
      description: `Fans sentiment shifted: ${old} → ${nextApproval}`,
    };
    return { ...out, events: [...(next.events ?? []), ev] };
  }

  return out;
});

export {};
