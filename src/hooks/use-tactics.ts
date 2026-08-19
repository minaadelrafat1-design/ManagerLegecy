import { useCallback, useEffect, useState } from "react";
import type { TeamTactics } from "@/lib/match-engine";
import { loadFromStorage, saveToStorage } from "@/state/persistence";

export interface TacticsInstructions {
  outFromBack: boolean;
  counterPress: boolean;
  workIntoBox: boolean;
  fullBacksWide: boolean;
}

export interface TacticsSettings {
  mentality: number; // 0-100, 0 = ultra-defensive .. 100 = ultra-attacking
  width: number; // 0-100
  depth: number; // 0-100, defensive line height
  tempo: number; // 0-100
  pressing: number; // 0-100
  instructions: TacticsInstructions;
}

// Matches what the Tactics screen has always shown (Width 68 / Depth 55 /
// Tempo 72 / Pressing 60), so wiring it up doesn't change the first match a
// manager who hasn't touched anything sees.
export const DEFAULT_TACTICS_SETTINGS: TacticsSettings = {
  mentality: 55,
  width: 68,
  depth: 55,
  tempo: 72,
  pressing: 60,
  instructions: {
    outFromBack: false,
    counterPress: false,
    workIntoBox: false,
    fullBacksWide: false,
  },
};

const STORAGE_KEY = "ml_tactics_settings";
const TACTICS_VERSION = 1;

function loadStored(): TacticsSettings {
  const result = loadFromStorage<Partial<TacticsSettings>>(STORAGE_KEY, TACTICS_VERSION);
  if (result.status !== "ok") return DEFAULT_TACTICS_SETTINGS;
  const parsed = result.data;
  return {
    ...DEFAULT_TACTICS_SETTINGS,
    ...parsed,
    instructions: { ...DEFAULT_TACTICS_SETTINGS.instructions, ...(parsed.instructions ?? {}) },
  };
}

function save(settings: TacticsSettings) {
  saveToStorage(STORAGE_KEY, TACTICS_VERSION, settings);
}

/** Small localStorage-backed hook so tactical choices made on the Tactics
 * screen persist and can be read back by the Matchday screen. There's only
 * one user-controlled team, so a single stored settings object (no routing
 * or per-team keys) keeps this proportional to what the app actually needs. */
export function useTacticsSettings() {
  // Start from the default on both server and first client render so
  // hydration matches; the real (possibly localStorage-backed) value loads
  // right after mount.
  const [settings, setSettings] = useState<TacticsSettings>(DEFAULT_TACTICS_SETTINGS);

  useEffect(() => {
    setSettings(loadStored());
  }, []);

  const setDial = useCallback((key: keyof Omit<TacticsSettings, "instructions">, value: number) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      save(next);
      return next;
    });
  }, []);

  const toggleInstruction = useCallback((key: keyof TacticsInstructions) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        instructions: { ...prev.instructions, [key]: !prev.instructions[key] },
      };
      save(next);
      return next;
    });
  }, []);

  return { settings, setDial, toggleInstruction };
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Maps the raw dials + instruction toggles from the Tactics screen into the
 * `TeamTactics` shape the match engine consumes. Each instruction just nudges
 * the dial it most obviously relates to — kept as flat, explainable deltas
 * rather than a second layer of modelling. */
export function deriveTeamTactics(s: TacticsSettings): TeamTactics {
  const directness = clamp(
    48 + (s.instructions.workIntoBox ? 14 : 0) - (s.instructions.outFromBack ? 10 : 0),
  );
  const pressing = clamp(s.pressing + (s.instructions.counterPress ? 12 : 0));
  const width = clamp(s.width + (s.instructions.fullBacksWide ? 10 : 0));
  return { tempo: s.tempo, pressing, directness, mentality: s.mentality, width, depth: s.depth };
}

export function mentalityLabel(v: number): string {
  if (v < 30) return "Very Defensive";
  if (v < 46) return "Defensive";
  if (v < 62) return "Balanced";
  if (v < 80) return "Attacking";
  return "Very Attacking";
}
