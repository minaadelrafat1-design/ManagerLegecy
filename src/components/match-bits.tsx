import type { CSSProperties, ReactNode } from "react";
import { T } from "./ui";

export interface MatchTeam {
  name: string;
  short: string;
  abbr: string;
  primary: string;
  secondary: string;
  text: string;
}

export interface PitchPlayer {
  id: string;
  shortName: string;
  number: number;
  pos: string;
  x: number;
  y: number;
  fitness: number;
  role?: string;
  tacticalConfig?: { instructions?: string[]; roleId?: string };
}

export type MatchEventType =
  | "goal"
  | "yellow"
  | "red"
  | "sub"
  | "chance"
  | "shot"
  | "foul"
  | "freekick"
  | "save"
  | "corner"
  | "info"
  | "whistle";

/** Optional structured metadata a generated event can carry. Purely additive —
 * existing consumers that only read minute/type/side/text/detail are unaffected. */
export interface MatchEventMeta {
  playerId?: string;
  assistId?: string;
  playerOffId?: string;
  playerInId?: string;
}

export interface MatchEvent {
  minute: number;
  type: MatchEventType;
  side: "home" | "away" | "neutral";
  text: string;
  detail?: string;
  meta?: MatchEventMeta;
}

export const EVENT_META: Record<MatchEventType, { glyph: string; color: string; label: string }> = {
  goal: { glyph: "⚽", color: T.green, label: "Goal" },
  yellow: { glyph: "▮", color: T.gold, label: "Booking" },
  red: { glyph: "▮", color: T.red, label: "Red card" },
  sub: { glyph: "⇄", color: T.textSec, label: "Substitution" },
  chance: { glyph: "✦", color: T.orange, label: "Chance" },
  shot: { glyph: "➤", color: T.cyan, label: "Shot" },
  foul: { glyph: "!", color: T.orange, label: "Foul" },
  freekick: { glyph: "⚑", color: T.blue, label: "Free kick" },
  save: { glyph: "✋", color: T.textSec, label: "Save" },
  corner: { glyph: "⚑", color: T.textSec, label: "Corner" },
  info: { glyph: "•", color: T.textMuted, label: "Info" },
  whistle: { glyph: "◷", color: T.textSec, label: "Whistle" },
};

/** Minutes-based fitness decay shared by every place that shows a live
 * condition/stamina readout (the pitch list, the bench, the focus panel),
 * so they never disagree with each other about the same player. */
export function currentCondition(baseFitness: number, minute: number): number {
  return Math.max(4, baseFitness - Math.floor(minute / 6));
}

export type MatchPhase = "attacking" | "defending";

const ATTACKING_ACTIVITY: Record<string, string> = {
  GK: "Distributing from the back",
  CB: "Stepping into midfield",
  RB: "Overlapping down the flank",
  LB: "Overlapping down the flank",
  CDM: "Shielding the back line",
  CM: "Linking the play",
  CAM: "Probing for space between the lines",
  RW: "Stretching the play wide",
  LW: "Stretching the play wide",
  ST: "Making a run in behind",
};

const DEFENDING_ACTIVITY: Record<string, string> = {
  GK: "Organising the defence",
  CB: "Holding the line",
  RB: "Tracking the winger",
  LB: "Tracking the winger",
  CDM: "Screening the back four",
  CM: "Covering midfield",
  CAM: "Tracking back",
  RW: "Pressing the fullback",
  LW: "Pressing the fullback",
  ST: "Leading the press",
};

/** What a selected player is doing right now. A recent event they were
 * actually involved in (real commentary text from the match engine) takes
 * priority over a generic line, so the description tracks the simulated
 * match rather than reading as a static label. */
export function describePlayerActivity(params: {
  pos: string;
  phase: MatchPhase;
  isBallCarrier: boolean;
}): string {
  const { pos, phase, isBallCarrier } = params;
  if (isBallCarrier) return "On the ball";
  const table = phase === "attacking" ? ATTACKING_ACTIVITY : DEFENDING_ACTIVITY;
  return table[pos] ?? (phase === "attacking" ? "Supporting the attack" : "Defending their zone");
}

/** Small pill showing whether a side is currently attacking (has the run of
 * play) or defending — derived from live possession/phase state so it moves
 * with the match rather than sitting fixed. */
export function PhaseBadge({ phase }: { phase: MatchPhase }) {
  const attacking = phase === "attacking";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: attacking ? T.green : T.textSec,
        background: attacking ? "rgba(47,224,138,0.12)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${attacking ? "rgba(47,224,138,0.35)" : T.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: attacking ? T.green : T.textMuted,
        }}
      />
      {attacking ? "Attacking" : "Defending"}
    </span>
  );
}

/** Thin condition/stamina bar, reused by the pitch list, bench and the
 * player focus panel so the same fitness number always looks the same. */
export function ConditionBar({ pct, width = 46 }: { pct: number; width?: number }) {
  return (
    <span
      style={{
        width,
        height: 4,
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        overflow: "hidden",
        flexShrink: 0,
        display: "inline-block",
      }}
      title={`Condition ${pct}%`}
    >
      <span
        style={{
          display: "block",
          height: "100%",
          width: `${Math.max(4, pct)}%`,
          background: pct > 75 ? T.green : pct > 55 ? T.orange : T.red,
        }}
      />
    </span>
  );
}

export function TeamCrest({ team, size = 40 }: { team: MatchTeam; size?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Chakra Petch', sans-serif",
        fontWeight: 900,
        fontSize: size * 0.34,
        letterSpacing: "-0.02em",
        color: team.text,
        background: `linear-gradient(150deg, ${team.primary} 0%, ${team.secondary} 100%)`,
        border: `1px solid rgba(255,255,255,0.16)`,
        boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
      }}
    >
      {team.abbr}
    </div>
  );
}

export function Panel({
  title,
  right,
  children,
  style,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      className="ml-panel"
      style={{
        backgroundColor: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "10px 14px",
          borderBottom: `1px solid ${T.border}`,
          background: "rgba(255,255,255,0.02)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.textSec,
            fontFamily: "'Chakra Petch', sans-serif",
          }}
        >
          {title}
        </h2>
        {right}
      </header>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

export function SplitStat({
  label,
  home,
  away,
  homeColor,
  awayColor,
  suffix = "",
}: {
  label: string;
  home: number;
  away: number;
  homeColor: string;
  awayColor: string;
  suffix?: string;
}) {
  const total = home + away || 1;
  const pct = (home / total) * 100;
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontFamily: "'Chakra Petch', sans-serif",
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
          {home}
          {suffix}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: T.textMuted,
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>
          {away}
          {suffix}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          height: 5,
          borderRadius: 999,
          overflow: "hidden",
          background: "rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ width: `${pct}%`, background: homeColor, transition: "width .6s ease" }} />
        <div style={{ flex: 1, background: awayColor, opacity: 0.85 }} />
      </div>
    </div>
  );
}
