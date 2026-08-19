import { registerDailyHook } from "./calendar";
import { formatMoney, parseMoney } from "./finance";
import { recordTransaction } from "./office-finance";
import type {
  GameState,
  Scout,
  ScoutTierDefinition,
  ScoutingAssignment,
  ScoutingNetwork,
} from "./types";
import { deterministicId } from "./utils";

export const SCOUT_TIER_DEFINITIONS: ScoutTierDefinition[] = [
  {
    id: "local-scout",
    label: "Local Scout",
    description: "Builds a domestic network and flags obvious local talent.",
    cost: 25_000,
    reportSpeedDays: 12,
    scoutingAccuracy: 32,
    discoveryQuality: 1,
    geographicReach: ["Domestic"],
  },
  {
    id: "regional-scout",
    label: "Regional Scout",
    description: "Covers a wider feeder region and brings better late-stage talent knowledge.",
    cost: 95_000,
    reportSpeedDays: 9,
    scoutingAccuracy: 56,
    discoveryQuality: 2,
    geographicReach: ["Domestic", "Western Europe", "South America"],
  },
  {
    id: "continental-scout",
    label: "Continental Scout",
    description: "Operates across multiple countries and identifies reliable top-end prospects.",
    cost: 320_000,
    reportSpeedDays: 6,
    scoutingAccuracy: 72,
    discoveryQuality: 3,
    geographicReach: ["Domestic", "Western Europe", "South America", "North America", "Africa"],
  },
  {
    id: "global-scout",
    label: "Global Scout",
    description: "High-trust network with elite coverage and fast access to rare targets.",
    cost: 850_000,
    reportSpeedDays: 4,
    scoutingAccuracy: 86,
    discoveryQuality: 4,
    geographicReach: [
      "Domestic",
      "Western Europe",
      "South America",
      "North America",
      "Africa",
      "Asia",
      "Middle East",
    ],
  },
];

export function getAvailableScoutTiers(): ScoutTierDefinition[] {
  return SCOUT_TIER_DEFINITIONS.map((tier) => ({
    ...tier,
    geographicReach: [...tier.geographicReach],
  }));
}

export function getScoutTierById(tierId: string): ScoutTierDefinition | undefined {
  return SCOUT_TIER_DEFINITIONS.find((tier) => tier.id === tierId);
}

function ensureScoutingNetwork(state: GameState): GameState {
  if (state.scoutingNetwork) return state;
  return {
    ...state,
    scoutingNetwork: {
      scouts: [],
      assignments: [],
    },
  };
}

export function getScoutingNetwork(state: GameState): ScoutingNetwork {
  const ensured = ensureScoutingNetwork(state);
  return ensured.scoutingNetwork!;
}

export function getAvailableScoutingTargets(
  state: GameState,
): Array<{ id: string; name: string; geographicReach: string[]; divisions: string[] }> {
  const countries = state.meta?.worldConfig?.countries ?? [];
  return countries.map((country) => ({
    id: country.id,
    name: country.name,
    geographicReach: [country.name, ...(country.divisions?.map((division) => division.name) ?? [])],
    divisions: country.divisions?.map((division) => division.name) ?? [],
  }));
}

export function isValidScoutingTarget(state: GameState, countryId: string): boolean {
  return getAvailableScoutingTargets(state).some((target) => target.id === countryId);
}

function addScoutingExpense(
  state: GameState,
  amount: number,
  description: string,
  relatedEntityId?: string,
): GameState {
  const currentBalance = parseMoney(state.finances?.balance ?? "€0");
  const nextBalance = Math.max(0, currentBalance - amount);
  const previousExpenses = state.finances?.expenses ?? {
    playerSalaries: 0,
    staff: 0,
    transfers: 0,
    facilities: 0,
    scouting: 0,
    medical: 0,
    operations: 0,
    total: 0,
  };

  const nextState = {
    ...state,
    finances: {
      ...state.finances,
      balance: formatMoney(nextBalance),
      expenses: {
        ...previousExpenses,
        scouting: previousExpenses.scouting + amount,
        total: previousExpenses.total + amount,
      },
    },
  };

  return recordTransaction(nextState, "scouting", description, -amount, "expense", relatedEntityId);
}

export function hireScout(state: GameState, tierId: string, name: string): GameState {
  let next = ensureScoutingNetwork(state);
  const tier = getScoutTierById(tierId);
  if (!tier) return next;

  const balance = parseMoney(next.finances?.balance ?? "€0");
  if (balance < tier.cost) return next;

  const scout: Scout = {
    id: deterministicId(
      "scout",
      `${next.time.date}:${tier.id}`,
      next.scoutingNetwork?.scouts.length ?? 0,
    ),
    name,
    tierId: tier.id,
    hiredOnDate: next.time.date,
    status: "active",
    geographicReach: [...tier.geographicReach],
  };

  next = {
    ...next,
    scoutingNetwork: {
      scouts: [...(next.scoutingNetwork?.scouts ?? []), scout],
      assignments: next.scoutingNetwork?.assignments ?? [],
      ...(next.scoutingNetwork?.reports && { reports: next.scoutingNetwork.reports }),
      ...(next.scoutingNetwork?.shortlistedPlayerIds && {
        shortlistedPlayerIds: next.scoutingNetwork.shortlistedPlayerIds,
      }),
      ...(next.scoutingNetwork?.dismissedPlayerIds && {
        dismissedPlayerIds: next.scoutingNetwork.dismissedPlayerIds,
      }),
    },
  };

  return addScoutingExpense(
    next,
    tier.cost,
    `Scout hiring: ${scout.name} (${tier.label})`,
    scout.id,
  );
}

export function deployScoutingAssignment(
  state: GameState,
  args: {
    scoutId: string;
    targetCountryId: string;
    durationDays: number;
    assignmentLabel?: string;
  },
): GameState {
  let next = ensureScoutingNetwork(state);
  const scoutingNet = next.scoutingNetwork!;

  const scout = scoutingNet.scouts.find((entry) => entry.id === args.scoutId);
  if (!scout || scout.status !== "active") return next;
  if (!isValidScoutingTarget(next, args.targetCountryId)) return next;

  const existingActive = scoutingNet.assignments.some(
    (assignment) =>
      assignment.scoutId === scout.id &&
      assignment.targetCountryId === args.targetCountryId &&
      assignment.status === "active",
  );
  if (existingActive) return next;

  const tier = getScoutTierById(scout.tierId);
  if (!tier) return next;

  const duration = Math.max(1, Math.round(args.durationDays || 1));
  const cost = Math.round(tier.cost * (duration / 30));
  const balance = parseMoney(next.finances?.balance ?? "€0");
  if (balance < cost) return next;

  const assignment: ScoutingAssignment = {
    id: deterministicId(
      "assignment",
      `${next.time.date}:${scout.id}:${args.targetCountryId}`,
      scoutingNet.assignments.length,
    ),
    scoutId: scout.id,
    targetCountryId: args.targetCountryId,
    assignmentLabel: args.assignmentLabel ?? `Scouting ${args.targetCountryId}`,
    durationDays: duration,
    startedOnDate: next.time.date,
    status: "active",
    progressDays: 0,
    reportSpeedDays: tier.reportSpeedDays,
    scoutingAccuracy: tier.scoutingAccuracy,
    discoveryQuality: tier.discoveryQuality,
    geographicReach: [...tier.geographicReach],
    assignedCost: cost,
  };

  next = {
    ...next,
    scoutingNetwork: {
      scouts: scoutingNet.scouts,
      assignments: [...scoutingNet.assignments, assignment],
      ...(scoutingNet.reports && { reports: scoutingNet.reports }),
      ...(scoutingNet.shortlistedPlayerIds && {
        shortlistedPlayerIds: scoutingNet.shortlistedPlayerIds,
      }),
      ...(scoutingNet.dismissedPlayerIds && { dismissedPlayerIds: scoutingNet.dismissedPlayerIds }),
    },
  };

  return addScoutingExpense(
    next,
    cost,
    `Scouting assignment: ${assignment.assignmentLabel}`,
    assignment.id,
  );
}

export function advanceScoutingAssignments(
  state: GameState,
  currentDate = state.time.date,
): GameState {
  const next = ensureScoutingNetwork(state);
  const scoutingNet = next.scoutingNetwork!;
  let changed = false;

  const assignments = scoutingNet.assignments.map((assignment) => {
    if (assignment.status !== "active") return assignment;
    if (assignment.lastProcessedDate === currentDate) return assignment;

    changed = true;
    const nextProgress = Math.min(assignment.durationDays, assignment.progressDays + 1);
    const nextStatus: ScoutingAssignment["status"] =
      nextProgress >= assignment.durationDays ? "completed" : "active";

    return {
      ...assignment,
      progressDays: nextProgress,
      lastProcessedDate: currentDate,
      status: nextStatus,
    };
  });

  if (!changed) return next;

  return {
    ...next,
    scoutingNetwork: {
      scouts: scoutingNet.scouts,
      assignments,
      ...(scoutingNet.reports && { reports: scoutingNet.reports }),
      ...(scoutingNet.shortlistedPlayerIds && {
        shortlistedPlayerIds: scoutingNet.shortlistedPlayerIds,
      }),
      ...(scoutingNet.dismissedPlayerIds && { dismissedPlayerIds: scoutingNet.dismissedPlayerIds }),
    },
  };
}

registerDailyHook("scouting", (state, time) => advanceScoutingAssignments(state, time.date));

export function getScoutingAssignmentSummary(state: GameState) {
  return getScoutingNetwork(state).assignments.map((assignment) => ({
    id: assignment.id,
    status: assignment.status,
    progressDays: assignment.progressDays,
    durationDays: assignment.durationDays,
    targetCountryId: assignment.targetCountryId,
  }));
}
