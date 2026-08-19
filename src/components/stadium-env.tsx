/* ---------------------------------------------------------------------------
 * Stadium environment.
 * One SVG layer behind the pitch stage: bowl architecture, raked seating with a
 * procedurally scattered crowd, roofs, LED advertising boards, floodlight
 * pylons and atmospheric haze. Generated once at module scope (deterministic
 * PRNG) and rendered as a handful of <pattern> fills, so the DOM stays tiny.
 *
 * The bowl opening traces the *measured* projected corners of the tilted pitch
 * stage in match-pitch.tsx (viewBox units of 1000 x 1250), so the apron, LED
 * ring and stands wrap the actual turf instead of floating behind it.
 * ------------------------------------------------------------------------- */

// deterministic PRNG so the crowd never re-shuffles between renders
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Night-lit clothing tones. A real crowd under floodlights is mostly
   desaturated grey/beige with only a scattering of team colour, so the mass
   reads as fabric and skin rather than confetti. */
const SHIRTS = [
  "#b9c2c9",
  "#8e99a3",
  "#6d7681",
  "#a6b0b8",
  "#525c66",
  "#cec5b6",
  "#79838f",
  "#98a1a9",
  "#5b646d",
  "#aeb7bf",
  "#3f474f",
  "#8b8377",
];
const HEADS = ["#c2a084", "#a07d5c", "#77563f", "#dbbfa3", "#5c4430"];

/** One crowd tile: heads + shoulders on a seat rake, jittered in both axes so
 *  rows read as people rather than a printed grid. Row pitch itself wobbles,
 *  which is what kills the visible tiling at a distance. */
function crowdTile(id: string, seed: number, w: number, h: number, cols: number, rows: number) {
  const rnd = mulberry(seed);
  const cw = w / cols;
  const rh = h / rows;
  const people: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const rowJitter = (rnd() - 0.5) * rh * 0.35;
    for (let c = 0; c < cols; c++) {
      if (rnd() < 0.05) continue; // empty seats
      const x = c * cw + cw * (0.2 + rnd() * 0.6) + (r % 2 ? cw * 0.5 : 0);
      const y = r * rh + rh * (0.35 + rnd() * 0.3) + rowJitter;
      const s = cw * (0.19 + rnd() * 0.09);
      const shirt = SHIRTS[Math.floor(rnd() * SHIRTS.length)];
      const head = HEADS[Math.floor(rnd() * HEADS.length)];
      const lean = (rnd() - 0.5) * s * 0.7;
      people.push(
        <g key={`${r}-${c}`} opacity={0.4 + rnd() * 0.6}>
          {/* shoulders */}
          <path
            d={`M${x - s * 1.55} ${y + s * 2.5} q${s * 0.25} ${-s * 1.75} ${s * 1.55} ${-s * 1.75} q${s * 1.3} 0 ${s * 1.55} ${s * 1.75} Z`}
            fill={shirt}
          />
          {/* head */}
          <ellipse cx={x + lean} cy={y} rx={s * 0.92} ry={s} fill={head} />
        </g>,
      );
    }
  }
  return (
    <pattern id={id} width={w} height={h} patternUnits="userSpaceOnUse">
      {people}
    </pattern>
  );
}

// tiles at different scales/offsets — overlaying them kills the repeat
const TILE_FAR = crowdTile("crowdFar", 11, 128, 34, 22, 6);
const TILE_MID = crowdTile("crowdMid", 907, 164, 46, 20, 6);
const TILE_NEAR = crowdTile("crowdNear", 4242, 212, 66, 18, 6);

/** A run of LED hoarding segments following a quad. Boards are lit panels, so
 *  they are the brightest thing at pitch level and spill a little onto the
 *  apron — that spill is what sells them as light sources. */
function LedRun({
  x1,
  y1,
  x2,
  y2,
  depth,
  segments,
  opacity = 1,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** board height in viewBox units at each end: [start, end] */
  depth: [number, number];
  segments: number;
  opacity?: number;
}) {
  const parts: React.ReactNode[] = [];
  const rnd = mulberry(Math.round(x1 * 7 + y1 * 13 + segments));
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    const ax = x1 + (x2 - x1) * t0;
    const ay = y1 + (y2 - y1) * t0;
    const bx = x1 + (x2 - x1) * t1;
    const by = y1 + (y2 - y1) * t1;
    const d0 = depth[0] + (depth[1] - depth[0]) * t0;
    const d1 = depth[0] + (depth[1] - depth[0]) * t1;
    parts.push(
      <path
        key={i}
        d={`M${ax} ${ay} L${bx} ${by} L${bx} ${by + d1} L${ax} ${ay + d0} Z`}
        fill="url(#boardFace)"
        fillOpacity={0.72 + rnd() * 0.28}
        stroke="rgba(2,8,10,0.75)"
        strokeWidth="0.8"
      />,
    );
  }
  return (
    <g opacity={opacity}>
      {parts}
      {/* single sheen across the whole run, not per board */}
      <path
        d={`M${x1} ${y1} L${x2} ${y2} L${x2} ${y2 + depth[1]} L${x1} ${y1 + depth[0]} Z`}
        fill="url(#boardSheen)"
      />
      {/* dark top rail + shadow the boards cast back onto the apron */}
      <path
        d={`M${x1} ${y1} L${x2} ${y2} L${x2} ${y2 + depth[1] * 0.12} L${x1} ${y1 + depth[0] * 0.12} Z`}
        fill="rgba(0,0,0,0.5)"
      />
    </g>
  );
}

export function StadiumEnvironment({ compact }: { compact: boolean }) {
  /* Measured projected corners of the turf plane (viewBox units). */
  const topY = compact ? 75 : 212;
  const botY = compact ? 1175 : 1161;
  const topL = compact ? 120 : 204;
  const topR = compact ? 880 : 797;
  const botL = compact ? 120 : 172;
  const botR = compact ? 880 : 828;

  // apron (run-off) ring around the turf, wider at the near end
  const apTop = compact ? 8 : 22;
  const apBot = compact ? 10 : 34;
  const apSide = compact ? 10 : 26;
  const aTL = topL - apSide * 0.7;
  const aTR = topR + apSide * 0.7;
  const aBL = botL - apSide;
  const aBR = botR + apSide;
  const aTY = topY - apTop;
  const aBY = botY + apBot;

  // front edge of the stands (where seating meets the apron)
  const sTY = aTY - (compact ? 6 : 16);
  const sBY = aBY + (compact ? 6 : 14);
  const sTL = aTL - (compact ? 6 : 14);
  const sTR = aTR + (compact ? 6 : 14);
  const sBL = aBL - (compact ? 6 : 20);
  const sBR = aBR + (compact ? 6 : 20);

  const roofY = compact ? 26 : 74;

  return (
    <svg
      viewBox="0 0 1000 1250"
      preserveAspectRatio="none"
      aria-hidden
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <defs>
        {TILE_FAR}
        {TILE_MID}
        {TILE_NEAR}

        <linearGradient id="bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a151b" />
          <stop offset="40%" stopColor="#091714" />
          <stop offset="100%" stopColor="#020708" />
        </linearGradient>
        {/* far-stand haze: atmospheric perspective, cool and low contrast */}
        <linearGradient id="hazeFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1b3540" stopOpacity="0.72" />
          <stop offset="70%" stopColor="#17303a" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#16303a" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="hazeNear" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#010608" stopOpacity="0.94" />
          <stop offset="100%" stopColor="#010608" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b171c" />
          <stop offset="70%" stopColor="#060f13" />
          <stop offset="100%" stopColor="#020809" />
        </linearGradient>
        {/* LED hoardings: warm-neutral lit panel, not a neon slab */}
        <linearGradient id="boardFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#20343c" />
          <stop offset="30%" stopColor="#5d6f74" />
          <stop offset="72%" stopColor="#8f9a96" />
          <stop offset="100%" stopColor="#39474c" />
        </linearGradient>
        <linearGradient id="boardSheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.35" />
          <stop offset="22%" stopColor="#dfe9e4" stopOpacity="0.14" />
          <stop offset="48%" stopColor="#000000" stopOpacity="0.22" />
          <stop offset="72%" stopColor="#e8f0ea" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.38" />
        </linearGradient>
        <linearGradient id="apron" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#17372a" />
          <stop offset="55%" stopColor="#1a3b2f" />
          <stop offset="100%" stopColor="#102a22" />
        </linearGradient>
        <radialGradient id="pool" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#e6f3ee" stopOpacity="0.26" />
          <stop offset="60%" stopColor="#e6f3ee" stopOpacity="0.07" />
          <stop offset="100%" stopColor="#e6f3ee" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#eaf6f0" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#eaf6f0" stopOpacity="0" />
        </linearGradient>
        {/* seat rake shading, reused on every stand */}
        <pattern id="rake" width="8" height="10" patternUnits="userSpaceOnUse">
          <rect width="8" height="10" fill="rgba(0,0,0,0)" />
          <rect width="8" height="3.4" y="6.6" fill="rgba(0,0,0,0.24)" />
          <rect width="8" height="0.8" y="5.8" fill="rgba(255,255,255,0.04)" />
        </pattern>
        {/* Large-scale occupancy mottle. A real stand is never evenly filled or
            evenly lit; this irregular darkening is what stops the tiled crowd
            from reading as a printed texture. */}
        <filter id="mottle" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.005 0.016"
            numOctaves="4"
            seed="19"
            result="t"
          />
          <feColorMatrix
            in="t"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -0.85"
          />
        </filter>
        {/* the answering highlight lobe: pockets of stand that catch the rig */}
        <filter id="mottleLit" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006 0.02"
            numOctaves="3"
            seed="53"
            result="t"
          />
          <feColorMatrix
            in="t"
            type="matrix"
            values="0 0 0 0 0.78  0 0 0 0 0.85  0 0 0 0 0.92  2.2 0 0 0 -1.35"
          />
        </filter>
        {/* softens the far crowd so distance reads as distance */}
        <filter id="farSoft" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id="midSoft" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="0.9" />
        </filter>
        <linearGradient id="sideShadeL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#010606" stopOpacity="0.72" />
          <stop offset="45%" stopColor="#031012" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.34" />
        </linearGradient>
        <linearGradient id="sideShadeR" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#010606" stopOpacity="0.72" />
          <stop offset="45%" stopColor="#031012" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.34" />
        </linearGradient>
      </defs>

      {/* bowl backdrop */}
      <rect width="1000" height="1250" fill="url(#bowl)" />

      {/* ---------------- far stand (top) ---------------- */}
      {(() => {
        const upTop = roofY + (compact ? 2 : 8);
        const upBot = sTY - (compact ? 22 : 62);
        const conTop = upBot;
        const conBot = upBot + (compact ? 6 : 16);
        const lowTop = conBot;
        const lowBot = sTY;
        return (
          <g>
            {/* stand carcass */}
            <path
              d={`M0 ${roofY} H1000 V${sTY} L${sTR} ${sTY} H${sTL} L0 ${sTY} Z`}
              fill="#13252b"
            />

            {/* upper tier crowd, softened by distance */}
            <g filter="url(#farSoft)">
              <rect
                x="24"
                y={upTop}
                width="952"
                height={Math.max(0, upBot - upTop)}
                fill="url(#crowdFar)"
                opacity="0.34"
              />
            </g>
            <rect
              x="24"
              y={upTop}
              width="952"
              height={Math.max(0, upBot - upTop)}
              fill="url(#rake)"
              opacity="0.4"
            />

            {/* concourse band between tiers, broken by vomitory openings */}
            <rect
              x="0"
              y={conTop}
              width="1000"
              height={Math.max(0, conBot - conTop)}
              fill="#040d10"
            />
            <rect x="0" y={conTop} width="1000" height="1" fill="rgba(190,215,210,0.1)" />

            {/* lower tier, larger figures */}
            <g filter="url(#midSoft)">
              <rect
                x="10"
                y={lowTop}
                width="980"
                height={Math.max(0, lowBot - lowTop)}
                fill="url(#crowdMid)"
                opacity="0.4"
              />
            </g>
            <rect
              x="10"
              y={lowTop}
              width="980"
              height={Math.max(0, lowBot - lowTop)}
              fill="url(#rake)"
              opacity="0.34"
            />

            {/* uneven occupancy across the whole far end */}
            <rect
              x="0"
              y={upTop}
              width="1000"
              height={Math.max(0, sTY - upTop)}
              filter="url(#mottle)"
              opacity="0.85"
            />
            <rect
              x="0"
              y={upTop}
              width="1000"
              height={Math.max(0, sTY - upTop)}
              filter="url(#mottleLit)"
              opacity="0.16"
            />

            {/* vomitories / stairwells break the repeating mass */}
            {!compact &&
              [130, 305, 500, 695, 870].map((x) => (
                <rect
                  key={x}
                  x={x - 7}
                  y={lowTop}
                  width="14"
                  height={Math.max(0, lowBot - lowTop)}
                  fill="#03090b"
                  opacity="0.85"
                />
              ))}

            {/* roof + the shadow it throws over the back rows */}
            <rect x="0" y="0" width="1000" height={roofY} fill="url(#roof)" />
            <rect x="0" y={roofY} width="1000" height={compact ? 10 : 30} fill="rgba(0,0,0,0.55)" />
            {!compact && (
              <g stroke="rgba(150,180,185,0.09)" strokeWidth="1.5">
                {[0.12, 0.31, 0.5, 0.69, 0.88].map((t) => (
                  <line key={t} x1={t * 1000} y1="0" x2={t * 1000} y2={roofY} />
                ))}
              </g>
            )}

            {/* atmospheric haze over the whole far end */}
            <rect x="0" y="0" width="1000" height={sTY} fill="url(#hazeFar)" />
          </g>
        );
      })()}

      {/* ---------------- side stands ---------------- */}
      {([0, 1] as const).map((i) => {
        const left = i === 0;
        const outer = left ? 0 : 1000;
        const iTop = left ? sTL : sTR;
        const iBot = left ? sBL : sBR;
        const quad = `M${outer} ${sTY} L${iTop} ${sTY} L${iBot} ${sBY} L${outer} 1250 Z`;
        return (
          <g key={i}>
            <path d={quad} fill="#101f25" />
            <g filter="url(#midSoft)">
              <path d={quad} fill="url(#crowdMid)" opacity="0.3" />
            </g>
            <path d={quad} fill="url(#rake)" opacity="0.26" />
            <path d={quad} filter="url(#mottle)" opacity={left ? 0.9 : 0.78} />
            <path d={quad} filter="url(#mottleLit)" opacity="0.14" />
            {/* structural ribs converging with the bowl */}
            <g stroke="rgba(0,0,0,0.4)" strokeWidth="1.6">
              {[0.16, 0.34, 0.52, 0.7, 0.88].map((t) => (
                <line
                  key={t}
                  x1={outer}
                  y1={sTY + (1250 - sTY) * t}
                  x2={iTop + (iBot - iTop) * t}
                  y2={sTY + (sBY - sTY) * t}
                />
              ))}
            </g>
            {/* front wall of the lower tier, catching pitch light */}
            <path
              d={`M${iTop} ${sTY} L${iBot} ${sBY} L${iBot + (left ? 9 : -9)} ${sBY} L${iTop + (left ? 7 : -7)} ${sTY} Z`}
              fill="rgba(140,168,168,0.07)"
            />
            <path d={quad} fill={left ? "url(#sideShadeL)" : "url(#sideShadeR)"} />
          </g>
        );
      })}

      {/* ---------------- near stand (bottom, backlit) ---------------- */}
      <g>
        <path d={`M0 1250 H1000 V${sBY} H${sBR} L${sBL} ${sBY} H0 Z`} fill="#0b171b" />
        <rect
          x="0"
          y={sBY}
          width="1000"
          height={Math.max(0, 1250 - sBY)}
          fill="url(#crowdNear)"
          opacity="0.26"
        />
        <rect
          x="0"
          y={sBY}
          width="1000"
          height={Math.max(0, 1250 - sBY)}
          fill="url(#rake)"
          opacity="0.5"
        />
        <rect
          x="0"
          y={sBY}
          width="1000"
          height={Math.max(0, 1250 - sBY)}
          filter="url(#mottle)"
          opacity="0.85"
        />
        <rect x="0" y={sBY} width="1000" height={Math.max(0, 1250 - sBY)} fill="url(#hazeNear)" />
      </g>

      {/* ---------------- pitch-side apron ---------------- */}
      <path d={`M${aTL} ${aTY} H${aTR} L${aBR} ${aBY} H${aBL} Z`} fill="url(#apron)" />
      {/* light spill from the LED ring onto the apron */}
      <path d={`M${aTL} ${aTY} H${aTR} L${aBR} ${aBY} H${aBL} Z`} fill="url(#pool)" opacity="0.5" />

      {/* ---------------- LED advertising ring ---------------- */}
      <g opacity={compact ? 0.85 : 1}>
        <LedRun
          x1={aTL}
          y1={aTY}
          x2={aTR}
          y2={aTY}
          depth={[compact ? 8 : 15, compact ? 8 : 15]}
          segments={compact ? 7 : 11}
          opacity={0.78}
        />
        <LedRun
          x1={aTL}
          y1={aTY}
          x2={aBL}
          y2={aBY}
          depth={[compact ? 8 : 15, compact ? 10 : 26]}
          segments={compact ? 8 : 12}
          opacity={0.9}
        />
        <LedRun
          x1={aTR}
          y1={aTY}
          x2={aBR}
          y2={aBY}
          depth={[compact ? 8 : 15, compact ? 10 : 26]}
          segments={compact ? 8 : 12}
          opacity={0.9}
        />
        <LedRun
          x1={aBL}
          y1={aBY}
          x2={aBR}
          y2={aBY}
          depth={[compact ? 10 : 26, compact ? 10 : 26]}
          segments={compact ? 7 : 10}
        />
      </g>

      {/* dugouts + technical area on the near touchline */}
      {!compact && (
        <g>
          {[aBL + 120, aBR - 300].map((x) => (
            <g key={x} transform={`translate(${x} ${aBY + 26})`}>
              <path d="M0 0 H180 L172 -17 H8 Z" fill="#0a1519" />
              <path d="M8 -17 H172 L168 -21 H12 Z" fill="rgba(170,195,195,0.12)" />
              <rect x="14" y="-12" width="152" height="4" fill="rgba(160,190,190,0.07)" />
            </g>
          ))}
        </g>
      )}

      {/* ---------------- floodlights ---------------- */}
      {!compact &&
        (
          [
            [126, 46, 1],
            [874, 46, -1],
          ] as const
        ).map(([x, y, dir]) => (
          <g key={x}>
            {/* soft beam falling toward the pitch — restrained, not a glow blob */}
            <path
              d={`M${x - 46} ${y + 12} H${x + 46} L${x + 250 * dir} ${y + 520} L${x - 250 * dir} ${y + 520} Z`}
              fill="url(#beam)"
              opacity="0.5"
            />
            {/* lattice mast */}
            <path
              d={`M${x - 6} ${y + 96} L${x - 3.5} ${y + 14} H${x + 3.5} L${x + 6} ${y + 96} Z`}
              fill="#0c1418"
            />
            <g stroke="rgba(150,175,180,0.16)" strokeWidth="1">
              {[0, 1, 2].map((i) => (
                <line key={i} x1={x - 5} y1={y + 26 * i + 20} x2={x + 5} y2={y + 26 * i + 46} />
              ))}
            </g>
            {/* lamp rack */}
            <path
              d={`M${x - 52} ${y - 4} H${x + 52} L${x + 46} ${y + 14} H${x - 46} Z`}
              fill="#111c20"
            />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <g key={i}>
                <rect
                  x={x - 44 + i * 15}
                  y={y - 1}
                  width="11"
                  height="11"
                  rx="1.5"
                  fill="#f4faf5"
                  opacity="0.8"
                />
                <rect
                  x={x - 44 + i * 15}
                  y={y - 1}
                  width="11"
                  height="4"
                  rx="1.5"
                  fill="#ffffff"
                  opacity="0.5"
                />
              </g>
            ))}
            <ellipse cx={x} cy={y + 5} rx="76" ry="26" fill="url(#pool)" opacity="0.6" />
          </g>
        ))}

      {/* broad wash so bowl and pitch share one lighting model */}
      <ellipse cx="500" cy="300" rx="600" ry="330" fill="url(#pool)" opacity="0.3" />
      <ellipse cx="500" cy="930" rx="520" ry="340" fill="url(#pool)" opacity="0.14" />
    </svg>
  );
}
