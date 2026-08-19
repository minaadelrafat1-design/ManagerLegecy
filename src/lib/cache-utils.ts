/**
 * Simple cache utilities for performance optimizations.
 * Provides memoization with invalidation tracking.
 */

/** A simple memoization cache with a fixed max size and TTL.
 * Safe for deterministic pure functions where stale data = bugs.
 * Must be invalidated explicitly when the underlying data changes. */
export class MemoCache<K, V> {
  private map = new Map<string, { value: V; timestamp: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 1000, ttlMs = 60_000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.map.get(this.keyToString(key));
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.map.delete(this.keyToString(key));
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V): void {
    if (this.map.size >= this.maxSize) {
      // evict oldest entry
      const first = this.map.keys().next();
      if (first.done) return;
      this.map.delete(first.value);
    }
    this.map.set(this.keyToString(key), { value, timestamp: Date.now() });
  }

  invalidate(key: K): void {
    this.map.delete(this.keyToString(key));
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  private keyToString(key: K): string {
    if (typeof key === "string") return key;
    if (typeof key === "number") return String(key);
    try {
      return JSON.stringify(key);
    } catch {
      return String(key);
    }
  }
}

/** Invalidation token used to track data dependencies.
 * A higher generation means the data has changed.
 * Consumers compare generations to know if their cached value is stale. */
export class GenerationTracker {
  private generations = new Map<string, number>();

  /** Get the current generation for a key. Starts at 0. */
  get(key: string): number {
    return this.generations.get(key) ?? 0;
  }

  /** Bump the generation for a key, signaling data changed. */
  bump(key: string): void {
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);
  }

  /** Bump multiple keys at once. */
  bumpMany(keys: string[]): void {
    for (const key of keys) {
      this.bump(key);
    }
  }

  clear(): void {
    this.generations.clear();
  }
}

/** Global singleton trackers shared across the simulation. */
export const clubStrengthGen = new GenerationTracker();
export const leagueTableGen = new GenerationTracker();
