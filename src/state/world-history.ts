import type {
  GameState,
  HistoricalClubRecord,
  HistoricalManagerRecord,
  HistoricalPlayerRecord,
  HistoricalRecordSummary,
  WorldHistory,
} from "./types";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function deterministicId(prefix: string, seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= prefix.length;
  h = Math.imul(h, 16777619);
  return `${prefix}-${(h >>> 0).toString(36)}`;
}

export function createWorldHistory(): WorldHistory {
  return {
    lastUpdated: "",
    snapshotVersion: 1,
    clubRecords: [],
    playerRecords: [],
    managerRecords: [],
    records: [],
  };
}

function currentHistory(state: GameState): WorldHistory {
  if (state.history) return state.history;
  const fallback = createWorldHistory();
  return { ...fallback, lastUpdated: state.time.date };
}

function upsertUnique<T extends { id: string; uniqueKey?: string | undefined }>(
  items: T[],
  item: T,
): T[] {
  const key = item.uniqueKey ?? item.id;
  const next = [...items];
  const idx = next.findIndex((entry) => (entry.uniqueKey ?? entry.id) === key);
  if (idx >= 0) next[idx] = item;
  else next.push(item);
  return next;
}

export function recordClubHistory(
  state: GameState,
  record: Omit<HistoricalClubRecord, "id"> & { id?: string },
): GameState {
  const history = currentHistory(state);
  const item: HistoricalClubRecord = {
    ...record,
    id:
      record.id ??
      deterministicId(
        "club-history",
        `${history.clubRecords.length + 1}:${record.clubId}:${record.season ?? record.date}:${record.kind}:${record.title}`,
      ),
    uniqueKey:
      record.uniqueKey ??
      `${record.clubId}:${record.season ?? record.date}:${record.kind}:${record.title}`,
  };
  const nextHistory: WorldHistory = {
    ...history,
    clubRecords: upsertUnique(history.clubRecords, item),
    lastUpdated: state.time.date,
  };
  return { ...state, history: nextHistory, meta: { ...(state.meta ?? {}), history: nextHistory } };
}

export function recordPlayerHistory(
  state: GameState,
  record: Omit<HistoricalPlayerRecord, "id"> & { id?: string },
): GameState {
  const history = currentHistory(state);
  const item: HistoricalPlayerRecord = {
    ...record,
    id:
      record.id ??
      deterministicId(
        "player-history",
        `${history.playerRecords.length + 1}:${record.playerId}:${record.season ?? record.date}:${record.kind}:${record.title}`,
      ),
    uniqueKey:
      record.uniqueKey ??
      `${record.playerId}:${record.season ?? record.date}:${record.kind}:${record.title}`,
  };
  const nextHistory: WorldHistory = {
    ...history,
    playerRecords: upsertUnique(history.playerRecords, item),
    lastUpdated: state.time.date,
  };
  return { ...state, history: nextHistory, meta: { ...(state.meta ?? {}), history: nextHistory } };
}

export function recordManagerHistory(
  state: GameState,
  record: Omit<HistoricalManagerRecord, "id"> & { id?: string },
): GameState {
  const history = currentHistory(state);
  const item: HistoricalManagerRecord = {
    ...record,
    id:
      record.id ??
      deterministicId(
        "manager-history",
        `${history.managerRecords.length + 1}:${record.managerId}:${record.clubId}:${record.fromDate}:${record.toDate ?? "present"}`,
      ),
    uniqueKey:
      record.uniqueKey ??
      `${record.managerId}:${record.clubId}:${record.fromDate}:${record.toDate ?? "present"}`,
  };
  const nextHistory: WorldHistory = {
    ...history,
    managerRecords: upsertUnique(history.managerRecords, item),
    lastUpdated: state.time.date,
  };
  return { ...state, history: nextHistory, meta: { ...(state.meta ?? {}), history: nextHistory } };
}

export function updateHistoricalRecords(state: GameState): GameState {
  const history = currentHistory(state);
  const next: WorldHistory = { ...history, records: [] };

  const clubTitles = history.clubRecords.filter(
    (r) => r.kind === "league" || r.kind === "cup" || r.kind === "european",
  );
  const byClub: Record<string, number> = {};
  for (const r of clubTitles) byClub[r.clubId] = (byClub[r.clubId] ?? 0) + 1;
  for (const [clubId, total] of Object.entries(byClub)) {
    next.records.push({
      id: `title-total-${clubId}`,
      category: "titles",
      title: "Most honours",
      value: `${total}`,
      entityId: clubId,
      entityType: "club",
    });
  }

  const topScorer = history.playerRecords
    .filter((r) => r.kind === "award" || r.kind === "record")
    .sort((a, b) => Number((b.value ?? 0) - (a.value ?? 0)));
  if (topScorer.length > 0) {
    const top = topScorer[0];
    if (top) {
      const season = String(top.season ?? state.time.season);
      next.records.push({
        id: `top-scorer-${top.playerId}`,
        category: "scorers",
        title: "Top scorer record",
        value: `${top.value ?? 0}`,
        entityId: top.playerId,
        entityType: "player",
        season,
      });
    }
  }

  const transferRecords = history.playerRecords.filter((r) => r.kind === "transfer");
  if (transferRecords.length > 0) {
    const mostTransfers = [...transferRecords].sort((a, b) =>
      Number((b.value ?? 0) - (a.value ?? 0)),
    )[0];
    if (mostTransfers) {
      next.records.push({
        id: `transfer-record-${mostTransfers.playerId}`,
        category: "transfers",
        title: "Transfer record",
        value: `${mostTransfers.value ?? 0}`,
        entityId: mostTransfers.playerId,
        entityType: "player",
      });
    }
  }

  const managerTrophies = history.managerRecords.filter((r) => (r.trophies ?? 0) > 0);
  if (managerTrophies.length > 0) {
    const bestManager = [...managerTrophies].sort((a, b) =>
      Number((b.trophies ?? 0) - (a.trophies ?? 0)),
    )[0];
    if (bestManager) {
      next.records.push({
        id: `manager-record-${bestManager.managerId}`,
        category: "managers",
        title: "Most successful manager",
        value: `${bestManager.trophies ?? 0} trophies`,
        entityId: bestManager.managerId,
        entityType: "manager",
      });
    }
  }

  next.records = next.records.slice(0, 20);
  next.lastUpdated = state.time.date;
  return { ...state, history: next, meta: { ...(state.meta ?? {}), history: next } };
}

export function recordSeasonChampion(
  state: GameState,
  clubId: string,
  leagueName: string,
  season: string,
): GameState {
  const record = {
    clubId,
    season,
    date: state.time.date,
    kind: "league" as const,
    title: `${leagueName} champions`,
    summary: `${clubId} won ${leagueName} in ${season}`,
    uniqueKey: `champion:${clubId}:${season}:${leagueName}`,
  };
  return updateHistoricalRecords(recordClubHistory(state, record));
}

export function recordCupWinner(
  state: GameState,
  clubId: string,
  competitionName: string,
  season: string,
): GameState {
  const record = {
    clubId,
    season,
    date: state.time.date,
    kind: "cup" as const,
    title: `${competitionName} winners`,
    summary: `${clubId} won ${competitionName} in ${season}`,
    uniqueKey: `cup:${clubId}:${season}:${competitionName}`,
  };
  return updateHistoricalRecords(recordClubHistory(state, record));
}

export function recordEuropeanWinner(
  state: GameState,
  clubId: string,
  competitionName: string,
  season: string,
): GameState {
  const record = {
    clubId,
    season,
    date: state.time.date,
    kind: "european" as const,
    title: `${competitionName} winners`,
    summary: `${clubId} won ${competitionName} in ${season}`,
    uniqueKey: `europe:${clubId}:${season}:${competitionName}`,
  };
  return updateHistoricalRecords(recordClubHistory(state, record));
}

export function recordPromotion(
  state: GameState,
  clubId: string,
  fromDivision: string,
  toDivision: string,
  season: string,
): GameState {
  const record = {
    clubId,
    season,
    date: state.time.date,
    kind: "promotion" as const,
    title: `Promotion to ${toDivision}`,
    summary: `${clubId} promoted from ${fromDivision} to ${toDivision} in ${season}`,
    uniqueKey: `promo:${clubId}:${season}:${fromDivision}->${toDivision}`,
  };
  return updateHistoricalRecords(recordClubHistory(state, record));
}

export function recordRelegation(
  state: GameState,
  clubId: string,
  fromDivision: string,
  toDivision: string,
  season: string,
): GameState {
  const record = {
    clubId,
    season,
    date: state.time.date,
    kind: "relegation" as const,
    title: `Relegation to ${toDivision}`,
    summary: `${clubId} relegated from ${fromDivision} to ${toDivision} in ${season}`,
    uniqueKey: `releg:${clubId}:${season}:${fromDivision}->${toDivision}`,
  };
  return updateHistoricalRecords(recordClubHistory(state, record));
}

export function recordMajorTransfer(
  state: GameState,
  playerId: string,
  fromClubId: string,
  toClubId: string,
  fee: number,
  date: string,
): GameState {
  const player = state.players[playerId];
  const transferState = recordClubHistory(state, {
    clubId: toClubId,
    season: String(state.time.season),
    date,
    kind: "record",
    title: "Major transfer recorded",
    summary: `${player?.name ?? playerId} signed from ${fromClubId}`,
    value: fee,
    uniqueKey: `transfer-club:${toClubId}:${playerId}:${date}`,
  });
  const withPlayer = recordPlayerHistory(transferState, {
    playerId,
    clubId: toClubId,
    season: String(state.time.season),
    date,
    kind: "transfer",
    title: "Major transfer",
    summary: `${player?.name ?? playerId} moved to ${toClubId}`,
    value: fee,
    uniqueKey: `transfer-player:${playerId}:${date}`,
  });
  return updateHistoricalRecords(withPlayer);
}

export function recordManagerEra(
  state: GameState,
  managerId: string,
  clubId: string,
  fromDate: string,
  toDate: string | undefined,
  title: string,
  summary: string,
  trophies: number = 0,
): GameState {
  const record = {
    managerId,
    clubId,
    fromDate,
    toDate: toDate ?? undefined,
    title,
    summary,
    trophies,
    active: !toDate,
    uniqueKey: `era:${managerId}:${clubId}:${fromDate}:${toDate ?? "present"}`,
  };
  return updateHistoricalRecords(recordManagerHistory(state, record));
}

export function recordRetirement(
  state: GameState,
  playerId: string,
  age: number,
  clubId?: string,
): GameState {
  const player = state.players[playerId];
  const safeClubId = clubId ?? state.players[playerId]?.clubId ?? state.currentClub?.id;
  return updateHistoricalRecords(
    recordPlayerHistory(state, {
      playerId,
      clubId: safeClubId,
      date: state.time.date,
      kind: "retirement",
      title: `Retired at ${age}`,
      summary: `${player?.name ?? playerId} retired at age ${age}`,
      value: age,
      uniqueKey: `retirement:${playerId}:${state.time.date}`,
    }),
  );
}

export function recordClubAchievement(
  state: GameState,
  clubId: string,
  season: string,
  kind: HistoricalClubRecord["kind"],
  title: string,
  summary: string,
  value?: number,
): GameState {
  return updateHistoricalRecords(
    recordClubHistory(state, {
      clubId,
      season,
      date: state.time.date,
      kind,
      title,
      summary,
      value: value ?? undefined,
      uniqueKey: `achievement:${clubId}:${season}:${kind}:${title}`,
    }),
  );
}

export function sanitizeWorldHistory(state: GameState): GameState {
  const history = currentHistory(state);
  const dedupedClubRecords = [] as HistoricalClubRecord[];
  const dedupedPlayerRecords = [] as HistoricalPlayerRecord[];
  const dedupedManagerRecords = [] as HistoricalManagerRecord[];
  const clubKeys = new Set<string>();
  const playerKeys = new Set<string>();
  const managerKeys = new Set<string>();

  for (const record of history.clubRecords) {
    const key =
      record.uniqueKey ??
      `${record.clubId}:${record.season ?? record.date}:${record.kind}:${record.title}`;
    if (!clubKeys.has(key)) {
      clubKeys.add(key);
      dedupedClubRecords.push(record);
    }
  }
  for (const record of history.playerRecords) {
    const key =
      record.uniqueKey ??
      `${record.playerId}:${record.season ?? record.date}:${record.kind}:${record.title}`;
    if (!playerKeys.has(key)) {
      playerKeys.add(key);
      dedupedPlayerRecords.push(record);
    }
  }
  for (const record of history.managerRecords) {
    const key =
      record.uniqueKey ??
      `${record.managerId}:${record.clubId}:${record.fromDate}:${record.toDate ?? "present"}`;
    if (!managerKeys.has(key)) {
      managerKeys.add(key);
      dedupedManagerRecords.push(record);
    }
  }

  const cleaned: WorldHistory = {
    ...history,
    clubRecords: dedupedClubRecords,
    playerRecords: dedupedPlayerRecords,
    managerRecords: dedupedManagerRecords,
    lastUpdated: state.time.date,
  };

  return { ...state, history: cleaned, meta: { ...(state.meta ?? {}), history: cleaned } };
}

export function getHistoryStats(state: GameState) {
  const history = currentHistory(state);
  const clubCount = history.clubRecords.length;
  const playerCount = history.playerRecords.length;
  const managerCount = history.managerRecords.length;
  return {
    clubCount,
    playerCount,
    managerCount,
    records: history.records.length,
  };
}

export function applyWorldHistoryInvariants(state: GameState): GameState {
  let next = sanitizeWorldHistory(state);
  const history = next.history ?? createWorldHistory();
  const activeRetired = new Set(
    Object.values(next.players)
      .filter((p) => p.status === "retired")
      .map((p) => p.id),
  );
  const playerRecords = history.playerRecords.filter(
    (r) => !activeRetired.has(r.playerId) || r.kind === "retirement",
  );
  const clubRecords = history.clubRecords.filter((r) => !!r.clubId);
  const managerRecords = history.managerRecords.filter((r) => !!r.managerId && !!r.clubId);
  const cleanedHistory: WorldHistory = {
    ...history,
    playerRecords,
    clubRecords,
    managerRecords,
    lastUpdated: next.time.date,
  };
  next = { ...next, history: cleanedHistory };
  next = { ...next, meta: { ...(next.meta ?? {}), history: cleanedHistory } };
  return next;
}

/**
 * Archive world history records older than 5 seasons to prevent unbounded growth.
 * Keeps only recent history to reduce state size in mature careers.
 * Should be called periodically (e.g., once per season).
 */
export function archiveOldWorldHistory(state: GameState): GameState {
  const history = currentHistory(state);

  // Calculate 5 seasons back (approximately 5 years = 1825 days)
  const fiveYearsInDays = 1825;
  const archiveDate = new Date(state.time.date);
  archiveDate.setDate(archiveDate.getDate() - fiveYearsInDays);
  const archiveDateStr = archiveDate.toISOString().split("T")[0];

  // Keep only recent records
  const playerRecords = history.playerRecords.filter((r) => (r.date ?? r.season) >= archiveDateStr);
  const clubRecords = history.clubRecords.filter((r) => (r.date ?? r.season) >= archiveDateStr);
  const managerRecords = history.managerRecords.filter((r) => (r.date ?? r.season) >= archiveDateStr);

  const archivedHistory: WorldHistory = {
    ...history,
    playerRecords,
    clubRecords,
    managerRecords,
    lastUpdated: state.time.date,
  };

  return {
    ...state,
    history: archivedHistory,
    meta: { ...(state.meta ?? {}), history: archivedHistory },
  };
}

export function createHistorySnapshot(state: GameState): Record<string, unknown> {
  const history = currentHistory(state);
  return {
    season: state.time.season,
    date: state.time.date,
    clubRecords: history.clubRecords.slice(-10),
    playerRecords: history.playerRecords.slice(-10),
    managerRecords: history.managerRecords.slice(-10),
    records: history.records.slice(0, 10),
  };
}

export default {
  createWorldHistory,
  recordClubHistory,
  recordPlayerHistory,
  recordManagerHistory,
  updateHistoricalRecords,
  recordSeasonChampion,
  recordCupWinner,
  recordEuropeanWinner,
  recordPromotion,
  recordRelegation,
  recordMajorTransfer,
  recordManagerEra,
  recordRetirement,
  recordClubAchievement,
  sanitizeWorldHistory,
  createHistorySnapshot,
  applyWorldHistoryInvariants,
};
