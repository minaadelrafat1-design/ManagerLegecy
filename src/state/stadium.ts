import { addDaysISO, registerDailyHook } from "./calendar";
import { formatMoney, parseMoney } from "./finance";
import { deterministicId } from "./utils";
import type { Club, GameState, StadiumComponentId, StadiumState } from "./types";

export const STADIUM_COMPONENT_ORDER: StadiumComponentId[] = [
  "seating",
  "pitch",
  "hospitality",
  "vip",
  "corporateBoxes",
  "press",
  "parking",
  "entrances",
  "floodlights",
  "scoreboard",
  "security",
  "medical",
  "concessions",
  "shop",
  "toilets",
  "fanAreas",
];

export const STADIUM_COMPONENTS: Record<
  StadiumComponentId,
  {
    id: StadiumComponentId;
    label: string;
    description: string;
    maxLevel: number;
    baseCost: number;
    costGrowth: number;
    maintenance: number;
    capacityGain: number;
    conditionGain: number;
  }
> = {
  seating: {
    id: "seating",
    label: "Seating / Stands",
    description: "Main spectator capacity and safer, more comfortable audience seating.",
    maxLevel: 5,
    baseCost: 3_800_000,
    costGrowth: 1.82,
    maintenance: 180_000,
    capacityGain: 4800,
    conditionGain: 6,
  },
  pitch: {
    id: "pitch",
    label: "Pitch",
    description: "Surface quality, drainage and playing conditions for training and matchdays.",
    maxLevel: 5,
    baseCost: 2_900_000,
    costGrowth: 1.74,
    maintenance: 140_000,
    capacityGain: 1200,
    conditionGain: 8,
  },
  hospitality: {
    id: "hospitality",
    label: "Hospitality",
    description: "Premium matchday hospitality suites and premium hospitality lounges.",
    maxLevel: 5,
    baseCost: 2_150_000,
    costGrowth: 1.7,
    maintenance: 130_000,
    capacityGain: 900,
    conditionGain: 4,
  },
  vip: {
    id: "vip",
    label: "VIP Areas",
    description: "Dedicated premium lounges with club access and premium event experiences.",
    maxLevel: 5,
    baseCost: 1_800_000,
    costGrowth: 1.7,
    maintenance: 120_000,
    capacityGain: 700,
    conditionGain: 4,
  },
  corporateBoxes: {
    id: "corporateBoxes",
    label: "Corporate Boxes",
    description: "Business hospitality suites with broadcasting and networking facilities.",
    maxLevel: 5,
    baseCost: 2_500_000,
    costGrowth: 1.78,
    maintenance: 150_000,
    capacityGain: 1100,
    conditionGain: 5,
  },
  press: {
    id: "press",
    label: "Press / Media",
    description: "Broadcast, media hub and press facilities that improve matchday operations.",
    maxLevel: 5,
    baseCost: 1_500_000,
    costGrowth: 1.65,
    maintenance: 95_000,
    capacityGain: 260,
    conditionGain: 4,
  },
  parking: {
    id: "parking",
    label: "Parking",
    description: "Vehicle flow and fan access reduce congestion on matchdays and improve access.",
    maxLevel: 5,
    baseCost: 1_900_000,
    costGrowth: 1.66,
    maintenance: 90_000,
    capacityGain: 450,
    conditionGain: 4,
  },
  entrances: {
    id: "entrances",
    label: "Entrances / Access",
    description: "Ticketing, turnstiles and access for safer crowd movement and faster entry.",
    maxLevel: 5,
    baseCost: 1_700_000,
    costGrowth: 1.62,
    maintenance: 80_000,
    capacityGain: 500,
    conditionGain: 5,
  },
  floodlights: {
    id: "floodlights",
    label: "Floodlights",
    description: "Lighting quality supports evening fixtures and improves day-to-day reliability.",
    maxLevel: 5,
    baseCost: 1_250_000,
    costGrowth: 1.62,
    maintenance: 75_000,
    capacityGain: 300,
    conditionGain: 5,
  },
  scoreboard: {
    id: "scoreboard",
    label: "Scoreboard",
    description: "Digital display, replay and messaging infrastructure for match operations.",
    maxLevel: 5,
    baseCost: 1_050_000,
    costGrowth: 1.6,
    maintenance: 65_000,
    capacityGain: 180,
    conditionGain: 3,
  },
  security: {
    id: "security",
    label: "Security",
    description: "Crowd control, surveillance and access management improve safety and compliance.",
    maxLevel: 5,
    baseCost: 1_650_000,
    costGrowth: 1.68,
    maintenance: 85_000,
    capacityGain: 350,
    conditionGain: 6,
  },
  medical: {
    id: "medical",
    label: "Medical Facilities",
    description: "Treatment rooms and recovery facilities reduce operational disruption.",
    maxLevel: 5,
    baseCost: 1_400_000,
    costGrowth: 1.66,
    maintenance: 70_000,
    capacityGain: 250,
    conditionGain: 5,
  },
  concessions: {
    id: "concessions",
    label: "Concessions / Food",
    description: "Food and beverage points boost matchday spend and fan experience.",
    maxLevel: 5,
    baseCost: 1_900_000,
    costGrowth: 1.72,
    maintenance: 110_000,
    capacityGain: 550,
    conditionGain: 4,
  },
  shop: {
    id: "shop",
    label: "Club Shop",
    description: "Retail space and merchandising operations drive additional sales on matchdays.",
    maxLevel: 5,
    baseCost: 1_350_000,
    costGrowth: 1.62,
    maintenance: 75_000,
    capacityGain: 300,
    conditionGain: 4,
  },
  toilets: {
    id: "toilets",
    label: "Toilets",
    description:
      "Additional sanitation capacity keeps spectators comfortable and matches compliant.",
    maxLevel: 5,
    baseCost: 1_250_000,
    costGrowth: 1.58,
    maintenance: 60_000,
    capacityGain: 220,
    conditionGain: 4,
  },
  fanAreas: {
    id: "fanAreas",
    label: "Fan Areas",
    description: "Fan zones, supporter spaces and atmosphere-focused community areas.",
    maxLevel: 5,
    baseCost: 1_750_000,
    costGrowth: 1.7,
    maintenance: 90_000,
    capacityGain: 420,
    conditionGain: 5,
  },
};

export function getStadiumUpgradeCost(componentId: StadiumComponentId, level: number): number {
  const definition = STADIUM_COMPONENTS[componentId];
  const safeLevel = Math.max(1, Math.floor(level));
  return Math.round(
    definition.baseCost * Math.pow(definition.costGrowth, Math.max(0, safeLevel - 1)),
  );
}

export function getStadiumUpgradeDuration(componentId: StadiumComponentId, level: number): number {
  const definition = STADIUM_COMPONENTS[componentId];
  const baseDays = 14 + (definition.baseCost / 250_000) * 2;
  return Math.max(7, Math.round(baseDays + level * 4));
}

export function getStadiumMaintenanceCost(club: Club | undefined): number {
  const stadium = club?.stadium ?? createStadiumDefaults(club);
  const componentMaintenance = STADIUM_COMPONENT_ORDER.reduce((sum, componentId) => {
    const level = stadium.componentLevels[componentId] ?? 1;
    return sum + STADIUM_COMPONENTS[componentId].maintenance * level;
  }, 0);
  const conditionPenalty = Math.max(0, 100 - stadium.condition) * 1_200;
  return Math.round(
    componentMaintenance * 0.12 + stadium.matchdayOperatingCost * 0.35 + conditionPenalty,
  );
}

function clampCondition(value: number): number {
  return Math.max(35, Math.min(100, Math.round(value)));
}

function recalculateStadiumMetrics(stadium: StadiumState, club?: Club): StadiumState {
  const baseCapacity = Math.max(
    18_000,
    Math.round((club?.reputation ?? 55) * 210 + (club?.facilities?.stadium ?? 60) * 240),
  );
  let totalCapacity = baseCapacity;
  for (const componentId of STADIUM_COMPONENT_ORDER) {
    const level = stadium.componentLevels[componentId] ?? 1;
    totalCapacity += STADIUM_COMPONENTS[componentId].capacityGain * Math.max(0, level - 1);
  }

  const operatingCost = Math.round(
    260_000 +
      (club?.facilities?.stadium ?? 60) * 2_400 +
      (club?.reputation ?? 55) * 1_300 +
      totalCapacity * 0.9,
  );

  const maintenanceCost = Math.round(
    90_000 +
      STADIUM_COMPONENT_ORDER.reduce((sum, componentId) => {
        const level = stadium.componentLevels[componentId] ?? 1;
        return sum + STADIUM_COMPONENTS[componentId].maintenance * level;
      }, 0) *
        0.18,
  );

  const matchdayOperatingCost = Math.round(totalCapacity * 0.42 + 18_000);

  return {
    ...stadium,
    capacity: totalCapacity,
    operatingCost,
    maintenanceCost,
    matchdayOperatingCost,
    condition: clampCondition(stadium.condition),
    maintenanceStatus:
      stadium.condition > 85
        ? "excellent"
        : stadium.condition > 70
          ? "good"
          : stadium.condition > 55
            ? "fair"
            : "poor",
  };
}

export function createStadiumDefaults(club?: Club): StadiumState {
  const rating = club?.facilities?.stadium ?? 60;
  const componentLevels = Object.fromEntries(
    STADIUM_COMPONENT_ORDER.map((componentId) => [componentId, 1]),
  ) as Record<StadiumComponentId, number>;

  const stadium: StadiumState = {
    name: club?.ground ?? "Main Stadium",
    capacity: Math.max(18_000, Math.round(18_000 + rating * 270 + (club?.reputation ?? 55) * 90)),
    condition: 90,
    operatingCost: Math.round(260_000 + rating * 2_200),
    maintenanceCost: Math.round(90_000 + rating * 1_300),
    matchdayOperatingCost: Math.round(20_000 + rating * 160),
    maintenanceStatus: "good",
    componentLevels,
    upgrades: [],
  };

  return recalculateStadiumMetrics(stadium, club);
}

export function getStadiumOverview(club: Club | undefined) {
  const stadium = club?.stadium ?? createStadiumDefaults(club);
  const averageLevel =
    STADIUM_COMPONENT_ORDER.reduce(
      (sum, componentId) => sum + (stadium.componentLevels[componentId] ?? 1),
      0,
    ) / STADIUM_COMPONENT_ORDER.length;

  return {
    name: stadium.name,
    capacity: stadium.capacity,
    condition: stadium.condition,
    operatingCost: stadium.operatingCost,
    maintenanceCost: stadium.maintenanceCost,
    matchdayOperatingCost: stadium.matchdayOperatingCost,
    maintenanceStatus: stadium.maintenanceStatus,
    averageLevel,
    components: STADIUM_COMPONENT_ORDER.map((componentId) => {
      const definition = STADIUM_COMPONENTS[componentId];
      const componentLevel = stadium.componentLevels[componentId] ?? 1;
      const inProgress = stadium.upgrades.find(
        (upgrade) => upgrade.componentId === componentId && upgrade.status === "in_progress",
      );
      const nextLevel = Math.min(definition.maxLevel, componentLevel + 1);
      const cost = getStadiumUpgradeCost(componentId, componentLevel);
      return {
        id: componentId,
        label: definition.label,
        description: definition.description,
        level: componentLevel,
        nextLevel,
        cost,
        durationDays:
          inProgress?.durationDays ?? getStadiumUpgradeDuration(componentId, componentLevel),
        maxLevel: definition.maxLevel,
        maintenanceCost: definition.maintenance * componentLevel,
        capacityImpact: definition.capacityGain * componentLevel,
        status: inProgress
          ? "in_progress"
          : componentLevel >= definition.maxLevel
            ? "maxed"
            : "ready",
      };
    }),
    upgrades: stadium.upgrades,
  };
}

export function getStadiumUpgradeStatusForComponent(
  club: Club | undefined,
  componentId: StadiumComponentId,
) {
  const stadium = club?.stadium ?? createStadiumDefaults(club);
  const active = stadium.upgrades.find(
    (upgrade) => upgrade.componentId === componentId && upgrade.status === "in_progress",
  );
  return active ?? null;
}

export function queueStadiumUpgrade(state: GameState, componentId: StadiumComponentId): GameState {
  const club = state.currentClub;
  if (!club) return state;

  const stadium = club.stadium ?? createStadiumDefaults(club);
  const currentLevel = stadium.componentLevels[componentId] ?? 1;
  const definition = STADIUM_COMPONENTS[componentId];

  if (currentLevel >= definition.maxLevel) return state;
  if (
    stadium.upgrades.some(
      (upgrade) => upgrade.componentId === componentId && upgrade.status === "in_progress",
    )
  ) {
    return state;
  }

  const cost = getStadiumUpgradeCost(componentId, currentLevel);
  const balance = parseMoney(state.finances?.balance ?? 0);
  if (balance < cost) return state;

  const nextLevel = currentLevel + 1;
  const startedOn = state.time.date;
  const durationDays = getStadiumUpgradeDuration(componentId, currentLevel);
  const completesOn = addDaysISO(startedOn, durationDays);
  const nextUpgrade: StadiumState["upgrades"][number] = {
    id: deterministicId(
      componentId,
      `${state.gameSeed ?? "0"}:${startedOn}:${componentId}`,
      stadium.upgrades.length,
    ),
    componentId,
    fromLevel: currentLevel,
    toLevel: nextLevel,
    cost,
    durationDays,
    startedOn,
    completesOn,
    status: "in_progress",
    description: `${definition.label} upgrade`,
  };

  const nextClub: Club = {
    ...club,
    stadium: recalculateStadiumMetrics(
      {
        ...stadium,
        upgrades: [...stadium.upgrades, nextUpgrade],
      },
      club,
    ),
  };

  const updatedState: GameState = {
    ...state,
    clubs: {
      ...state.clubs,
      [club.id]: nextClub,
    },
    currentClub: nextClub,
    finances: {
      ...state.finances,
      balance: formatMoney(balance - cost),
      expenses: {
        playerSalaries: state.finances?.expenses?.playerSalaries ?? 0,
        staff: state.finances?.expenses?.staff ?? 0,
        transfers: state.finances?.expenses?.transfers ?? 0,
        facilities: (state.finances?.expenses?.facilities ?? 0) + cost,
        scouting: state.finances?.expenses?.scouting ?? 0,
        medical: state.finances?.expenses?.medical ?? 0,
        operations: state.finances?.expenses?.operations ?? 0,
        total: (state.finances?.expenses?.total ?? 0) + cost,
      },
    },
    financialTransactions: [
      ...(state.financialTransactions ?? []),
      {
        id: `stadium-upgrade-${nextUpgrade.id}`,
        date: state.time.date,
        type: "facilities" as const,
        description: `${club.name}: ${definition.label} upgrade started`,
        amount: -cost,
        category: "expense" as const,
        relatedEntityId: nextUpgrade.id,
      },
    ],
    events: [
      ...(state.events ?? []),
      {
        id: deterministicId(
          "event-stadium-upgrade",
          `${state.gameSeed ?? "0"}:${state.time.date}:${componentId}`,
          (state.events ?? []).length,
        ),
        date: state.time.date,
        type: "milestone" as const,
        description: `${definition.label} upgrade started. Completion expected ${completesOn}.`,
      },
    ],
  };

  return updatedState;
}

export function completeStadiumUpgrades(state: GameState): GameState {
  const club = state.currentClub;
  if (!club || !club.stadium) return state;

  const stadium = { ...club.stadium };
  const pendingUpgrades = stadium.upgrades.filter((upgrade) => upgrade.status === "in_progress");
  if (pendingUpgrades.length === 0) return state;

  let nextClub = { ...club };
  let nextState = { ...state };
  let didChange = false;

  for (const upgrade of pendingUpgrades) {
    if (upgrade.completesOn > state.time.date) continue;
    const definition = STADIUM_COMPONENTS[upgrade.componentId];
    stadium.componentLevels[upgrade.componentId] = Math.max(
      stadium.componentLevels[upgrade.componentId] ?? 1,
      upgrade.toLevel,
    );
    stadium.upgrades = stadium.upgrades.map((item) =>
      item.id === upgrade.id ? { ...item, status: "completed" } : item,
    );
    stadium.condition = clampCondition(stadium.condition + definition.conditionGain);
    nextClub = {
      ...nextClub,
      stadium: recalculateStadiumMetrics(stadium, nextClub),
      facilities: {
        ...nextClub.facilities,
        stadium: Math.min(100, Math.round((nextClub.stadium?.capacity ?? 0) / 500)),
      },
    };
    nextState = {
      ...nextState,
      clubs: {
        ...nextState.clubs,
        [nextClub.id]: nextClub,
      },
      currentClub: nextClub,
      events: [
        ...(nextState.events ?? []),
        {
          id: `event-stadium-complete-${upgrade.id}`,
          date: state.time.date,
          type: "milestone" as const,
          description: `${definition.label} completed to level ${upgrade.toLevel}.`,
        },
      ],
    };
    didChange = true;
  }

  return didChange ? nextState : state;
}

export function applyStadiumMaintenance(state: GameState): GameState {
  const club = state.currentClub;
  if (!club || !club.stadium) return state;
  if (club.stadium.lastMaintenanceDate === state.time.date) return state;

  const stadium = { ...club.stadium };
  const maintenanceCost = getStadiumMaintenanceCost(club);
  const balance = parseMoney(state.finances?.balance ?? 0);
  const nextBalance = Math.max(0, balance - maintenanceCost);

  const nextCondition = clampCondition(
    stadium.condition - 2 - Math.max(0, Math.round((100 - stadium.condition) / 12)),
  );
  const nextStadium: StadiumState = recalculateStadiumMetrics(
    {
      ...stadium,
      condition: nextCondition,
      lastMaintenanceDate: state.time.date,
    },
    club,
  );

  const nextClub: Club = {
    ...club,
    stadium: nextStadium,
  };

  const maintenanceTransactionId = `stadium-maintenance-${club.id}-${state.time.date}`;
  const transactions = state.financialTransactions ?? [];
  const nextTransactions = transactions.some(
    (transaction) => transaction.id === maintenanceTransactionId,
  )
    ? transactions
    : [
        ...transactions,
        {
          id: maintenanceTransactionId,
          date: state.time.date,
          type: "operations" as const,
          description: `${club.name}: stadium maintenance`,
          amount: -maintenanceCost,
          category: "expense" as const,
        },
      ];

  return {
    ...state,
    clubs: {
      ...state.clubs,
      [club.id]: nextClub,
    },
    currentClub: nextClub,
    finances: {
      ...state.finances,
      balance: formatMoney(nextBalance),
      expenses: {
        playerSalaries: state.finances?.expenses?.playerSalaries ?? 0,
        staff: state.finances?.expenses?.staff ?? 0,
        transfers: state.finances?.expenses?.transfers ?? 0,
        facilities: state.finances?.expenses?.facilities ?? 0,
        scouting: state.finances?.expenses?.scouting ?? 0,
        medical: state.finances?.expenses?.medical ?? 0,
        operations: (state.finances?.expenses?.operations ?? 0) + maintenanceCost,
        total: (state.finances?.expenses?.total ?? 0) + maintenanceCost,
      },
    },
    financialTransactions: nextTransactions,
  };
}

registerDailyHook("events", (state) => completeStadiumUpgrades(state));
registerDailyHook("finances", (state) => {
  if (!state.currentClub?.stadium) return state;
  const stadium = state.currentClub.stadium;
  if (state.time.day % 7 === 0 || !stadium.lastMaintenanceDate) {
    return applyStadiumMaintenance(state);
  }
  return state;
});
