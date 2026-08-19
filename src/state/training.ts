import { registerDailyHook, daysBetweenISO } from "./calendar";
import type { GameState, Player } from "./types";
import {
  TRAINING_INTENSITIES,
  BASE_DAILY_FATIGUE,
  BASE_DAILY_RECOVERY,
  BASE_DAILY_INJURY_PROB,
} from "./training-config";
import { seededUnit } from "./utils";
import { getFacilityEffectMultiplier } from "./facilities";
import { formTrainingMultiplier } from "./fatigue";
import {
  getTrainingGroundCategoryMultiplier,
  getTrainingGroundRecoveryMultiplier,
  type TrainingGroundEffectCategory,
} from "./training-ground";
import { getDrillById } from "./training-presets";

function buildClubPhysioSummary(state: GameState): Map<string, { total: number; count: number }> {
  const physioRatingsByClub = new Map<string, { total: number; count: number }>();

  for (const staff of state.staff ?? []) {
    if (!/physio/i.test(staff.role ?? "")) continue;
    const clubId = staff.clubId ?? state.currentClub?.id ?? "";
    if (!clubId) continue;
    const current = physioRatingsByClub.get(clubId) ?? { total: 0, count: 0 };
    physioRatingsByClub.set(clubId, {
      total: current.total + (staff.rating ?? 50),
      count: current.count + 1,
    });
  }

  return physioRatingsByClub;
}

function buildRecentMatchCountByClub(state: GameState, maxAgeDays: number): Map<string, number> {
  const recentMatchesByClub = new Map<string, number>();
  const today = state.time.date;
  const todayMs = new Date(`${today}T00:00:00.000Z`).getTime();

  for (const match of state.matches ?? []) {
    if (!match.playedAt) continue;
    const matchDate = new Date(`${match.playedAt}T00:00:00.000Z`).getTime();
    const ageDays = Math.abs(Math.round((todayMs - matchDate) / 86_400_000));
    if (ageDays > maxAgeDays) continue;

    if (match.homeClubId) {
      recentMatchesByClub.set(
        match.homeClubId,
        (recentMatchesByClub.get(match.homeClubId) ?? 0) + 1,
      );
    }
    if (match.awayClubId) {
      recentMatchesByClub.set(
        match.awayClubId,
        (recentMatchesByClub.get(match.awayClubId) ?? 0) + 1,
      );
    }
  }

  return recentMatchesByClub;
}

registerDailyHook("training", (state, time) => {
  const activePlanId = state.selectedTrainingPlanId ?? state.training?.[0]?.id ?? null;
  const activePlan =
    state.training?.find((plan) => plan.id === activePlanId) ?? state.training?.[0];

  if (!activePlan || !activePlan.assignedPlayerIds || activePlan.assignedPlayerIds.length === 0) {
    return state;
  }

  const activeIntensity =
    TRAINING_INTENSITIES[activePlan.intensity as keyof typeof TRAINING_INTENSITIES] ??
    TRAINING_INTENSITIES.medium;
  const activeDrills = (activePlan.drillIds ?? []).map(getDrillById).filter(Boolean);

  // PERF: Batch all player updates at once instead of spreading per player
  const updatedPlayers = { ...state.players };
  for (const pid of activePlan.assignedPlayerIds) {
    const p = state.players[pid];
    if (!p) continue;

    const fatigueAdd = Math.round(BASE_DAILY_FATIGUE * activeIntensity.fatiguePct * 1.75);
    const trainingGain = Math.round((activeIntensity.developmentPct - 0.6) * 12);
    const recoveryPenalty = p.fatigue > 75 ? 4 : p.fatigue > 55 ? 2 : 0;
    const formMultiplier = formTrainingMultiplier(p.form ?? 50);
    const categories = new Set<TrainingGroundEffectCategory>();
    for (const drill of activeDrills) {
      if (!drill) continue;
      if (drill.category === "shooting") categories.add("shooting");
      else if (drill.category === "passing" || drill.category === "dribbling") categories.add("technical");
      else if (drill.category === "physical") categories.add("physical");
      else if (drill.category === "mental") categories.add("analysis");
      else if (drill.category === "defending") categories.add("analysis");
    }
    if (categories.size === 0) {
      const focus = (p.trainingFocus ?? activePlan.focus ?? "").toLowerCase();
      if (/shoot|finish|attack/.test(focus)) categories.add("shooting");
      else if (/pass|control|tech|dribbl/.test(focus)) categories.add("technical");
      else if (/physical|strength|stamina|pace|endurance/.test(focus)) categories.add("physical");
      else if (/goalkeep|reflex|keeper/.test(focus)) categories.add("goalkeeping");
      else categories.add("analysis");
    }
    const groundMultiplier = [...categories].reduce(
      (multiplier, category) => Math.max(multiplier, getTrainingGroundCategoryMultiplier(state.currentClub, category)),
      1,
    );

    const currentTrainingProgress = p.trainingProgress ?? 0;
    const newTrainingProgress = Math.max(
      0,
      Math.min(
        100,
        currentTrainingProgress + (trainingGain - recoveryPenalty) * formMultiplier * groundMultiplier,
      ),
    );

    let attrDelta = 0;
    const attrs = { ...p.attrs };
    if (currentTrainingProgress < 100 && newTrainingProgress >= 100) {
      attrDelta = 1;
      const focus = (p.trainingFocus ?? activePlan.focus ?? "").toLowerCase();
      if (focus.includes("finishing") || focus.includes("shooting"))
        attrs.shooting = Math.min(99, attrs.shooting + 1);
      else if (focus.includes("passing")) attrs.passing = Math.min(99, attrs.passing + 1);
      else if (focus.includes("dribbling")) attrs.dribbling = Math.min(99, attrs.dribbling + 1);
      else if (focus.includes("pace")) attrs.pace = Math.min(99, attrs.pace + 1);
      else if (focus.includes("defending") || focus.includes("marking"))
        attrs.defending = Math.min(99, attrs.defending + 1);
      else if (focus.includes("physical")) attrs.physical = Math.min(99, attrs.physical + 1);
      else if (focus.includes("stamina")) {
        attrs.physical = Math.min(99, attrs.physical + 1);
        attrDelta += 0.5;
      }
    }

    const newOverall = attrDelta > 0 ? Math.min(99, (p.overall ?? 50) + attrDelta) : p.overall;

    updatedPlayers[pid] = {
      ...p,
      attrs,
      overall: newOverall,
      fatigue: Math.min(100, (p.fatigue ?? 0) + fatigueAdd),
      trainingProgress: newTrainingProgress >= 100 ? 0 : newTrainingProgress,
      fitness: Math.max(
        40,
        Math.min(
          100,
          (p.fitness ?? 70) + Math.round(activeIntensity.developmentPct * 3) - recoveryPenalty,
        ),
      ),
    };
  }

  return { ...state, players: updatedPlayers };
});

// Recovery hook: reduce fatigue for players not in high-intensity training or on rest days
// PERF: Batch all player updates at once
registerDailyHook("recovery", (state, time) => {
  const activePlanId = state.selectedTrainingPlanId ?? state.training?.[0]?.id ?? null;
  const activePlan =
    state.training?.find((plan) => plan.id === activePlanId) ?? state.training?.[0];
  const assigned: Record<string, string> = {};
  if (activePlan) {
    for (const pid of activePlan.assignedPlayerIds) assigned[pid] = activePlan.intensity;
  }

  const physioRatingsByClub = buildClubPhysioSummary(state);
  const managedClubId = state.currentClub?.id ?? state.manager?.clubId;
  if (!managedClubId) return state;

  const club = state.clubs[managedClubId];
  const playerIds = club?.playerIds ?? [];
  if (playerIds.length === 0) return state;

  const updatedPlayers = { ...state.players };
  for (const pid of playerIds) {
    const p = state.players[pid];
    if (!p) continue;
    const clubId = p.clubId ?? managedClubId;
    const physioEntry = physioRatingsByClub.get(clubId);
    const physioRating =
      physioEntry && physioEntry.count > 0 ? Math.round(physioEntry.total / physioEntry.count) : 50;
    const intensityKey = assigned[pid];
    let recovery = BASE_DAILY_RECOVERY;
    if (intensityKey === "high") recovery = Math.round(BASE_DAILY_RECOVERY * 0.35);
    else if (intensityKey === "medium") recovery = Math.round(BASE_DAILY_RECOVERY * 0.6);
    else if (intensityKey === "low") recovery = Math.round(BASE_DAILY_RECOVERY * 0.8);
    else recovery = Math.round(BASE_DAILY_RECOVERY * 1.2);

    const birthdayBonus = (p.age ?? 30) < 22 ? 2 : 0;
    const ageRecoveryPenalty = (p.age ?? 30) > 30 ? -1 : 0;
    const recoveryWithPhysio = Math.max(
      0,
      Math.round(recovery * getTrainingGroundRecoveryMultiplier(club)) +
        Math.round((physioRating - 50) / 18) + birthdayBonus + ageRecoveryPenalty,
    );
    const newFat = Math.max(0, (p.fatigue ?? 0) - recoveryWithPhysio);
    updatedPlayers[pid] = { ...p, fatigue: newFat };
  }
  return { ...state, players: updatedPlayers };
});

// Injuries hook: small daily chance influenced by fatigue and training intensity
// PERF: Batch all player updates at once
registerDailyHook("injuries", (state, time) => {
  const activePlanId = state.selectedTrainingPlanId ?? state.training?.[0]?.id ?? null;
  const activePlan =
    state.training?.find((plan) => plan.id === activePlanId) ?? state.training?.[0];
  const intensityMap: Record<string, number> = {
    low: TRAINING_INTENSITIES.low.injuryRisk,
    medium: TRAINING_INTENSITIES.medium.injuryRisk,
    high: TRAINING_INTENSITIES.high.injuryRisk,
  };
  const assigned: Record<string, string> = {};
  if (activePlan) {
    for (const pid of activePlan.assignedPlayerIds) assigned[pid] = activePlan.intensity;
  }

  const physioRatingsByClub = buildClubPhysioSummary(state);
  const recentMatchesByClub = buildRecentMatchCountByClub(state, 14);
  const managedClubId = state.currentClub?.id ?? state.manager?.clubId;
  if (!managedClubId) return state;

  const club = state.clubs[managedClubId];
  const playerIds = club?.playerIds ?? [];

  const updatedPlayers = { ...state.players };
  for (const pid of playerIds) {
    const p = state.players[pid];
    if (!p) continue;
    const clubId = p.clubId ?? managedClubId;
    const physioEntry = physioRatingsByClub.get(clubId);
    const physioRating =
      physioEntry && physioEntry.count > 0 ? Math.round(physioEntry.total / physioEntry.count) : 50;
    const fatigue = p.fatigue ?? 0;
    const intensityKey = assigned[pid] ?? "low";
    const intensityMultiplier = intensityMap[intensityKey] ?? 1;
    const medicalFacilityMultiplier = getFacilityEffectMultiplier(state.currentClub, "medical");
    const ageFactor = p.age && p.age > 28 ? 1 + (p.age - 28) * 0.02 : 1;
    const tendencyFactor = (p.injuryProneness ?? 50) / 50;
    const recentMatches = recentMatchesByClub.get(clubId) ?? 0;
    const matchLoadFactor = 1 + Math.min(0.5, recentMatches / 6);
    const physioMultiplier = 1 - (physioRating - 50) / 2000;

    const fatigueRisk =
      fatigue > 85 ? (fatigue - 85) * 0.3 : fatigue > 75 ? (fatigue - 75) * 0.08 : 0;
    const prob =
      BASE_DAILY_INJURY_PROB *
      (1 + (fatigue / 100) * 4 + fatigueRisk) *
      intensityMultiplier *
      ageFactor *
      tendencyFactor *
      matchLoadFactor *
      Math.max(0.4, 1 / medicalFacilityMultiplier) *
      physioMultiplier *
      (activePlan && assigned[pid] ? 1.3 : 0.6);
    const r = seededUnit(`${state.time.date}:${pid}:inj`, 7);
    if (r < prob) {
      const sevRoll = seededUnit(`${state.time.date}:${pid}:injsev`, 9);
      const fatigueModifier = fatigue > 80 ? 0.15 : fatigue > 60 ? 0.05 : 0;
      const severity =
        sevRoll + fatigueModifier < 0.5
          ? "minor"
          : sevRoll + fatigueModifier < 0.8
            ? "moderate"
            : "severe";
      let returnDays = severity === "minor" ? 7 : severity === "moderate" ? 21 : 60;
      const recoveryMultiplier = Math.max(0.75, 1 - (physioRating - 50) / 600);
      returnDays = Math.round(returnDays * recoveryMultiplier);
      const returnDate = new Date(state.time.date);
      returnDate.setUTCDate(returnDate.getUTCDate() + returnDays);
      const inj: Player["injury"] = {
        type: "training-injury",
        severity,
        returnDate: returnDate.toISOString().slice(0, 10),
      };
      updatedPlayers[pid] = { ...p, injury: inj };
    } else {
      updatedPlayers[pid] = p;
    }
  }
  return { ...state, players: updatedPlayers };
});

export {};
