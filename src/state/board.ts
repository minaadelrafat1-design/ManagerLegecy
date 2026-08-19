import { registerDailyHook } from "./calendar";
import { generateBoardObjectives } from "./objectives";
import type { GameState } from "./types";
import { BOARD_CONFIDENCE_WEIGHTS } from "./confidence-config";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function parseMoney(display: string | undefined): number {
  if (!display) return 0;
  const match = /([-\d.]+)\s*([MK])?/i.exec(display.replace(/[^0-9.MK-]/g, ""));
  if (!match?.[1]) return 0;
  const n = parseFloat(match[1]);
  const unit = match[2]?.toUpperCase();
  if (unit === "M") return Math.round(n * 1_000_000);
  if (unit === "K") return Math.round(n * 1_000);
  return Math.round(n);
}

function bandLabel(conf: number): string {
  if (conf >= 80) return "Excellent";
  if (conf >= 60) return "Strong";
  if (conf >= 40) return "Concerned";
  if (conf >= 20) return "Serious pressure";
  return "Dismissal likely";
}

// Weekly evaluation: runs on the finances daily hook but only updates once
// per week so the board doesn't react to a single bad result immediately.
registerDailyHook("finances", (state: GameState) => {
  // run once per week
  if ((state.time?.day ?? 0) % 7 !== 0) return state;

  // refresh board objectives weekly
  state = generateBoardObjectives(state);

  const old = state.board?.confidence ?? 50;
  const clubId = state.manager?.clubId ?? state.currentClub?.id;

  // Recent results score (last up to 8 matches)
  const recent = (state.matches ?? [])
    .filter((m) => m.homeClubId === clubId || m.awayClubId === clubId)
    .slice(-8);
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

  // Objectives progress (board expectations)
  const expectations = state.board?.expectations ?? [];
  const objectivesScore = expectations.length
    ? Math.round(expectations.reduce((s, e) => s + (e.progress ?? 0), 0) / expectations.length)
    : 50;

  // Finances: balance relative to squad value
  const balance = parseMoney(String(state.finances?.balance));
  const squadValue = parseMoney(state.finances?.squadValue) || 1;
  const ratio = balance / squadValue; // e.g. 0.2
  const financesScore = clamp(50 + ratio * 100);

  // Manager credit
  const managerCredit = clamp(state.manager?.credit ?? 50);

  // Player development: average of managed club players' trainingEfficiency
  const managedPlayers = Object.values(state.players ?? {}).filter((p) => p.clubId === clubId);
  let developmentScore = 50;
  if (managedPlayers.length > 0) {
    const avg =
      managedPlayers.reduce(
        (s, p) =>
          s +
          ((p.development?.trainingEfficiency ?? 50) * 0.6 +
            (p.development?.growthRate ?? 50) * 0.4),
        0,
      ) / managedPlayers.length;
    developmentScore = clamp(avg);
  }

  // Club expectations modifier
  const expectationsMod =
    (state.currentClub?.identity?.expectations ?? "normal") === "high"
      ? -8
      : (state.currentClub?.identity?.expectations ?? "normal") === "low"
        ? 6
        : 0;

  // Combine weighted components (allow per-club overrides)
  const clubBoardWeights = state.currentClub?.identity?.confidence?.boardWeights;
  const bw = { ...BOARD_CONFIDENCE_WEIGHTS, ...(clubBoardWeights ?? {}) };
  const target = clamp(
    Math.round(
      resultsScore * bw.results +
        objectivesScore * bw.objectives +
        financesScore * bw.finances +
        managerCredit * bw.managerCredit +
        developmentScore * bw.development,
    ) + expectationsMod,
  );

  const managerOldBoard = state.manager?.boardConfidence ?? 50;
  const managerTarget = clamp(
    Math.round(
      resultsScore * 0.22 +
        objectivesScore * 0.28 +
        financesScore * 0.1 +
        managerCredit * 0.25 +
        developmentScore * 0.15 +
        expectationsMod * 0.1,
    ),
  );

  const clubPatienceAlpha = state.currentClub?.identity?.confidence?.patienceAlpha;
  const boardPatience = state.currentClub?.identity?.boardPatience ?? 50;
  const alpha = clubPatienceAlpha ?? 0.02 + (1 - boardPatience / 100) * 0.28; // 0.02..0.30
  const managerAlpha = clubPatienceAlpha ?? 0.08 + (1 - boardPatience / 100) * 0.22; // 0.08..0.30

  const nextConfidence = clamp(Math.round(old * (1 - alpha) + target * alpha));
  const nextManagerBoardConfidence = clamp(
    Math.round(managerOldBoard * (1 - managerAlpha) + managerTarget * managerAlpha),
  );

  const oldBand = bandLabel(old);
  const newBand = bandLabel(nextConfidence);
  const oldManagerBand = bandLabel(managerOldBoard);
  const newManagerBand = bandLabel(nextManagerBoardConfidence);

  let next = {
    ...state,
    board: {
      ...(state.board ?? { confidence: 50, expectations: [] }),
      confidence: nextConfidence,
      expectations: state.board?.expectations ?? [],
    },
    manager: {
      ...state.manager,
      boardConfidence: nextManagerBoardConfidence,
    },
  };

  if (oldBand !== newBand) {
    const ev = {
      id: `event-board-${(state.events?.length ?? 0) + 1}`,
      date: state.time.date,
      type: "board" as const,
      description: `Board confidence changed: ${oldBand} → ${newBand} (${nextConfidence})`,
    };
    next = { ...next, events: [...(state.events ?? []), ev] };
  }

  if (oldManagerBand !== newManagerBand) {
    const ev = {
      id: `event-board-${(next.events?.length ?? 0) + 1}`,
      date: state.time.date,
      type: "board" as const,
      description: `Manager board trust shifted: ${oldManagerBand} → ${newManagerBand} (${nextManagerBoardConfidence})`,
    };
    next = { ...next, events: [...(next.events ?? []), ev] };

    // Add detailed news about why confidence changed
    const trustLevel = bandLabel(nextManagerBoardConfidence);
    let newsReason = "";
    if (resultsScore > 70) newsReason += "Strong results. ";
    else if (resultsScore < 40) newsReason += "Poor results. ";
    if (objectivesScore > 70) newsReason += "Objectives on track. ";
    else if (objectivesScore < 40) newsReason += "Objectives slipping. ";
    if (financesScore < 40) newsReason += "Finances concerning. ";
    if (managerCredit < 40) newsReason += "Manager credit low. ";
    if (developmentScore > 70) newsReason += "Good player development. ";

    const newsText =
      nextManagerBoardConfidence < 35
        ? `The board is losing patience. ${trustLevel} trust. ${newsReason} Significant sacking risk.`
        : nextManagerBoardConfidence < 50
          ? `Board confidence declining. ${trustLevel} trust. ${newsReason} Improve results to regain trust.`
          : nextManagerBoardConfidence > 75
            ? `Board is very satisfied. ${trustLevel} trust. ${newsReason} You have freedom to operate.`
            : `Board trust is ${trustLevel.toLowerCase()}. ${newsReason} Keep improving.`;

    const newsItem = {
      id: `news-board-${(next.news?.length ?? 0) + 1}`,
      tag: "board",
      time: state.time.date,
      text: newsText,
    };
    next = { ...next, news: [...(next.news ?? []), newsItem] };
  }

  return next;
});

export {};
