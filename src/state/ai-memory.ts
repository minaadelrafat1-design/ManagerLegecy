import type { GameState } from "./types";
import type { MemoryItem, MemoryKind, ClubMemory } from "./types";

// Bounded memory size per club. Chosen small to keep memory useful.
export const MEMORY_MAX_ITEMS = 40;

function nowISO(state: GameState) {
  return state.time?.date ?? "1970-01-01";
}

function makeId(kind: MemoryKind, state: GameState, clubId?: string) {
  // deterministic id based on existing memory length + kind + date
  const date = nowISO(state);
  const key = clubId ?? "global";
  const prevLen = (state.clubs[key]?.aiMemory?.items?.length ?? 0) + 1;
  return `mem-${kind}-${date}-${prevLen}-${key.slice(0, 6)}`;
}

export function getClubMemory(state: GameState, clubId: string): ClubMemory {
  const club = state.clubs[clubId];
  if (!club) return { items: [] };
  return club.aiMemory ?? { items: [] };
}

export function addClubMemory(
  state: GameState,
  clubId: string,
  item: Omit<MemoryItem, "id" | "date">,
): GameState {
  const club = state.clubs[clubId];
  if (!club) return state;
  const date = nowISO(state);
  const id = makeId(item.kind, state, clubId);
  const full: MemoryItem = { id, date, ...item } as MemoryItem;

  const prev = club.aiMemory?.items ?? [];
  const nextItems = [...prev, full].slice(-MEMORY_MAX_ITEMS);
  const counts: Partial<Record<MemoryKind, number>> = {};
  for (const it of nextItems) counts[it.kind] = (counts[it.kind] ?? 0) + 1;

  const nextClub = { ...club, aiMemory: { items: nextItems, counts } };

  return { ...state, clubs: { ...state.clubs, [clubId]: nextClub } };
}

export function clearClubMemory(state: GameState, clubId: string): GameState {
  const club = state.clubs[clubId];
  if (!club) return state;
  const nextClub = { ...club, aiMemory: { items: [], counts: {} } };
  return { ...state, clubs: { ...state.clubs, [clubId]: nextClub } };
}

export default {
  getClubMemory,
  addClubMemory,
  clearClubMemory,
  MEMORY_MAX_ITEMS,
};
