import type { GameState, RelationshipEntry, EntityType } from "./types";

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function relationshipId(
  aType: EntityType,
  aId: string | undefined,
  bType: EntityType,
  bId: string | undefined,
) {
  return `${aType}:${aId ?? ""}|${bType}:${bId ?? ""}`;
}

export function getRelationship(
  state: GameState,
  aType: EntityType,
  aId: string | undefined,
  bType: EntityType,
  bId: string | undefined,
): number | null {
  const rels = state.relationships ?? [];
  const id = relationshipId(aType, aId, bType, bId);
  const found = rels.find((r) => r.id === id || r.id === relationshipId(bType, bId, aType, aId));
  return found ? found.value : null;
}

export function setRelationship(
  state: GameState,
  aType: EntityType,
  aId: string | undefined,
  bType: EntityType,
  bId: string | undefined,
  value: number,
): GameState {
  const id = relationshipId(aType, aId, bType, bId);
  const next = { ...(state.relationships ?? {}) } as RelationshipEntry[];
  const idx = (state.relationships ?? []).findIndex(
    (r) => r.id === id || r.id === relationshipId(bType, bId, aType, aId),
  );
  const entry: RelationshipEntry = {
    id,
    aType,
    aId: aId ?? "",
    bType,
    bId: bId ?? "",
    value: clamp(value),
  };
  const newRels = [...(state.relationships ?? [])];
  if (idx >= 0) newRels[idx] = entry;
  else newRels.push(entry);
  return { ...state, relationships: newRels };
}

export function changeRelationship(
  state: GameState,
  aType: EntityType,
  aId: string | undefined,
  bType: EntityType,
  bId: string | undefined,
  delta: number,
): GameState {
  const current = getRelationship(state, aType, aId, bType, bId) ?? 50;
  return setRelationship(state, aType, aId, bType, bId, clamp(current + delta));
}

export function relationshipLabel(value: number) {
  if (value >= 80) return "Trusted";
  if (value >= 60) return "Positive";
  if (value >= 40) return "Neutral";
  if (value >= 20) return "Frustrated";
  return "Unhappy";
}

export default {};
