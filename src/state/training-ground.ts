import { addDaysISO, registerDailyHook } from "./calendar";
import { formatMoney, parseMoney } from "./finance";
import { deterministicId } from "./utils";
import type { Club, GameState } from "./types";

export type TrainingGroundFacilityKey =
  "pitch" | "indoor" | "gym" | "recovery" | "goalkeeping" | "medical" | "analysisSuite" | "academy";

export type TrainingGroundEquipmentKey =
  | "strength"
  | "cardio"
  | "technical"
  | "ball"
  | "shooting"
  | "goalkeeping"
  | "recovery"
  | "analysisTech";

export interface TrainingGroundAssetState {
  key: string;
  label: string;
  level: number;
  condition: number;
  maintenanceCost: number;
  maxLevel: number;
}

export interface TrainingGroundUpgrade {
  id: string;
  kind: "facility" | "equipment";
  assetId: string;
  fromLevel: number;
  toLevel: number;
  cost: number;
  durationDays: number;
  startedOn: string;
  completesOn: string;
  status: "in_progress" | "completed";
  description: string;
}

export interface TrainingGroundState {
  facilities: Record<TrainingGroundFacilityKey, TrainingGroundAssetState>;
  equipment: Record<TrainingGroundEquipmentKey, TrainingGroundAssetState>;
  condition: number;
  operatingCost: number;
  maintenanceCost: number;
  lastMaintenanceDate?: string;
  upgrades: TrainingGroundUpgrade[];
}

function assetValues(record: Record<string, TrainingGroundAssetState>): TrainingGroundAssetState[] {
  return Object.values(record);
}

function assetEntries(
  record: Record<string, TrainingGroundAssetState>,
): Array<[string, TrainingGroundAssetState]> {
  return Object.entries(record);
}

const TRAINING_GROUND_FACILITY_DEFS: Record<
  TrainingGroundFacilityKey,
  {
    label: string;
    baseCost: number;
    costGrowth: number;
    maintenance: number;
    maxLevel: number;
  }
> = {
  pitch: {
    label: "Main Pitch",
    baseCost: 1_200_000,
    costGrowth: 1.58,
    maintenance: 45_000,
    maxLevel: 5,
  },
  indoor: {
    label: "Indoor Arena",
    baseCost: 1_500_000,
    costGrowth: 1.62,
    maintenance: 55_000,
    maxLevel: 5,
  },
  gym: {
    label: "Gym & Strength Hub",
    baseCost: 1_250_000,
    costGrowth: 1.66,
    maintenance: 60_000,
    maxLevel: 5,
  },
  recovery: {
    label: "Recovery Suite",
    baseCost: 1_100_000,
    costGrowth: 1.6,
    maintenance: 52_000,
    maxLevel: 5,
  },
  goalkeeping: {
    label: "Goalkeeper Zone",
    baseCost: 900_000,
    costGrowth: 1.52,
    maintenance: 35_000,
    maxLevel: 5,
  },
  medical: {
    label: "Medical Bay",
    baseCost: 1_050_000,
    costGrowth: 1.55,
    maintenance: 40_000,
    maxLevel: 5,
  },
  analysisSuite: {
    label: "Analysis Suite",
    baseCost: 1_300_000,
    costGrowth: 1.7,
    maintenance: 62_000,
    maxLevel: 5,
  },
  academy: {
    label: "Academy Training Block",
    baseCost: 1_600_000,
    costGrowth: 1.75,
    maintenance: 70_000,
    maxLevel: 5,
  },
};

const TRAINING_GROUND_EQUIPMENT_DEFS: Record<
  TrainingGroundEquipmentKey,
  {
    label: string;
    baseCost: number;
    costGrowth: number;
    maintenance: number;
    maxLevel: number;
  }
> = {
  strength: {
    label: "Strength Equipment",
    baseCost: 420_000,
    costGrowth: 1.58,
    maintenance: 18_000,
    maxLevel: 5,
  },
  cardio: {
    label: "Cardio Stations",
    baseCost: 390_000,
    costGrowth: 1.56,
    maintenance: 16_000,
    maxLevel: 5,
  },
  technical: {
    label: "Technical Drills",
    baseCost: 460_000,
    costGrowth: 1.6,
    maintenance: 20_000,
    maxLevel: 5,
  },
  ball: {
    label: "Ball & Passing Gear",
    baseCost: 375_000,
    costGrowth: 1.52,
    maintenance: 15_000,
    maxLevel: 5,
  },
  shooting: {
    label: "Shooting Track",
    baseCost: 430_000,
    costGrowth: 1.6,
    maintenance: 17_000,
    maxLevel: 5,
  },
  goalkeeping: {
    label: "Goalkeeper Kit",
    baseCost: 410_000,
    costGrowth: 1.55,
    maintenance: 16_000,
    maxLevel: 5,
  },
  recovery: {
    label: "Recovery Equipment",
    baseCost: 360_000,
    costGrowth: 1.52,
    maintenance: 14_000,
    maxLevel: 5,
  },
  analysisTech: {
    label: "Analysis Tech",
    baseCost: 520_000,
    costGrowth: 1.72,
    maintenance: 22_000,
    maxLevel: 5,
  },
};

function clampAsset(value: number, min = 1, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function getFacilityCost(kind: "facility" | "equipment", assetId: string, level: number): number {
  const definition =
    kind === "facility"
      ? TRAINING_GROUND_FACILITY_DEFS[assetId as TrainingGroundFacilityKey]
      : TRAINING_GROUND_EQUIPMENT_DEFS[assetId as TrainingGroundEquipmentKey];
  if (!definition) return 0;
  return Math.round(definition.baseCost * Math.pow(definition.costGrowth, Math.max(0, level - 1)));
}

function getFacilityDuration(
  kind: "facility" | "equipment",
  assetId: string,
  level: number,
): number {
  const definition =
    kind === "facility"
      ? TRAINING_GROUND_FACILITY_DEFS[assetId as TrainingGroundFacilityKey]
      : TRAINING_GROUND_EQUIPMENT_DEFS[assetId as TrainingGroundEquipmentKey];
  if (!definition) return 7;
  const baseDays = kind === "facility" ? 9 : 6;
  return Math.max(5, Math.round(baseDays + (level + 1) * 3 + definition.baseCost / 250_000));
}

function getFacilityMaintenance(
  kind: "facility" | "equipment",
  assetId: string,
  level: number,
): number {
  const definition =
    kind === "facility"
      ? TRAINING_GROUND_FACILITY_DEFS[assetId as TrainingGroundFacilityKey]
      : TRAINING_GROUND_EQUIPMENT_DEFS[assetId as TrainingGroundEquipmentKey];
  if (!definition) return 0;
  return Math.round(definition.maintenance * (1 + (level - 1) * 0.22));
}

function buildTrainingGroundAssetState(
  key: string,
  label: string,
  level: number,
  maxLevel: number,
  maintenance: number,
  condition = 86,
): TrainingGroundAssetState {
  return {
    key,
    label,
    level: clampAsset(level, 1, maxLevel),
    condition: clampAsset(condition, 30, 100),
    maintenanceCost: Math.round(maintenance * (1 + (level - 1) * 0.2)),
    maxLevel,
  };
}

export function createTrainingGroundDefaults(club?: Club): TrainingGroundState {
  const facilityEntries = Object.entries(TRAINING_GROUND_FACILITY_DEFS) as [
    TrainingGroundFacilityKey,
    (typeof TRAINING_GROUND_FACILITY_DEFS)[TrainingGroundFacilityKey],
  ][];
  const equipmentEntries = Object.entries(TRAINING_GROUND_EQUIPMENT_DEFS) as [
    TrainingGroundEquipmentKey,
    (typeof TRAINING_GROUND_EQUIPMENT_DEFS)[TrainingGroundEquipmentKey],
  ][];

  const facilities = Object.fromEntries(
    facilityEntries.map(([id, def]) => [
      id,
      buildTrainingGroundAssetState(
        id,
        def.label,
        1,
        def.maxLevel,
        def.maintenance,
        84 + (club?.reputation ?? 60) / 12,
      ),
    ]),
  ) as Record<TrainingGroundFacilityKey, TrainingGroundAssetState>;

  const equipment = Object.fromEntries(
    equipmentEntries.map(([id, def]) => [
      id,
      buildTrainingGroundAssetState(
        id,
        def.label,
        1,
        def.maxLevel,
        def.maintenance,
        82 + (club?.facilities?.training ?? 65) / 10,
      ),
    ]),
  ) as Record<TrainingGroundEquipmentKey, TrainingGroundAssetState>;

  const condition = Math.round(
    (assetValues(facilities).reduce((sum, entry) => sum + entry.condition, 0) +
      assetValues(equipment).reduce((sum, entry) => sum + entry.condition, 0)) /
      (Object.keys(facilities).length + Object.keys(equipment).length),
  );

  const standing = club?.facilities?.training ?? 70;
  return {
    facilities,
    equipment,
    condition,
    operatingCost: Math.round(120_000 + standing * 2_300),
    maintenanceCost: Math.round(
      assetValues(facilities).reduce((sum, entry) => sum + entry.maintenanceCost, 0) * 0.4 +
        assetValues(equipment).reduce((sum, entry) => sum + entry.maintenanceCost, 0) * 0.25,
    ),
    upgrades: [],
  };
}

export function getTrainingGroundOverview(club: Club | undefined) {
  const ground = club?.trainingGround ?? createTrainingGroundDefaults(club);
  const facilityList = (
    Object.keys(TRAINING_GROUND_FACILITY_DEFS) as TrainingGroundFacilityKey[]
  ).map((id) => ({
    id,
    ...ground.facilities[id],
    status: ground.upgrades.some(
      (upgrade: TrainingGroundUpgrade) =>
        upgrade.kind === "facility" && upgrade.assetId === id && upgrade.status === "in_progress",
    )
      ? "in_progress"
      : "ready",
  }));

  const equipmentList = (
    Object.keys(TRAINING_GROUND_EQUIPMENT_DEFS) as TrainingGroundEquipmentKey[]
  ).map((id) => ({
    id,
    ...ground.equipment[id],
    status: ground.upgrades.some(
      (upgrade: TrainingGroundUpgrade) =>
        upgrade.kind === "equipment" && upgrade.assetId === id && upgrade.status === "in_progress",
    )
      ? "in_progress"
      : "ready",
  }));

  return {
    condition: ground.condition,
    operatingCost: ground.operatingCost,
    maintenanceCost: ground.maintenanceCost,
    totalCondition: Math.round(
      (facilityList.reduce((sum, item) => sum + item.condition, 0) +
        equipmentList.reduce((sum, item) => sum + item.condition, 0)) /
        (facilityList.length + equipmentList.length),
    ),
    facilities: facilityList,
    equipment: equipmentList,
    upgrades: ground.upgrades,
  };
}

export function getTrainingGroundDevelopmentMultiplier(
  club: Club | undefined,
  focus: string,
): number {
  const normalized = focus.toLowerCase();
  if (/recovery|readiness/.test(normalized)) return getTrainingGroundRecoveryMultiplier(club);
  if (/shoot|finish|attack|forward/.test(normalized))
    return getTrainingGroundCategoryMultiplier(club, "shooting");
  if (/pass|control|tech|dribbl|build/.test(normalized))
    return getTrainingGroundCategoryMultiplier(club, "technical");
  if (/physical|strength|stamina|pace|endurance|fitness/.test(normalized))
    return getTrainingGroundCategoryMultiplier(club, "physical");
  if (/goalkeep|reflex|keeper/.test(normalized))
    return getTrainingGroundCategoryMultiplier(club, "goalkeeping");
  if (/tactic|mental|decision|position|composure/.test(normalized))
    return getTrainingGroundCategoryMultiplier(club, "analysis");
  return getTrainingGroundCategoryMultiplier(club, "technical");
}

export type TrainingGroundEffectCategory =
  "shooting" | "technical" | "physical" | "goalkeeping" | "analysis";

const CATEGORY_ASSETS: Record<
  TrainingGroundEffectCategory,
  Array<["facility" | "equipment", string, number]>
> = {
  shooting: [
    ["facility", "pitch", 0.35],
    ["facility", "indoor", 0.2],
    ["equipment", "shooting", 0.65],
  ],
  technical: [
    ["facility", "pitch", 0.2],
    ["facility", "indoor", 0.35],
    ["equipment", "technical", 0.55],
    ["equipment", "ball", 0.45],
  ],
  physical: [
    ["facility", "gym", 0.65],
    ["equipment", "strength", 0.55],
    ["equipment", "cardio", 0.45],
  ],
  goalkeeping: [
    ["facility", "goalkeeping", 0.7],
    ["equipment", "goalkeeping", 0.7],
  ],
  analysis: [
    ["facility", "analysisSuite", 0.65],
    ["equipment", "analysisTech", 0.65],
  ],
};

function assetQuality(
  ground: TrainingGroundState,
  kind: "facility" | "equipment",
  id: string,
): number {
  const asset =
    kind === "facility"
      ? ground.facilities[id as TrainingGroundFacilityKey]
      : ground.equipment[id as TrainingGroundEquipmentKey];
  if (!asset) return 0;
  return Math.max(0, Math.min(1, ((asset.level - 1) / 4) * (asset.condition / 100)));
}

export function getTrainingGroundCategoryMultiplier(
  club: Club | undefined,
  category: TrainingGroundEffectCategory,
): number {
  const ground = club?.trainingGround ?? createTrainingGroundDefaults(club);
  const assets = CATEGORY_ASSETS[category];
  const weightedQuality = assets.reduce(
    (sum, [kind, id, weight]) => sum + assetQuality(ground, kind, id) * weight,
    0,
  );
  return Number((1 + Math.min(0.18, weightedQuality * 0.18)).toFixed(3));
}

export function getTrainingGroundRecoveryMultiplier(club: Club | undefined): number {
  const ground = club?.trainingGround ?? createTrainingGroundDefaults(club);
  const recovery = assetQuality(ground, "facility", "recovery");
  const medical = assetQuality(ground, "facility", "medical");
  const equipment = assetQuality(ground, "equipment", "recovery");
  const condition = Math.max(0.75, Math.min(1.05, ground.condition / 100));
  return Number(
    (
      1 +
      Math.min(0.2, (recovery * 0.4 + medical * 0.25 + equipment * 0.35) * 0.2) * condition
    ).toFixed(3),
  );
}

export function queueTrainingGroundUpgrade(
  state: GameState,
  kind: "facility" | "equipment",
  assetId: string,
): GameState {
  const club = state.currentClub;
  if (!club) return state;

  const ground = club.trainingGround ?? createTrainingGroundDefaults(club);
  const current =
    kind === "facility"
      ? ground.facilities[assetId as TrainingGroundFacilityKey]
      : ground.equipment[assetId as TrainingGroundEquipmentKey];

  if (!current || current.level >= current.maxLevel) return state;
  if (
    ground.upgrades.some(
      (upgrade: TrainingGroundUpgrade) =>
        upgrade.kind === kind && upgrade.assetId === assetId && upgrade.status === "in_progress",
    )
  ) {
    return state;
  }

  const cost = getFacilityCost(kind, assetId, current.level);
  const balance = parseMoney(state.finances?.balance ?? 0);
  if (balance < cost) return state;

  const start = state.time.date;
  const duration = getFacilityDuration(kind, assetId, current.level);
  const completesOn = addDaysISO(start, duration);

  const nextUpgrade: TrainingGroundUpgrade = {
    id: deterministicId(
      `${kind}-${assetId}`,
      `${state.gameSeed ?? "0"}:${club.id}:${start}`,
      ground.upgrades.length,
    ),
    kind,
    assetId,
    fromLevel: current.level,
    toLevel: current.level + 1,
    cost,
    durationDays: duration,
    startedOn: start,
    completesOn,
    status: "in_progress",
    description: `${current.label} upgrade`,
  };

  const nextClub: Club = {
    ...club,
    trainingGround: {
      ...ground,
      upgrades: [...ground.upgrades, nextUpgrade],
    },
  };

  return {
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
    events: [
      ...(state.events ?? []),
      {
        id: deterministicId(
          "event-training-upgrade",
          `${state.gameSeed ?? "0"}:${club.id}:${start}:${assetId}`,
          (state.events ?? []).length,
        ),
        date: state.time.date,
        type: "milestone" as const,
        description: `${current.label} upgrade started. Completion expected ${completesOn}.`,
      },
    ],
  };
}

function applyUpgradeToTrainingGround(
  ground: TrainingGroundState,
  upgrade: TrainingGroundUpgrade,
): TrainingGroundState {
  if (upgrade.kind === "facility") {
    const definition = TRAINING_GROUND_FACILITY_DEFS[upgrade.assetId as TrainingGroundFacilityKey];
    const existing = ground.facilities[upgrade.assetId as TrainingGroundFacilityKey];
    if (!definition || !existing) return ground;
    const nextFacilities = {
      ...ground.facilities,
      [upgrade.assetId as TrainingGroundFacilityKey]: {
        ...existing,
        level: upgrade.toLevel,
        condition: clampAsset(existing.condition + 4, 35, 100),
        maintenanceCost: getFacilityMaintenance("facility", upgrade.assetId, upgrade.toLevel),
      },
    };
    return {
      ...ground,
      facilities: nextFacilities,
      condition: clampAsset(ground.condition + 4),
      maintenanceCost: Math.round(
        assetValues(nextFacilities).reduce((sum, item) => sum + item.maintenanceCost, 0) * 0.4 +
          assetValues(ground.equipment).reduce((sum, item) => sum + item.maintenanceCost, 0) * 0.25,
      ),
      upgrades: ground.upgrades.map((item) =>
        item.id === upgrade.id ? { ...item, status: "completed" } : item,
      ),
    };
  }

  const definition = TRAINING_GROUND_EQUIPMENT_DEFS[upgrade.assetId as TrainingGroundEquipmentKey];
  const existing = ground.equipment[upgrade.assetId as TrainingGroundEquipmentKey];
  if (!definition || !existing) return ground;
  const nextEquipment = {
    ...ground.equipment,
    [upgrade.assetId as TrainingGroundEquipmentKey]: {
      ...existing,
      level: upgrade.toLevel,
      condition: clampAsset(existing.condition + 5, 35, 100),
      maintenanceCost: getFacilityMaintenance("equipment", upgrade.assetId, upgrade.toLevel),
    },
  };
  return {
    ...ground,
    equipment: nextEquipment,
    condition: clampAsset(ground.condition + 5),
    maintenanceCost: Math.round(
      assetValues(ground.facilities).reduce((sum, item) => sum + item.maintenanceCost, 0) * 0.4 +
        assetValues(nextEquipment).reduce((sum, item) => sum + item.maintenanceCost, 0) * 0.25,
    ),
    upgrades: ground.upgrades.map((item) =>
      item.id === upgrade.id ? { ...item, status: "completed" } : item,
    ),
  };
}

export function completeTrainingGroundUpgrades(state: GameState): GameState {
  const club = state.currentClub;
  if (!club || !club.trainingGround) return state;

  const pending = club.trainingGround.upgrades.filter(
    (upgrade: TrainingGroundUpgrade) => upgrade.status === "in_progress",
  );
  if (pending.length === 0) return state;

  let nextGround = club.trainingGround;
  let nextClub = club;
  let didChange = false;

  for (const upgrade of pending) {
    if (upgrade.completesOn > state.time.date) continue;
    nextGround = applyUpgradeToTrainingGround(nextGround, upgrade);
    nextClub = { ...nextClub, trainingGround: nextGround };
    didChange = true;
    nextClub = {
      ...nextClub,
      facilities: {
        ...nextClub.facilities,
        training: Math.min(100, nextClub.facilities.training + 1),
      },
    };
  }

  if (!didChange) return state;

  const updatedState: GameState = {
    ...state,
    clubs: {
      ...state.clubs,
      [nextClub.id]: nextClub,
    },
    currentClub: nextClub,
    events: [
      ...(state.events ?? []),
      ...pending
        .filter((upgrade: TrainingGroundUpgrade) => upgrade.completesOn <= state.time.date)
        .map((upgrade: TrainingGroundUpgrade) => ({
          id: `event-training-complete-${upgrade.id}`,
          date: state.time.date,
          type: "milestone" as const,
          description: `${upgrade.description} completed to level ${upgrade.toLevel}.`,
        })),
    ],
  };

  return updatedState;
}

export function applyTrainingGroundMaintenance(state: GameState): GameState {
  const club = state.currentClub;
  if (!club || !club.trainingGround) return state;

  const ground = club.trainingGround;
  if (ground.lastMaintenanceDate === state.time.date) return state;
  const maintenanceCost = Math.round(
    assetValues(ground.facilities).reduce((sum, item) => sum + item.maintenanceCost, 0) * 0.35 +
      assetValues(ground.equipment).reduce((sum, item) => sum + item.maintenanceCost, 0) * 0.25,
  );
  const balance = parseMoney(state.finances?.balance ?? 0);
  const nextBalance = Math.max(0, balance - maintenanceCost);

  const nextFacilities = Object.fromEntries(
    assetEntries(ground.facilities).map(([key, item]) => [
      key,
      {
        ...item,
        condition: clampAsset(item.condition - 2, 30, 100),
      },
    ]),
  ) as typeof ground.facilities;

  const nextEquipment = Object.fromEntries(
    assetEntries(ground.equipment).map(([key, item]) => [
      key,
      {
        ...item,
        condition: clampAsset(item.condition - 2, 30, 100),
      },
    ]),
  ) as typeof ground.equipment;

  const nextGround: TrainingGroundState = {
    ...ground,
    facilities: nextFacilities,
    equipment: nextEquipment,
    condition: Math.round(
      (assetValues(nextFacilities).reduce((sum, item) => sum + item.condition, 0) +
        assetValues(nextEquipment).reduce((sum, item) => sum + item.condition, 0)) /
        (Object.keys(nextFacilities).length + Object.keys(nextEquipment).length),
    ),
    maintenanceCost,
    lastMaintenanceDate: state.time.date,
  };

  const nextClub: Club = {
    ...club,
    trainingGround: nextGround,
  };

  const maintenanceTransactionId = `training-ground-maintenance-${club.id}-${state.time.date}`;
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
          description: `${club.name}: training ground maintenance`,
          amount: -maintenanceCost,
          category: "expense" as const,
        },
      ];

  return {
    ...state,
    clubs: { ...state.clubs, [club.id]: nextClub },
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

registerDailyHook("events", (state) => completeTrainingGroundUpgrades(state));
registerDailyHook("finances", (state) => {
  if (!state.currentClub?.trainingGround) return state;
  const ground = state.currentClub.trainingGround;
  if (state.time.day % 7 === 0 || !ground.lastMaintenanceDate) {
    return applyTrainingGroundMaintenance(state);
  }
  return state;
});
