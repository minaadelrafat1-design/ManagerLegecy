/* =============================================================================
 * Persistence service
 * =============================================================================
 * The single place in the app allowed to touch `window.localStorage`. Every
 * feature that needs to persist something (the authoritative GameState, the
 * Tactics screen's dials, anything added later) goes through the functions
 * below instead of reading/writing storage itself — that's what "don't
 * scatter localStorage calls throughout components" means in practice.
 *
 * Storage format: every save is wrapped in a small envelope —
 *   { version: number, savedAt: string, data: T }
 * — instead of writing the raw object. The version travels WITH the data,
 * so a future schema change can tell old saves apart from new ones and
 * migrate them, and a save that isn't in this shape at all (or isn't valid
 * JSON) is unambiguously "corrupted" rather than silently misread.
 * ---------------------------------------------------------------------------*/

export interface SaveEnvelope<T> {
  version: number;
  savedAt: string;
  data: T;
}

export type LoadResult<T> =
  | { status: "ok"; data: T; savedAt: string }
  | { status: "missing" }
  | { status: "corrupted"; reason: string };

/** Upgrades data written at version N to the shape version N+1 expects.
 * `migrations[N]` is the step FROM N TO N+1. Register one entry per version
 * bump — see the usage note at the bottom of this file. */
export type MigrationMap<T> = Record<number, (data: unknown) => unknown> & {
  __brand?: T;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isEnvelope(value: unknown): value is SaveEnvelope<unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    "version" in value &&
    typeof (value as { version: unknown }).version === "number" &&
    "data" in value
  );
}

/** Persists `data` under `key`, wrapped with `version` and a timestamp.
 * Returns whether the write succeeded — callers decide how much to care
 * (the game state provider logs a warning; nothing crashes either way). */
export function saveToStorage<T>(key: string, version: number, data: T): boolean {
  if (!isBrowser()) return false;
  try {
    const envelope: SaveEnvelope<T> = { version, savedAt: new Date().toISOString(), data };
    window.localStorage.setItem(key, JSON.stringify(envelope));
    return true;
  } catch (err) {
    // Storage disabled, quota exceeded, private-browsing restrictions, ...
    // — persistence is best-effort and should never break the app.
    // CRITICAL: Log the failure so we don't silently lose data
    const errorStr = String(err);
    if (errorStr.includes("QuotaExceededError") || errorStr.includes("quota")) {
      console.error(
        "[GameState] CRITICAL: localStorage quota exceeded! Save failed. Player data may be lost on browser close.",
      );
    } else if (errorStr.includes("NS_ERROR_FILE_CORRUPTED")) {
      console.error("[GameState] Storage is corrupted and cannot be written to.");
    } else if (errorStr.includes("DisabledByUser") || errorStr.includes("private")) {
      console.warn("[GameState] localStorage is disabled (private browsing or user settings).");
    } else {
      console.warn(`[GameState] Save failed: ${errorStr}`);
    }
    return false;
  }
}

/**
 * Reads `key` back and returns one of three explicit outcomes so callers
 * never have to guess:
 *  - `missing`   — nothing has been saved yet (first run, or storage
 *                   unavailable in this environment).
 *  - `corrupted` — something is there but it isn't a save this app can
 *                   trust (bad JSON, no envelope, a version newer than this
 *                   build understands, or a migration step failed).
 *  - `ok`        — a valid save, upgraded to `currentVersion` if needed.
 *
 * A save at an older version is run through `migrations` one step at a
 * time (`migrations[storedVersion]`, then `migrations[storedVersion+1]`,
 * ...) until it reaches `currentVersion`. Corrupted data is never thrown —
 * it's reported so the caller can fall back to a fresh state instead of
 * crashing the app on load.
 */
export function loadFromStorage<T>(
  key: string,
  currentVersion: number,
  migrations: MigrationMap<T> = {},
): LoadResult<T> {
  if (!isBrowser()) return { status: "missing" };

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return { status: "corrupted", reason: "localStorage is unavailable" };
  }
  if (!raw) return { status: "missing" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "corrupted", reason: "stored value is not valid JSON" };
  }

  if (!isEnvelope(parsed)) {
    return { status: "corrupted", reason: "stored value is missing the version/data envelope" };
  }

  let version = parsed.version;
  let data = parsed.data;

  if (version > currentVersion) {
    return {
      status: "corrupted",
      reason: `save is from a newer version (${version}) than this build supports (${currentVersion})`,
    };
  }

  while (version < currentVersion) {
    const migrate = migrations[version];
    if (!migrate) {
      return {
        status: "corrupted",
        reason: `no migration registered from version ${version} to ${version + 1}`,
      };
    }
    try {
      data = migrate(data);
    } catch (err) {
      return {
        status: "corrupted",
        reason: `migration ${version} -> ${version + 1} failed: ${String(err)}`,
      };
    }
    version += 1;
  }

  return { status: "ok", data: data as T, savedAt: parsed.savedAt };
}

export function clearStorage(key: string): boolean {
  if (!isBrowser()) return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/*
 * Adding a future migration:
 *
 *   export const GAME_STATE_VERSION = 2; // bumped from 1
 *   const migrations: MigrationMap<GameState> = {
 *     // shape at version 1 -> shape version 2 expects
 *     1: (data) => ({ ...(data as object), someNewField: "default" }),
 *   };
 *   loadFromStorage(KEY, GAME_STATE_VERSION, migrations);
 *
 * Each entry only has to know how to step forward one version; the loader
 * chains them, so a save several versions behind still upgrades cleanly.
 */
