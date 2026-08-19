// small deterministic seeded unit used across modules
export function seededUnit(seedStr: string, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seedStr.length; i++) h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  h += h << 13;
  h ^= h >>> 7;
  h += h << 3;
  h ^= h >>> 17;
  h += h << 5;
  return ((h >>> 0) % 100000) / 100000;
}

export function deterministicId(prefix: string, seed: string, sequence: number): string {
  const value = Math.floor(seededUnit(`${seed}:${sequence}`, 97) * 0xffffffff).toString(36);
  return `${prefix}-${sequence}-${value}`;
}
