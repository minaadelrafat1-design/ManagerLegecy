import { useId } from "react";

/* ---------------------------------------------------------------------------
 * PlayerFigure — a generic, fictional footballer rendered as vector art.
 * No real-world likeness: a neutral athletic silhouette in a team kit with a
 * shirt number. Purely presentational; it takes no game state and owns no
 * logic. Same public API as before — the extra props are optional.
 *
 * Lighting convention matches the pitch: key light from the top-left
 * floodlight rig, cool bounce from the grass, contact shadow underfoot.
 * ------------------------------------------------------------------------- */

export interface Kit {
  primary: string;
  secondary: string;
  text: string;
}

const SKIN = "#C08F68";
const SKIN_LIT = "#E0B48D";
const SKIN_SHADE = "#9C7050";
const SKIN_DARK = "#7C5739";
const HAIR = "#211913";
const HAIR_LIT = "#4A382A";
const BOOT = "#101519";
const BOOT_LIT = "#232C34";

export function PlayerFigure({
  kit,
  number,
  height = 44,
  striped = false,
  keeper = false,
  dim = false,
  selected = false,
  hovered = false,
  contactShadow = false,
}: {
  kit: Kit;
  number: number;
  height?: number;
  striped?: boolean;
  keeper?: boolean;
  dim?: boolean;
  /** highlights the figure with a warm rim light (selected player) */
  selected?: boolean;
  /** subtle lift in the rim light (pointer hover) */
  hovered?: boolean;
  /** draws an elliptical contact shadow underfoot inside the SVG */
  contactShadow?: boolean;
}) {
  const id = useId().replace(/:/g, "_");
  const shirt = keeper ? "#E8BC5C" : kit.primary;
  const trim = keeper ? "#7A5716" : kit.secondary;
  const ink = keeper ? "#2A1F06" : kit.text;
  const sockBase = keeper ? "#2A2416" : trim;
  const w = (height * 44) / 68;

  const rim = selected
    ? "drop-shadow(0 0 3px rgba(232,188,92,0.85))"
    : hovered
      ? "drop-shadow(0 0 2.5px rgba(255,255,255,0.5))"
      : "";

  return (
    <svg
      width={w}
      height={height}
      viewBox="0 0 44 68"
      aria-hidden
      style={{
        display: "block",
        overflow: "visible",
        opacity: dim ? 0.72 : 1,
        filter: `drop-shadow(0 1px 1px rgba(0,0,0,0.4)) drop-shadow(1px 2px 2.5px rgba(0,0,0,0.28))${rim ? ` ${rim}` : ""}`,
        transition: "opacity 0.25s ease, filter 0.22s ease",
      }}
    >
      <defs>
        {/* kit fabric: key light top-left, shadow bottom-right */}
        <linearGradient id={`${id}-shirt`} x1="0.08" y1="0" x2="0.95" y2="0.92">
          <stop offset="0%" stopColor={shirt} />
          <stop offset="42%" stopColor={shirt} />
          <stop offset="100%" stopColor={trim} />
        </linearGradient>
        <pattern id={`${id}-stripe`} width="6.4" height="4" patternUnits="userSpaceOnUse">
          <rect width="6.4" height="4" fill={shirt} />
          <rect width="3" height="4" fill={trim} />
        </pattern>
        <linearGradient id={`${id}-shorts`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor={trim} />
          <stop offset="60%" stopColor={trim} />
          <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id={`${id}-sock`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={sockBase} />
          <stop offset="45%" stopColor={sockBase} />
          <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id={`${id}-skin`} x1="0.1" y1="0" x2="0.95" y2="0.6">
          <stop offset="0%" stopColor={SKIN_LIT} />
          <stop offset="48%" stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_DARK} />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx="0.34" cy="0.26" r="0.88">
          <stop offset="0%" stopColor="#EBC49F" />
          <stop offset="52%" stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_DARK} />
        </radialGradient>
        {/* directional wrap applied over the kit */}
        <linearGradient id={`${id}-light`} x1="0.05" y1="0" x2="0.95" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="38%" stopColor="#fff" stopOpacity="0.06" />
          <stop offset="72%" stopColor="#000" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.3" />
        </linearGradient>
        {/* cool grass bounce from below */}
        <linearGradient id={`${id}-bounce`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#9FE3B8" stopOpacity="0.22" />
          <stop offset="45%" stopColor="#9FE3B8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-contact`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#000" stopOpacity="0.62" />
          <stop offset="58%" stopColor="#000" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ---- contact shadow on the turf ---- */}
      {contactShadow && (
        <ellipse cx="22.6" cy="66.2" rx="11" ry="3.1" fill={`url(#${id}-contact)`} />
      )}

      {/* ---- legs: quad / knee / calf taper ---- */}
      <path
        d="M15.9 45.2c2.1-.6 4.2-.6 6.3 0l-.7 6.6-.4 5.4h-4.6l-.6-5.6z"
        fill={`url(#${id}-skin)`}
      />
      <path d="M22.4 45.2c2.1-.6 4.2-.6 6.3 0l-.5 6.6-.4 5.4h-4.6l-.6-5.6z" fill={SKIN_SHADE} />
      {/* knee highlight */}
      <ellipse cx="18.6" cy="51.3" rx="2" ry="1.2" fill="#fff" opacity="0.1" />

      {/* ---- socks: turnover cuff, shin bulge, tapered ankle ---- */}
      <path d="M16.3 55.9h5.2l-.5 5.1-.35 2.1h-3.6l-.4-2.2z" fill={`url(#${id}-sock)`} />
      <path d="M23.1 55.9h5.2l-.5 5.1-.35 2.1h-3.6l-.4-2.2z" fill={`url(#${id}-sock)`} />
      {/* cuff turnover */}
      <path
        d="M16.3 55.9h5.2l-.16 1.7h-4.9zM23.1 55.9h5.2l-.16 1.7h-4.9z"
        fill="#fff"
        opacity="0.3"
      />
      <path
        d="M16.14 57.6h5.04M22.94 57.6h5.04"
        stroke="#000"
        strokeOpacity="0.25"
        strokeWidth="0.4"
      />

      {/* ---- boots: low-cut, studded sole, toe box ---- */}
      <path
        d="M16.6 62.9h4c.5 1.4 1.7 2.2 3.3 2.5.6.1.9.5.9 1.1 0 .5-.4.8-1 .8h-7.6c-.6 0-1-.4-1-1 0-1.3.5-2.5 1.4-3.4z"
        fill={BOOT}
      />
      <path
        d="M23.4 62.9h4c.5 1.4 1.7 2.2 3.4 2.5.6.1.9.5.9 1.1 0 .5-.4.8-1 .8h-7.7c-.6 0-1-.4-1-1 0-1.3.5-2.5 1.4-3.4z"
        fill={BOOT_LIT}
      />
      {/* boot sheen + laces */}
      <path
        d="M16.9 63.6c.9-.4 1.9-.5 2.9-.3M23.7 63.6c.9-.4 1.9-.5 2.9-.3"
        stroke="#fff"
        strokeOpacity="0.22"
        strokeWidth="0.6"
        fill="none"
      />
      <path d="M15.4 66.4h9.1M22.2 66.4h9.2" stroke="#fff" strokeOpacity="0.12" strokeWidth="0.5" />
      {/* boot flash in kit trim */}
      <path
        d="M18.4 64.7c1.4.5 2.7.9 4 1.1M25.2 64.7c1.4.5 2.8.9 4.1 1.1"
        stroke={keeper ? "#E8BC5C" : kit.secondary}
        strokeOpacity="0.75"
        strokeWidth="0.7"
        fill="none"
      />

      {/* ---- shorts: separate garment, hem break over the thigh ---- */}
      <path
        d="M13.9 39.4c5.4 1.2 10.8 1.2 16.2 0l1.6 8.1c0 .8-.5 1.3-1.4 1.4-1.8.3-3.6.3-5.4 0l-2.9-3.6-2.9 3.6c-1.8.3-3.6.3-5.4 0-.9-.1-1.4-.6-1.4-1.4z"
        fill={`url(#${id}-shorts)`}
      />
      {/* waistband */}
      <path
        d="M13.9 39.4c5.4 1.2 10.8 1.2 16.2 0l.35 1.8c-5.6 1.2-11.3 1.2-16.9 0z"
        fill="#000"
        opacity="0.28"
      />
      <path
        d="M14.15 40.7c5.5 1.1 11 1.1 16.5 0"
        stroke="#fff"
        strokeOpacity="0.18"
        strokeWidth="0.5"
        fill="none"
      />
      {/* hem trim */}
      <path
        d="M13.9 47c1.9.5 3.8.7 5.7.6M24.4 47.6c1.9.1 3.8-.1 5.7-.6"
        stroke={shirt}
        strokeOpacity="0.5"
        strokeWidth="0.8"
        fill="none"
      />
      {/* shorts shadow under the shirt hem */}
      <path
        d="M13.9 39.4c5.4 1.2 10.8 1.2 16.2 0l.2 1c-5.5 1.3-11.1 1.3-16.6 0z"
        fill="#000"
        opacity="0.35"
      />

      {/* ---- torso + sleeves: rounded deltoids, athletic taper ---- */}
      <path
        d="M22 14.8c-2.7 0-4.7-.7-6.1-1.7-2.7.7-5.1 1.7-7.1 3.1-1.3.9-2 2.1-2.3 3.6l-1.5 6.3c-.2 1 .2 1.7 1.2 2l3.3 1.1c1 .3 1.7-.1 2-1.1l.9-2.9c.3 5.5.1 11-.6 16.4 6.7 1.6 13.7 1.6 20.4 0-.7-5.4-.9-10.9-.6-16.4l.9 2.9c.3 1 1 1.4 2 1.1l3.3-1.1c1-.3 1.4-1 1.2-2l-1.5-6.3c-.3-1.5-1-2.7-2.3-3.6-2-1.4-4.4-2.4-7.1-3.1-1.4 1-3.4 1.7-6.1 1.7z"
        fill={striped ? `url(#${id}-stripe)` : `url(#${id}-shirt)`}
      />
      {/* directional light wrap */}
      <path
        d="M22 14.8c-2.7 0-4.7-.7-6.1-1.7-2.7.7-5.1 1.7-7.1 3.1-1.3.9-2 2.1-2.3 3.6l-1.5 6.3c-.2 1 .2 1.7 1.2 2l3.3 1.1c1 .3 1.7-.1 2-1.1l.9-2.9c.3 5.5.1 11-.6 16.4 6.7 1.6 13.7 1.6 20.4 0-.7-5.4-.9-10.9-.6-16.4l.9 2.9c.3 1 1 1.4 2 1.1l3.3-1.1c1-.3 1.4-1 1.2-2l-1.5-6.3c-.3-1.5-1-2.7-2.3-3.6-2-1.4-4.4-2.4-7.1-3.1-1.4 1-3.4 1.7-6.1 1.7z"
        fill={`url(#${id}-light)`}
      />
      {/* grass bounce on the lower shirt */}
      <path
        d="M13.4 36.2c5.7 1.2 11.5 1.2 17.2 0l.5 6.4c-6 1.4-12.2 1.4-18.2 0z"
        fill={`url(#${id}-bounce)`}
      />
      {/* chest / lat shading on the shaded side */}
      <path
        d="M28.1 13.1c-1.4 1-3.4 1.7-6.1 1.7v28.1c3.4 0 6.9-.3 10.2-1-.7-5.4-.9-10.9-.6-16.4l.9 2.9c.3 1 1 1.4 2 1.1l3.3-1.1c1-.3 1.4-1 1.2-2l-1.5-6.3c-.3-1.5-1-2.7-2.3-3.6-2-1.4-4.4-2.4-7.1-3.1z"
        fill="#000"
        opacity="0.16"
      />
      {/* sleeve cuffs */}
      <path
        d="M7.3 25.4c1.9.5 3.8 1.2 5.6 2l-.5 1.7c-1.8-.8-3.6-1.4-5.5-1.9zM36.7 25.4c-1.9.5-3.8 1.2-5.6 2l.5 1.7c1.8-.8 3.6-1.4 5.5-1.9z"
        fill={trim}
        opacity="0.9"
      />
      {/* shoulder seams */}
      <path
        d="M15.6 14.2c-1 2.1-1.6 4.3-1.9 6.6M28.4 14.2c1 2.1 1.6 4.3 1.9 6.6"
        stroke="#000"
        strokeOpacity="0.14"
        strokeWidth="0.6"
        fill="none"
      />
      {/* collar */}
      <path
        d="M15.9 13.1c1.7 2.1 3.7 3.6 6.1 4.6 2.4-1 4.4-2.5 6.1-4.6l-1.7-.6c-1.3 1.4-2.8 2.4-4.4 3-1.6-.6-3.1-1.6-4.4-3z"
        fill={trim}
      />
      <path
        d="M17.1 13.6c1.4 1.6 3 2.8 4.9 3.5"
        stroke="#fff"
        strokeOpacity="0.22"
        strokeWidth="0.5"
        fill="none"
      />

      {/* ---- shirt number ---- */}
      <text
        x="22"
        y="35.2"
        textAnchor="middle"
        fontFamily="'Chakra Petch', 'Arial Narrow', sans-serif"
        fontSize="11.5"
        fontWeight="800"
        fill="#000"
        opacity="0.3"
        transform="translate(0.4 0.5)"
      >
        {number}
      </text>
      <text
        x="22"
        y="35.2"
        textAnchor="middle"
        fontFamily="'Chakra Petch', 'Arial Narrow', sans-serif"
        fontSize="11.5"
        fontWeight="800"
        fill={ink}
        opacity="0.95"
        stroke={ink === "#ffffff" || ink === "#fff" ? "none" : "rgba(255,255,255,0.16)"}
        strokeWidth="0.3"
      >
        {number}
      </text>

      {/* ---- neck + head ---- */}
      <path d="M19.9 9.9h4.3v4.5c-1.4 1-2.9 1-4.3 0z" fill={SKIN_SHADE} />
      <path d="M19.9 12.4c1.4.9 2.9.9 4.3 0v2c-1.4 1-2.9 1-4.3 0z" fill="#000" opacity="0.25" />
      <ellipse cx="22" cy="7" rx="5.5" ry="6.3" fill={`url(#${id}-face)`} />
      {/* jaw shading */}
      <path
        d="M17.6 10.2c1.2 2 2.6 3.1 4.4 3.1s3.2-1.1 4.4-3.1c-.7 2.4-2.3 3.7-4.4 3.7s-3.7-1.3-4.4-3.7z"
        fill="#000"
        opacity="0.16"
      />
      {/* brow shadow */}
      <path
        d="M17.4 5.9c3-1 6.2-1 9.2 0l-.3 1.2c-2.9-.9-5.7-.9-8.6 0z"
        fill="#000"
        opacity="0.12"
      />
      {/* ears */}
      <ellipse cx="16.4" cy="7.6" rx="1.1" ry="1.7" fill={SKIN_SHADE} />
      <ellipse cx="27.6" cy="7.6" rx="1.1" ry="1.7" fill={SKIN_SHADE} />
      {/* hair: short crop with a lit top-left plane */}
      <path
        d="M16.5 7c-.5-4.1 2.4-6.8 5.5-6.8s6 2.7 5.5 6.8c-.7-2.2-2.4-3.4-4.4-3.8-2.6-.5-4.9.4-6.6 3.8z"
        fill={HAIR}
      />
      <path d="M16.5 7c1.1-2.2 3-3.5 5.3-3.8-1.9.9-3.3 2.2-4.1 4z" fill={HAIR_LIT} />
      <path
        d="M17.6 4c1.1-1.5 2.6-2.4 4.4-2.6"
        stroke="#fff"
        strokeOpacity="0.16"
        strokeWidth="0.7"
        fill="none"
      />
      {/* floodlight rim on the head */}
      <path
        d="M17.1 4.6c.9-2.1 2.6-3.4 4.9-3.7"
        stroke="#fff"
        strokeOpacity="0.2"
        strokeWidth="0.8"
        fill="none"
      />
    </svg>
  );
}
