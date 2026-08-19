import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from "react";

// ─── Tokens ──────────────────────────────────────────────────────────────────

export const T = {
  /* Page background is painted globally (charcoal + navy/stadium-green wash),
     so screens stay transparent and sit on one continuous atmosphere. */
  bg: "transparent",
  bgSolid: "#040A1E",
  bgMid: "#334155",
  ink: "#02122B",
  card: "rgba(10,26,58,0.90)",
  cardRaised: "rgba(16,38,80,0.94)",
  border: "rgba(88,164,255,0.20)",
  borderMid: "rgba(88,164,255,0.38)",
  green: "#2FE08A",
  greenDeep: "#0F8F58",
  greenDim: "rgba(47,224,138,0.14)",
  blue: "#3AA0FF",
  cyan: "#4FDBFF",
  blueDim: "rgba(58,160,255,0.16)",
  gold: "#F0C24B",
  goldDim: "rgba(240,194,75,0.14)",
  red: "#FF5A62",
  redDim: "rgba(255,90,98,0.14)",
  orange: "#FF9F45",
  orangeDim: "rgba(255,159,69,0.14)",
  text: "#EAF3FF",
  textSec: "#8FAAD4",
  textMuted: "#5B7299",
};

// ─── Buttons ─────────────────────────────────────────────────────────────────

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  icon?: ReactNode;
  style?: CSSProperties;
}

export function PrimaryButton({
  children,
  onClick,
  fullWidth,
  size = "md",
  disabled,
  icon,
  style,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const padding = size === "sm" ? "8px 16px" : size === "lg" ? "16px 28px" : "12px 22px";
  const fontSize = size === "sm" ? "13px" : size === "lg" ? "16px" : "14px";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: fullWidth ? "100%" : "auto",
        padding,
        fontSize,
        fontFamily: "'Chakra Petch', sans-serif",
        fontWeight: 800,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        color: disabled ? T.textMuted : T.ink,
        background: disabled
          ? "rgba(255,255,255,0.06)"
          : `linear-gradient(180deg, #4CF0A4 0%, ${T.green} 52%, ${T.greenDeep} 100%)`,
        border: `1px solid ${disabled ? T.border : "rgba(255,255,255,0.18)"}`,
        borderRadius: 9,
        boxShadow: disabled
          ? "none"
          : "inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 20px -12px rgba(47,224,138,0.75)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : pressed ? 0.9 : 1,
        transform: pressed ? "translateY(1px)" : "translateY(0)",
        transition: "opacity 0.18s ease, transform 0.12s ease, box-shadow 0.18s ease",
        outline: "none",
      }}
    >
      {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  onClick,
  fullWidth,
  size = "md",
  disabled,
  icon,
  style,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const padding = size === "sm" ? "7px 15px" : size === "lg" ? "15px 27px" : "11px 21px";
  const fontSize = size === "sm" ? "13px" : size === "lg" ? "16px" : "14px";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: fullWidth ? "100%" : "auto",
        padding,
        fontSize,
        fontFamily: "'Chakra Petch', sans-serif",
        fontWeight: 700,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        color: disabled ? T.textMuted : T.text,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
        border: `1px solid ${disabled ? T.border : T.borderMid}`,
        borderRadius: 9,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        transform: pressed ? "translateY(1px)" : "translateY(0)",
        transition: "opacity 0.18s ease, transform 0.12s ease, border-color 0.18s ease",
        outline: "none",
      }}
    >
      {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
  fullWidth,
  size = "md",
  disabled,
  icon,
  style,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);
  const padding = size === "sm" ? "7px 14px" : size === "lg" ? "15px 26px" : "11px 20px";
  const fontSize = size === "sm" ? "13px" : size === "lg" ? "16px" : "14px";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: fullWidth ? "100%" : "auto",
        padding,
        fontSize,
        fontFamily: "'Chakra Petch', sans-serif",
        fontWeight: 600,
        color: T.green,
        background: pressed ? T.greenDim : "transparent",
        border: "none",
        borderRadius: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s",
        outline: "none",
      }}
    >
      {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
      {children}
    </button>
  );
}

// ─── Cards ───────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  raised?: boolean;
  onClick?: () => void;
  noPad?: boolean;
}

export function Card({ children, style, raised, onClick, noPad }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={[
        "ml-panel",
        raised ? "ml-panel-raised" : "",
        onClick ? "ml-panel-interactive" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: raised ? T.cardRaised : T.card,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        padding: noPad ? 0 : 16,
        overflow: noPad ? "hidden" : undefined,
        boxShadow: raised
          ? "0 20px 40px -28px rgba(0,0,0,0.92)"
          : "0 10px 26px -22px rgba(0,0,0,0.8)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Rating Badge ─────────────────────────────────────────────────────────────

interface RatingBadgeProps {
  value: number;
  size?: "sm" | "md" | "lg";
}

function getRatingColor(v: number) {
  if (v >= 85) return { bg: T.goldDim, text: T.gold, border: `rgba(245,196,81,0.3)` };
  if (v >= 75) return { bg: T.greenDim, text: T.green, border: `rgba(47,224,138,0.3)` };
  if (v >= 65)
    return { bg: "rgba(255,159,67,0.12)", text: T.orange, border: `rgba(255,159,67,0.3)` };
  return { bg: T.redDim, text: T.red, border: `rgba(239,83,80,0.3)` };
}

export function RatingBadge({ value, size = "md" }: RatingBadgeProps) {
  const colors = getRatingColor(value);
  const dim = size === "sm" ? 30 : size === "lg" ? 48 : 38;
  const fontSize = size === "sm" ? "12px" : size === "lg" ? "18px" : "14px";

  return (
    <div
      style={{
        width: dim,
        height: dim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        fontSize,
        fontWeight: 800,
        color: colors.text,
        fontFamily: "'Chakra Petch', sans-serif",
        letterSpacing: "-0.02em",
        flexShrink: 0,
      }}
    >
      {value}
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

type StatusType =
  "available" | "injured" | "suspended" | "retired" | "transferlisted" | "warning" | "new" | "live";

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

const STATUS_CONFIG: Record<StatusType, { bg: string; text: string; dot: string; label: string }> =
  {
    available: { bg: T.greenDim, text: T.green, dot: T.green, label: "Available" },
    injured: { bg: T.redDim, text: T.red, dot: T.red, label: "Injured" },
    suspended: { bg: T.orangeDim, text: T.orange, dot: T.orange, label: "Suspended" },
    retired: { bg: T.border, text: T.textSec, dot: T.textMuted, label: "Retired" },
    transferlisted: { bg: T.goldDim, text: T.gold, dot: T.gold, label: "Listed" },
    warning: { bg: T.orangeDim, text: T.orange, dot: T.orange, label: "Warning" },
    new: { bg: T.greenDim, text: T.green, dot: T.green, label: "New" },
    live: { bg: T.redDim, text: T.red, dot: T.red, label: "Live" },
  };

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  const isLive = status === "live";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        background: cfg.bg,
        borderRadius: 999,
        fontSize: "11px",
        fontWeight: 700,
        fontFamily: "'Chakra Petch', sans-serif",
        color: cfg.text,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: cfg.dot,
          flexShrink: 0,
          animation: isLive ? "pulse 1.2s infinite" : undefined,
        }}
      />
      {label ?? cfg.label}
    </span>
  );
}

// ─── Stat Bar ─────────────────────────────────────────────────────────────────

interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
}

export function StatBar({ label, value, max = 100, color }: StatBarProps) {
  const pct = Math.min(100, (value / max) * 100);
  const barColor = color ?? (pct >= 80 ? T.green : pct >= 60 ? T.orange : T.red);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 64,
          fontSize: "11px",
          fontWeight: 600,
          color: T.textSec,
          flexShrink: 0,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          height: 4,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: barColor,
            borderRadius: 2,
            transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
      <span
        style={{
          width: 26,
          fontSize: "12px",
          fontWeight: 700,
          color: T.text,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Slider Bar (interactive StatBar) ──────────────────────────────────────────

interface SliderBarProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  color?: string;
}

/** Same look as StatBar, but draggable/keyboard-adjustable — for tactical
 * dials the manager actually sets, rather than read-only ratings. */
export function SliderBar({ label, value, onChange, min = 0, max = 100, color }: SliderBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;
  const barColor = color ?? T.green;

  const updateFromClientX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = rect.width > 0 ? Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) : 0;
    onChange(Math.round(min + ratio * (max - min)));
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 64,
          fontSize: "11px",
          fontWeight: 600,
          color: T.textSec,
          flexShrink: 0,
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          updateFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          updateFromClientX(e.clientX);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(max, value + 1));
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(min, value - 1));
        }}
        style={{
          flex: 1,
          height: 16,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          touchAction: "none",
          outline: "none",
        }}
      >
        <div
          style={{
            width: "100%",
            height: 4,
            background: "rgba(255,255,255,0.07)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: barColor,
              borderRadius: 2,
              transition: "width 0.12s ease",
            }}
          />
        </div>
      </div>
      <span
        style={{
          width: 26,
          fontSize: "12px",
          fontWeight: 700,
          color: T.text,
          textAlign: "right",
          flexShrink: 0,
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  color?: string;
  sublabel?: string;
}

export function ProgressBar({ label, value, max, color = T.green, sublabel }: ProgressBarProps) {
  const pct = Math.min(100, (value / max) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: T.text }}>{label}</span>
        <span style={{ fontSize: "12px", fontWeight: 600, color: T.textSec }}>
          {sublabel ?? `${value} / ${max}`}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: "rgba(255,255,255,0.07)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 3,
            transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Player Card ──────────────────────────────────────────────────────────────

interface PlayerCardProps {
  name: string;
  position: string;
  rating: number;
  nationality: string;
  age: number;
  stats: { label: string; value: number }[];
  status?: StatusType;
  value?: string;
  wage?: string;
  compact?: boolean;
}

export function PlayerCard({
  name,
  position,
  rating,
  nationality,
  age,
  stats,
  status,
  value,
  compact,
}: PlayerCardProps) {
  if (compact) {
    return (
      <Card style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
        <RatingBadge value={rating} size="md" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: T.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: T.textSec,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {position}
            </span>
            <span style={{ fontSize: "11px", color: T.textMuted }}>·</span>
            <span style={{ fontSize: "11px", color: T.textSec }}>{nationality}</span>
            <span style={{ fontSize: "11px", color: T.textMuted }}>·</span>
            <span style={{ fontSize: "11px", color: T.textSec }}>{age}y</span>
          </div>
        </div>
        {status && <StatusBadge status={status} />}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M6 12l4-4-4-4"
            stroke={T.textMuted}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Card>
    );
  }

  return (
    <Card raised>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
        <RatingBadge value={rating} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
            <span
              style={{ fontSize: "16px", fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}
            >
              {name}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: T.green,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              {position}
            </span>
            <span style={{ color: T.textMuted, fontSize: "11px" }}>·</span>
            <span style={{ fontSize: "12px", color: T.textSec }}>{nationality}</span>
            <span style={{ color: T.textMuted, fontSize: "11px" }}>·</span>
            <span style={{ fontSize: "12px", color: T.textSec }}>{age} yrs</span>
          </div>
          {value && (
            <div style={{ marginTop: 6, fontSize: "13px", fontWeight: 700, color: T.gold }}>
              {value}
            </div>
          )}
        </div>
        {status && <StatusBadge status={status} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {stats.map((s) => (
          <StatBar key={s.label} label={s.label} value={s.value} />
        ))}
      </div>
    </Card>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface TabsProps {
  tabs: string[];
  active: number;
  onChange: (i: number) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div
      style={{
        display: "flex",
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: 3,
        gap: 2,
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.45)",
      }}
    >
      {tabs.map((tab, i) => (
        <button
          key={tab}
          className="ml-nav-link"
          onClick={() => onChange(i)}
          style={{
            flex: 1,
            padding: "8px 4px",
            fontSize: "12px",
            fontFamily: "'Chakra Petch', sans-serif",
            fontWeight: active === i ? 800 : 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: active === i ? T.text : T.textSec,
            background:
              active === i
                ? "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)"
                : "transparent",
            border: active === i ? `1px solid ${T.borderMid}` : "1px solid transparent",
            borderRadius: 8,
            boxShadow: active === i ? `inset 0 -2px 0 ${T.green}` : "none",
            cursor: "pointer",
            outline: "none",
            whiteSpace: "nowrap",
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ─── Pill Tabs ────────────────────────────────────────────────────────────────

export function PillTabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
      {tabs.map((tab, i) => (
        <button
          key={tab}
          className="ml-nav-link"
          onClick={() => onChange(i)}
          style={{
            padding: "7px 14px",
            fontSize: "12px",
            fontFamily: "'Chakra Petch', sans-serif",
            fontWeight: active === i ? 800 : 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: active === i ? T.ink : T.textSec,
            background:
              active === i
                ? `linear-gradient(180deg, #4CF0A4 0%, ${T.green} 55%, ${T.greenDeep} 100%)`
                : "rgba(255,255,255,0.04)",
            border: `1px solid ${active === i ? "rgba(255,255,255,0.2)" : T.border}`,
            borderRadius: 999,
            boxShadow:
              active === i
                ? "inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 16px -10px rgba(47,224,138,0.8)"
                : "none",
            cursor: "pointer",
            outline: "none",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ─── Bottom Navigation ────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  icon: ReactNode;
}

interface BottomNavProps {
  items: NavItem[];
  active: number;
  onChange: (i: number) => void;
}

export function BottomNav({ items, active, onChange }: BottomNavProps) {
  return (
    <div
      style={{
        display: "flex",
        background: T.card,
        borderTop: `1px solid ${T.border}`,
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}
    >
      {items.map((item, i) => {
        const isActive = active === i;
        return (
          <button
            key={item.label}
            onClick={() => onChange(i)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              padding: "12px 4px 10px",
              background: "none",
              border: "none",
              cursor: "pointer",
              outline: "none",
              color: isActive ? T.green : T.textMuted,
              transition: "color 0.15s",
            }}
          >
            <span style={{ display: "flex", alignItems: "center" }}>{item.icon}</span>
            <span
              style={{
                fontSize: "10px",
                fontFamily: "'Chakra Petch', sans-serif",
                fontWeight: isActive ? 700 : 500,
                letterSpacing: "0.04em",
              }}
            >
              {item.label}
            </span>
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  width: 24,
                  height: 2,
                  background: T.green,
                  borderRadius: "0 0 2px 2px",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Match Card ───────────────────────────────────────────────────────────────

interface MatchCardProps {
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  competition: string;
  date: string;
  status: "upcoming" | "live" | "finished";
  venue?: string;
}

export function MatchCard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  competition,
  date,
  status,
  venue,
}: MatchCardProps) {
  const isLive = status === "live";
  const isFinished = status === "finished";

  return (
    <Card noPad>
      <div
        style={{
          padding: "10px 16px",
          borderBottom: `1px solid ${T.border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: T.textSec,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          {competition}
        </span>
        {isLive ? (
          <StatusBadge status="live" label="Live · 67'" />
        ) : (
          <span style={{ fontSize: "11px", color: T.textMuted }}>{date}</span>
        )}
      </div>
      <div style={{ padding: "20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, textAlign: "right" }}>
          <div
            style={{ fontSize: "15px", fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}
          >
            {homeTeam}
          </div>
          {venue && <div style={{ fontSize: "11px", color: T.textMuted, marginTop: 2 }}>Home</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          {isFinished || isLive ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: isLive ? T.green : T.text,
                  letterSpacing: "-0.04em",
                  minWidth: 28,
                  textAlign: "center",
                }}
              >
                {homeScore}
              </span>
              <span style={{ fontSize: "16px", color: T.textMuted, fontWeight: 300 }}>—</span>
              <span
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  color: isLive ? T.green : T.text,
                  letterSpacing: "-0.04em",
                  minWidth: 28,
                  textAlign: "center",
                }}
              >
                {awayScore}
              </span>
            </div>
          ) : (
            <div
              style={{
                padding: "6px 14px",
                background: T.cardRaised,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                fontSize: "13px",
                fontWeight: 700,
                color: T.textSec,
              }}
            >
              VS
            </div>
          )}
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <div
            style={{ fontSize: "15px", fontWeight: 800, color: T.text, letterSpacing: "-0.01em" }}
          >
            {awayTeam}
          </div>
          {venue && <div style={{ fontSize: "11px", color: T.textMuted, marginTop: 2 }}>Away</div>}
        </div>
      </div>
      {venue && (
        <div style={{ padding: "8px 16px", borderTop: `1px solid ${T.border}` }}>
          <span style={{ fontSize: "11px", color: T.textMuted }}>📍 {venue}</span>
        </div>
      )}
    </Card>
  );
}

// ─── News Card ────────────────────────────────────────────────────────────────

interface NewsCardProps {
  headline: string;
  summary: string;
  category: string;
  time: string;
  urgent?: boolean;
}

export function NewsCard({ headline, summary, category, time, urgent }: NewsCardProps) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: urgent ? T.red : T.green,
          }}
        >
          {category}
        </span>
        <span style={{ fontSize: "11px", color: T.textMuted }}>{time}</span>
      </div>
      <div
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: T.text,
          lineHeight: 1.4,
          letterSpacing: "-0.01em",
        }}
      >
        {headline}
      </div>
      <div style={{ fontSize: "13px", color: T.textSec, lineHeight: 1.5 }}>{summary}</div>
    </Card>
  );
}

// ─── Objective Card ───────────────────────────────────────────────────────────

interface ObjectiveCardProps {
  title: string;
  description: string;
  progress: number;
  target: number;
  reward?: string;
  priority: "essential" | "secondary" | "bonus";
  deadline?: string;
}

const PRIORITY_CONFIG = {
  essential: { color: T.red, label: "Essential", bg: T.redDim },
  secondary: { color: T.orange, label: "Secondary", bg: T.orangeDim },
  bonus: { color: T.gold, label: "Bonus", bg: T.goldDim },
};

export function ObjectiveCard({
  title,
  description,
  progress,
  target,
  reward,
  priority,
  deadline,
}: ObjectiveCardProps) {
  const cfg = PRIORITY_CONFIG[priority];
  const pct = Math.min(100, (progress / target) * 100);
  const done = progress >= target;

  return (
    <Card raised style={{ position: "relative", overflow: "hidden" }}>
      {done && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: T.green,
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 10,
        }}
      >
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: cfg.color,
            padding: "3px 8px",
            background: cfg.bg,
            borderRadius: 999,
          }}
        >
          {cfg.label}
        </span>
        {deadline && <span style={{ fontSize: "11px", color: T.textMuted }}>{deadline}</span>}
      </div>
      <div
        style={{
          fontSize: "15px",
          fontWeight: 700,
          color: T.text,
          marginBottom: 4,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: "12px", color: T.textSec, marginBottom: 14, lineHeight: 1.5 }}>
        {description}
      </div>
      <ProgressBar
        label=""
        value={progress}
        max={target}
        color={done ? T.green : cfg.color}
        sublabel={done ? "✓ Complete" : `${progress} / ${target}`}
      />
      {reward && (
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "12px",
            fontWeight: 600,
            color: T.gold,
          }}
        >
          <span>★</span>
          <span>{reward}</span>
        </div>
      )}
    </Card>
  );
}

// ─── Modal / Bottom Sheet ─────────────────────────────────────────────────────

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(7,17,31,0.8)",
          backdropFilter: "blur(4px)",
          zIndex: 40,
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.25s",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: T.cardRaised,
          borderTop: `1px solid ${T.borderMid}`,
          borderRadius: "20px 20px 0 0",
          padding: "0 0 env(safe-area-inset-bottom, 20px)",
          transform: open ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0.32,0.72,0,1)",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "12px 20px 0",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              background: T.borderMid,
              borderRadius: 2,
              marginBottom: 16,
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
              marginBottom: 16,
            }}
          >
            <span
              style={{ fontSize: "17px", fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}
            >
              {title}
            </span>
            <button
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: T.border,
                border: "none",
                borderRadius: "50%",
                cursor: "pointer",
                color: T.textSec,
                fontSize: "16px",
              }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "0 20px 20px", flex: 1 }}>{children}</div>
      </div>
    </>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, action, onAction }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
        marginBottom: 12,
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 9, minWidth: 0 }}>
        <span
          aria-hidden
          style={{
            width: 3,
            height: 14,
            borderRadius: 2,
            background: `linear-gradient(180deg, ${T.green}, ${T.greenDeep})`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "12px",
            fontWeight: 800,
            color: T.text,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
      </span>

      {action && (
        <button
          onClick={onAction}
          style={{
            fontSize: "13px",
            fontFamily: "'Chakra Petch', sans-serif",
            fontWeight: 600,
            color: T.green,
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px 0",
          }}
        >
          {action} →
        </button>
      )}
    </div>
  );
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

interface StatTileProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  trend?: "up" | "down" | "neutral";
}

export function StatTile({ label, value, sub, color, trend }: StatTileProps) {
  const trendColor = trend === "up" ? T.green : trend === "down" ? T.red : T.textSec;
  const trendIcon = trend === "up" ? "↑" : trend === "down" ? "↓" : null;

  return (
    <Card raised style={{ display: "flex", flexDirection: "column", gap: 5, minHeight: 94 }}>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          color: T.textSec,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, minHeight: 28 }}>
        <span
          style={{
            fontSize: "24px",
            fontWeight: 800,
            color: color ?? T.text,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
        {trendIcon && (
          <span style={{ fontSize: "12px", fontWeight: 700, color: trendColor }}>{trendIcon}</span>
        )}
      </div>
      {sub && <span style={{ fontSize: "11px", color: T.textMuted }}>{sub}</span>}
    </Card>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function Divider() {
  return <div style={{ height: 1, background: T.border, margin: "4px 0" }} />;
}
