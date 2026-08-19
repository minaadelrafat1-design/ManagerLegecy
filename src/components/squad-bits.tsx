import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { T } from "./ui";
import type { Player } from "@/data/squad";

export function ratingColor(v: number) {
  if (v >= 85) return T.gold;
  if (v >= 75) return T.green;
  if (v >= 65) return T.orange;
  return T.red;
}

export function meterColor(v: number) {
  if (v >= 80) return T.green;
  if (v >= 60) return T.orange;
  return T.red;
}

export function FormArrow({ trend }: { trend: Player["formTrend"] }) {
  const color = trend === "up" ? T.green : trend === "down" ? T.red : T.textSec;
  const glyph = trend === "up" ? "▲" : trend === "down" ? "▼" : "▬";
  return <span style={{ fontSize: 9, color, lineHeight: 1 }}>{glyph}</span>;
}

export function MiniMeter({
  label,
  value,
  width = 44,
}: {
  label: string;
  value: number;
  width?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width }}>
      <span
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: T.textMuted,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <div style={{ height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2 }}>
        <div
          style={{
            width: `${Math.min(100, value)}%`,
            height: "100%",
            background: meterColor(value),
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
}

export function FitnessRing({ value, size = 34 }: { value: number; size?: number }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const color = meterColor(value);
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.09)"
          strokeWidth={3}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={3}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          strokeLinecap="round"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 800,
          color,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function PotentialDots({ overall, potential }: { overall: number; potential: number }) {
  const gap = potential - overall;
  const stars = gap >= 15 ? 3 : gap >= 8 ? 2 : gap >= 3 ? 1 : 0;
  if (stars === 0) return null;
  return (
    <span style={{ display: "inline-flex", gap: 2 }}>
      {Array.from({ length: stars }).map((_, i) => (
        <span key={i} style={{ fontSize: 8, color: T.gold, lineHeight: 1 }}>
          ★
        </span>
      ))}
    </span>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  right,
  backTo,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  backTo?: string;
}) {
  return (
    <header
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) auto",
        alignItems: "center",
        gap: 12,
        padding: "20px 20px 18px",
        background: "linear-gradient(180deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0) 100%)",
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          bottom: -1,
          width: 96,
          height: 2,
          background: `linear-gradient(90deg, ${T.green}, rgba(47,224,138,0))`,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {backTo && (
          <Link
            to={backTo}
            className="ml-nav-link"
            style={{
              width: 34,
              height: 34,
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              borderRadius: 9,
              border: `1px solid ${T.borderMid}`,
              background: "rgba(255,255,255,0.04)",
              color: T.textSec,
              textDecoration: "none",
              fontSize: 16,
            }}
          >
            ‹
          </Link>
        )}
        <div style={{ minWidth: 0 }}>
          <span className="ml-eyebrow" style={{ display: "block", marginBottom: 4 }}>
            Manager Legacy
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.035em",
              lineHeight: 1.1,
              color: T.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: T.textSec,
                marginTop: 4,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {right}
    </header>
  );
}
