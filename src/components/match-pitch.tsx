import { useState } from "react";
import { T } from "./ui";
import { PlayerFigure } from "./player-figure";
import { StadiumEnvironment } from "./stadium-env";

import type { MatchTeam, PitchPlayer } from "./match-bits";

/* ---------------------------------------------------------------------------
 * Broadcast-style pitch.
 * Geometry uses real FIFA proportions (105m x 68m) mapped into an SVG
 * viewBox of 680 x 1050 units (1 unit = 0.1m). Player/ball coordinates stay
 * on the original 0-100 % system so game logic is untouched.
 * ------------------------------------------------------------------------- */

const LINE = "rgba(233,244,236,0.62)";
const LINE_SOFT = "rgba(233,244,236,0.42)";

// playing area inside the plane (leaves run-off margin for goals)
const X0 = 34;
const Y0 = 52;
const W = 612;
const H = 946;
const S = W / 68; // px per metre
const X1 = X0 + W;
const Y1 = Y0 + H;
const CX = X0 + W / 2;
const CY = Y0 + H / 2;

const m = (v: number) => v * S;

const PA_W = m(40.32);
const PA_D = m(16.5);
const GA_W = m(18.32);
const GA_D = m(5.5);
const GOAL_W = m(7.32);
const GOAL_D = m(2.2);
const R_CENTER = m(9.15);
const PEN_DIST = m(11);
const R_CORNER = m(1);

const GRASS_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** A goal seen from above at a shallow angle: side netting converging to the
 *  back bar, a hexless square mesh, painted posts and a cast shadow. `dir` is
 *  -1 for the far goal (net extends up) and +1 for the near goal. */
function Goal({
  cx,
  lineY,
  dir,
  w,
  d,
}: {
  cx: number;
  lineY: number;
  dir: -1 | 1;
  w: number;
  d: number;
}) {
  const back = lineY + d * dir;
  const inset = w * 0.045; // net tapers slightly toward the back bar
  const l = cx - w / 2;
  const r = cx + w / 2;
  const bl = l + inset;
  const br = r - inset;
  const body = `M${l} ${lineY} L${r} ${lineY} L${br} ${back} L${bl} ${back} Z`;

  return (
    <g>
      {/* shadow the frame throws onto the goalmouth turf */}
      <path
        d={`M${l} ${lineY} L${r} ${lineY} L${br} ${back} L${bl} ${back} Z`}
        transform={`translate(1.6 ${dir * -1.6})`}
        fill="rgba(0,0,0,0.35)"
      />
      {/* net volume */}
      <path d={body} fill="rgba(226,238,232,0.10)" />
      <path d={body} fill="url(#net)" />
      <path d={body} fill="url(#netGrad)" opacity="0.6" />
      {/* net sag toward the back bar */}
      <path
        d={`M${bl} ${back} L${br} ${back} L${br} ${back - dir * d * 0.22} L${bl} ${back - dir * d * 0.22} Z`}
        fill="rgba(0,0,0,0.22)"
      />
      {/* side netting edges */}
      <path
        d={`M${l} ${lineY} L${bl} ${back} M${r} ${lineY} L${br} ${back}`}
        stroke="rgba(240,250,244,0.55)"
        strokeWidth="1.1"
        fill="none"
      />
      {/* back bar */}
      <path
        d={`M${bl} ${back} L${br} ${back}`}
        stroke="rgba(238,248,242,0.7)"
        strokeWidth="1.6"
        fill="none"
      />
      {/* posts + crossbar on the goal line — the brightest painted objects */}
      <path
        d={`M${l} ${lineY} L${r} ${lineY}`}
        stroke="rgba(252,255,253,0.95)"
        strokeWidth="2.8"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx={l} cy={lineY} r="2.1" fill="#fdfffe" />
      <circle cx={r} cy={lineY} r="2.1" fill="#fdfffe" />
    </g>
  );
}

function PitchMarkings() {
  return (
    <svg
      viewBox="0 0 680 1050"
      preserveAspectRatio="none"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      aria-hidden
    >
      <defs>
        <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.30)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
        </linearGradient>
        {/* fine square mesh — real netting is much finer than the goalmouth */}
        <pattern id="net" width="3.4" height="3.4" patternUnits="userSpaceOnUse">
          <path d="M3.4 0H0V3.4" fill="none" stroke="rgba(246,252,248,0.34)" strokeWidth="0.45" />
        </pattern>

        <clipPath id="playArea">
          <rect x={X0} y={Y0} width={W} height={H} />
        </clipPath>
      </defs>

      {/* line shadow pass for depth */}
      <g
        clipPath="url(#playArea)"
        fill="none"
        stroke="rgba(0,0,0,0.28)"
        strokeWidth="3.4"
        transform="translate(0,2.5)"
      >
        <rect x={X0} y={Y0} width={W} height={H} />
        <line x1={X0} y1={CY} x2={X1} y2={CY} />
        <circle cx={CX} cy={CY} r={R_CENTER} />
      </g>

      <g fill="none" stroke={LINE} strokeWidth="2.6" strokeLinecap="square">
        {/* touchlines + goal lines */}
        <rect x={X0} y={Y0} width={W} height={H} />
        {/* halfway line */}
        <line x1={X0} y1={CY} x2={X1} y2={CY} />
        {/* centre circle + spot */}
        <circle cx={CX} cy={CY} r={R_CENTER} />
        <circle cx={CX} cy={CY} r={3.2} fill={LINE} stroke="none" />

        {/* top penalty + goal area */}
        <rect x={CX - PA_W / 2} y={Y0} width={PA_W} height={PA_D} />
        <rect x={CX - GA_W / 2} y={Y0} width={GA_W} height={GA_D} />
        <circle cx={CX} cy={Y0 + PEN_DIST} r={3.2} fill={LINE} stroke="none" />
        {/* D arc (only the part outside the box) */}
        <path
          d={`M ${CX - Math.sqrt(R_CENTER ** 2 - (PA_D - PEN_DIST) ** 2)} ${Y0 + PA_D}
              A ${R_CENTER} ${R_CENTER} 0 0 0 ${CX + Math.sqrt(R_CENTER ** 2 - (PA_D - PEN_DIST) ** 2)} ${Y0 + PA_D}`}
        />

        {/* bottom penalty + goal area */}
        <rect x={CX - PA_W / 2} y={Y1 - PA_D} width={PA_W} height={PA_D} />
        <rect x={CX - GA_W / 2} y={Y1 - GA_D} width={GA_W} height={GA_D} />
        <circle cx={CX} cy={Y1 - PEN_DIST} r={3.2} fill={LINE} stroke="none" />
        <path
          d={`M ${CX - Math.sqrt(R_CENTER ** 2 - (PA_D - PEN_DIST) ** 2)} ${Y1 - PA_D}
              A ${R_CENTER} ${R_CENTER} 0 0 1 ${CX + Math.sqrt(R_CENTER ** 2 - (PA_D - PEN_DIST) ** 2)} ${Y1 - PA_D}`}
        />

        {/* corner arcs */}
        <path
          d={`M ${X0} ${Y0 + R_CORNER} A ${R_CORNER} ${R_CORNER} 0 0 0 ${X0 + R_CORNER} ${Y0}`}
        />
        <path
          d={`M ${X1 - R_CORNER} ${Y0} A ${R_CORNER} ${R_CORNER} 0 0 0 ${X1} ${Y0 + R_CORNER}`}
        />
        <path
          d={`M ${X0} ${Y1 - R_CORNER} A ${R_CORNER} ${R_CORNER} 0 0 1 ${X0 + R_CORNER} ${Y1}`}
        />
        <path
          d={`M ${X1 - R_CORNER} ${Y1} A ${R_CORNER} ${R_CORNER} 0 0 1 ${X1} ${Y1 - R_CORNER}`}
        />
      </g>

      {/* corner flags */}
      <g stroke="rgba(255,255,255,0.5)" strokeWidth="2">
        <line x1={X0} y1={Y0} x2={X0 - 6} y2={Y0 - 16} />
        <line x1={X1} y1={Y0} x2={X1 + 6} y2={Y0 - 16} />
        <line x1={X0} y1={Y1} x2={X0 - 6} y2={Y1 + 16} />
        <line x1={X1} y1={Y1} x2={X1 + 6} y2={Y1 + 16} />
      </g>

      {/* goals: frame + netting, drawn with a shallow depth so the goalmouth
          reads as a box rather than a white rectangle on the grass */}
      <Goal cx={CX} lineY={Y0} dir={-1} w={GOAL_W} d={GOAL_D} />
      <Goal cx={CX} lineY={Y1} dir={1} w={GOAL_W} d={GOAL_D} />

      {/* soft vignette hint at the far end for depth */}
      <rect x="0" y="0" width="680" height="1050" fill="none" stroke={LINE_SOFT} strokeWidth="0" />
    </svg>
  );
}

function Token({
  p,
  team,
  compact,
  highlight,
  selected,
  tilt,
  striped,
  onSelect,
}: {
  p: PitchPlayer;
  team: MatchTeam;
  compact: boolean;
  highlight: boolean;
  selected: boolean;
  tilt: number;
  striped: boolean;
  onSelect?: (() => void) | undefined;
}) {
  const [hover, setHover] = useState(false);
  // players are read at a glance, so they sit a little above true scale;
  // the perspective container still shrinks the far half naturally
  const h = compact ? 26 : 40;
  const ringW = h * 0.72;

  const active = highlight || selected;
  // Ball owner reads gold (matches the broadcast "in possession" convention
  // already used elsewhere); a manually selected player who doesn't have the
  // ball gets a distinct cyan ring so the two states are never confused.
  const ringTone = highlight
    ? { border: T.gold, glow: "rgba(232,188,92,0.14)", shadow: "rgba(232,188,92,0.22)" }
    : selected
      ? { border: T.cyan, glow: "rgba(79,219,255,0.14)", shadow: "rgba(79,219,255,0.24)" }
      : null;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (!onSelect) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      title={`${p.number} ${p.shortName} · ${p.pos}`}
      style={{
        position: "absolute",
        left: `${p.x}%`,
        top: `${p.y}%`,
        transform: "translate(-50%,-50%)",
        transition: "left 1.1s cubic-bezier(0.4,0,0.2,1), top 1.1s cubic-bezier(0.4,0,0.2,1)",
        transformStyle: "preserve-3d",
        zIndex: active ? 3 : hover ? 2 : 1,
        cursor: onSelect ? "pointer" : undefined,
        outline: "none",
      }}
    >
      {/* ground contact: soft cast shadow, lies flat on the grass.
          Key light sits above/behind-left of the bowl, so the shadow falls
          slightly down-right of the feet — same direction as the figure art. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: ringW * 1.15,
          height: ringW * 0.34,
          transform: "translate(-44%,-24%)",
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, rgba(0,0,0,0.5), rgba(0,0,0,0.2) 60%, transparent 84%)",
          filter: "blur(1.4px)",
        }}
      />
      {/* selection / active ring, drawn above the shadow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: ringW,
          height: ringW * 0.34,
          transform: `translate(-50%,-28%) scale(${active ? 1 : hover ? 0.96 : 0.9})`,
          borderRadius: "50%",
          border: ringTone
            ? `1.4px solid ${ringTone.border}`
            : hover
              ? "1.2px solid rgba(255,255,255,0.6)"
              : "1.2px solid transparent",
          background: ringTone
            ? `radial-gradient(closest-side, ${ringTone.glow}, transparent 75%)`
            : "transparent",
          boxShadow: ringTone
            ? `0 0 10px 2px ${ringTone.shadow}`
            : hover
              ? "0 0 6px 1px rgba(255,255,255,0.12)"
              : "none",
          transition:
            "border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease, background 0.22s ease",
        }}
      />
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          transform: `rotateX(${-tilt}deg) translateY(${-h * 0.46}px) scale(${active ? 1.08 : hover ? 1.05 : 1})`,
          transformOrigin: "50% 100%",
          transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <PlayerFigure
          kit={{ primary: team.primary, secondary: team.secondary, text: team.text }}
          number={p.number}
          height={h}
          striped={striped}
          keeper={p.pos === "GK"}
          selected={active}
          hovered={hover}
        />
        {/* Name plate only on focus. A permanent chip on all 22 players reads
            as a data table laid over grass; broadcast graphics name the player
            you are looking at, not everyone at once. */}
        {!compact && (active || hover) && (
          <span
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginTop: h * 0.12,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "1.5px 5px",
              borderRadius: 3,
              background: "rgba(6,14,11,0.82)",
              border: `1px solid ${ringTone ? ringTone.border + "8c" : "rgba(255,255,255,0.16)"}`,
              boxShadow: "0 2px 6px rgba(0,0,0,0.55)",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.02em",
              color: ringTone ? ringTone.border : "rgba(236,246,239,0.95)",
              whiteSpace: "nowrap",
              pointerEvents: "none",
              textShadow: "0 1px 2px rgba(0,0,0,0.9)",
            }}
          >
            <span style={{ opacity: 0.65, fontWeight: 800 }}>{p.number}</span>
            {p.shortName}
          </span>
        )}
      </div>
    </div>
  );
}

export function Pitch({
  home,
  away,
  homeTeam,
  awayTeam,
  ball,
  compact,
  ballOwnerId,
  selectedId = null,
  onSelectPlayer,
}: {
  home: PitchPlayer[];
  away: PitchPlayer[];
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  ball: { x: number; y: number };
  compact: boolean;
  ballOwnerId: string | null;
  /** Currently selected player's id (either side), or null. Purely additive —
   * omit both props and the pitch behaves exactly as before. */
  selectedId?: string | null;
  onSelectPlayer?: (id: string, side: "home" | "away") => void;
}) {
  const tilt = compact ? 0 : 13;
  const stripes = compact ? 10 : 14;
  const band = 100 / stripes;
  const ballSize = compact ? 9 : 12;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: compact ? "3 / 4" : "4 / 5",
        borderRadius: 6,
        overflow: "hidden",
        background: "radial-gradient(120% 80% at 50% -10%, #0b1a1e 0%, #071211 55%, #030909 100%)",
        boxShadow: "inset 0 0 90px rgba(0,0,0,0.65)",
      }}
    >
      {/* ---------- stadium surround ---------- */}
      <StadiumEnvironment compact={compact} />

      {/* ---------- perspective stage ---------- */}
      <div
        style={{
          position: "absolute",
          inset: compact ? "6% 12% 6%" : "14% 5% 8%",
          perspective: compact ? undefined : "1500px",
          perspectiveOrigin: "50% 42%",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            height: "100%",
            aspectRatio: "68 / 105",
            transformStyle: "preserve-3d",
            transform: compact ? undefined : `rotateX(${tilt}deg) scale(0.99)`,
            borderRadius: 2,
            boxShadow: "0 34px 60px rgba(0,0,0,0.5), inset 0 0 90px rgba(0,0,0,0.35)",
            /* Ryegrass under floodlight is a deep, slightly cool green — the
               saturated emerald is what makes turf look like a UI surface. */
            background:
              "radial-gradient(125% 95% at 36% 0%, #2b7a4d 0%, #226a44 44%, #19573a 78%, #113f2b 100%)",
          }}
        >
          {/* mowing stripes: alternating cut direction, so one band catches the
              light and the next absorbs it */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `repeating-linear-gradient(to bottom, rgba(214,240,206,0.085) 0 ${band}%, rgba(0,0,0,0.075) ${band}% ${band * 2}%)`,
            }}
          />
          {/* blade direction within each band — very fine, reads as grass, not
              as a second stripe set */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(to right, rgba(255,255,255,0.02) 0 1.1%, rgba(0,0,0,0.02) 1.1% 2.2%)",
              opacity: 0.55,
            }}
          />
          {/* broad anisotropic sheen from the rig, one soft sweep rather than
              repeating bands */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(70% 42% at 38% 14%, rgba(226,245,222,0.10), transparent 72%)," +
                "radial-gradient(60% 38% at 66% 78%, rgba(206,232,206,0.05), transparent 74%)",
            }}
          />
          {/* wear: goalmouths and the centre spot scuff to a drier, browner
              turf rather than a brighter one */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(20% 5% at 50% 3.5%, rgba(150,140,92,0.20), transparent 72%)," +
                "radial-gradient(20% 5% at 50% 96.5%, rgba(150,140,92,0.20), transparent 72%)," +
                "radial-gradient(9% 3.2% at 50% 50%, rgba(146,136,90,0.18), transparent 78%)," +
                "radial-gradient(30% 8% at 50% 12%, rgba(130,124,84,0.08), transparent 78%)," +
                "radial-gradient(30% 8% at 50% 88%, rgba(130,124,84,0.08), transparent 78%)",
            }}
          />
          {/* grass texture */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: GRASS_NOISE,
              backgroundSize: "110px 110px",
              opacity: 0.2,
              mixBlendMode: "overlay",
            }}
          />
          {/* one lighting model: key light from the top-left rig, so the turf
              falls off toward the bottom-right; far end sits in atmospheric haze */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(12,32,40,0.34) 0%, rgba(10,28,34,0.1) 22%, rgba(0,0,0,0) 54%, rgba(0,0,0,0.2) 100%), linear-gradient(305deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0) 46%)",
            }}
          />

          <PitchMarkings />

          {/* players */}
          {away.map((p) => (
            <Token
              key={`a-${p.id}`}
              p={p}
              team={awayTeam}
              compact={compact}
              highlight={ballOwnerId === p.id}
              selected={selectedId === p.id}
              tilt={tilt}
              striped
              onSelect={onSelectPlayer ? () => onSelectPlayer(p.id, "away") : undefined}
            />
          ))}
          {home.map((p) => (
            <Token
              key={`h-${p.id}`}
              p={p}
              team={homeTeam}
              compact={compact}
              highlight={ballOwnerId === p.id}
              selected={selectedId === p.id}
              tilt={tilt}
              striped={false}
              onSelect={onSelectPlayer ? () => onSelectPlayer(p.id, "home") : undefined}
            />
          ))}

          {/* ball */}
          <div
            style={{
              position: "absolute",
              left: `${ball.x}%`,
              top: `${ball.y}%`,
              transform: "translate(-50%,-50%)",
              transition: "left 1.1s ease, top 1.1s ease",
              transformStyle: "preserve-3d",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: ballSize * 1.3,
                height: ballSize * 0.5,
                transform: "translate(-38%,2px)",
                borderRadius: "50%",
                background: "radial-gradient(closest-side, rgba(0,0,0,0.5), transparent 80%)",
                filter: "blur(1px)",
              }}
            />
            <div
              style={{
                position: "relative",
                width: ballSize,
                height: ballSize,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 30% 24%, #ffffff 0%, #f2f5f3 34%, #c3cec7 72%, #7d8b84 100%)",
                border: "1px solid rgba(0,0,0,0.35)",
                boxShadow:
                  "0 4px 8px rgba(0,0,0,0.55), inset -2px -3px 5px rgba(0,0,0,0.35), inset 2px 2px 3px rgba(255,255,255,0.7)",
                transform: `rotateX(${-tilt}deg)`,
                overflow: "hidden",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle at 52% 44%, rgba(20,26,24,0.8) 0 18%, transparent 19%)," +
                    "radial-gradient(circle at 20% 74%, rgba(20,26,24,0.6) 0 14%, transparent 15%)," +
                    "radial-gradient(circle at 82% 70%, rgba(20,26,24,0.55) 0 12%, transparent 13%)",
                  animation: "ml-ball-spin 1.6s linear infinite",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* subtle broadcast vignette */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(112% 84% at 50% 44%, transparent 58%, rgba(3,10,14,0.42) 100%)",
        }}
      />
    </div>
  );
}
