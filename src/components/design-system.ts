/**
 * Manager Legacy Design System
 *
 * A comprehensive design token system for the football management interface.
 * Based on modern premium dark interfaces with football/stadium atmosphere.
 */

// ─── COLOR PALETTE ──────────────────────────────────────────────────────────

export const Colors = {
  // Compatibility aliases for legacy screen code that still reads flat tokens.
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textTertiary: "#94A3B8",
  textMuted: "#64748B",
  background: "#020617",
  cardBackground: "#1E293B",
  panel: "#1E293B",
  card: "#1E293B",
  borderColor: "rgba(100, 116, 139, 0.2)",
  lineColor: "rgba(100, 116, 139, 0.2)",
  surface: "#020617",
  bgMid: "#334155", // Mid-tone elevation for backgrounds
  text: {
    primary: "#F8FAFC",
    secondary: "#CBD5E1",
    tertiary: "#94A3B8",
    muted: "#64748B",
    inverse: "#020617",
  },
  accent: "#22C55E",
  // Neutrals - Stadium & Pitch Inspired
  // Using deep navy/charcoal as primary backdrop with green accents (grass)
  neutral: {
    0: "#FFFFFF",
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
    950: "#020617",
  },

  // Primary Brand - Stadium Green (Grass & Pitch)
  primary: {
    50: "#F0FDF4",
    100: "#DCFCE7",
    200: "#BBF7D0",
    300: "#86EFAC",
    400: "#4ADE80",
    500: "#22C55E",
    600: "#16A34A",
    700: "#15803D",
    800: "#166534",
    900: "#145231",
  },

  // Secondary - Football/Sky Blue
  secondary: {
    50: "#F0F9FF",
    100: "#E0F2FE",
    200: "#BAE6FD",
    300: "#7DD3FC",
    400: "#38BDF8",
    500: "#0EA5E9",
    600: "#0284C7",
    700: "#0369A1",
    800: "#075985",
    900: "#0C4A6E",
  },

  // Accent - Pitch/Line White (Highlights) [PALETTE ONLY - not used in main Colors]
  accentPalette: {
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#E5E5E5",
    300: "#D4D4D4",
    400: "#A3A3A3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
  },

  // Semantic
  success: "#22C55E",
  warning: "#EAB308",
  error: "#EF4444",
  info: "#3B82F6",

  // Background Layers (Dark Theme)
  bg: {
    surface: "#020617", // Deepest - actual background
    elevation0: "#0F172A", // Stadium night sky
    elevation1: "#1E293B", // Cards, panels
    elevation2: "#334155", // Raised elements
    elevation3: "#475569", // Hovered states
  },

  // Borders & Dividers
  border: {
    default: "rgba(100, 116, 139, 0.2)", // Subtle stadium line
    mid: "rgba(100, 116, 139, 0.4)", // Medium emphasis
    strong: "rgba(100, 116, 139, 0.6)", // Strong dividers
    focus: "rgba(34, 197, 94, 0.4)", // Green focus state
  },

  // Overlays & Glass
  overlay: {
    dark: "rgba(2, 6, 23, 0.8)",
    light: "rgba(248, 250, 252, 0.1)",
    medium: "rgba(30, 41, 59, 0.6)",
  },
} as const;

// ─── SPACING SCALE ──────────────────────────────────────────────────────────

export const Spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "32px",
  "4xl": "40px",
  "5xl": "48px",
} as const;

// ─── TYPOGRAPHY ─────────────────────────────────────────────────────────────

export const Typography = {
  small: "12px",
  base: "14px",
  body: "14px",
  large: "16px",
  // Font families (already in __root.tsx via Google Fonts)
  family: {
    display: "'Rajdhani', 'Chakra Petch', monospace", // Bold, gaming-style
    ui: "'Chakra Petch', 'Inter', sans-serif", // UI, clear
    body: "'Inter', 'Segoe UI', sans-serif", // Content
  },

  // Scale (mobile-first, can scale for desktop)
  scale: {
    xs: {
      size: "11px",
      weight: 400,
      lineHeight: "1.3",
      letterSpacing: "0.04em",
    },
    sm: {
      size: "12px",
      weight: 500,
      lineHeight: "1.4",
      letterSpacing: "0.03em",
    },
    base: {
      size: "14px",
      weight: 400,
      lineHeight: "1.5",
      letterSpacing: "0.02em",
    },
    md: {
      size: "16px",
      weight: 500,
      lineHeight: "1.5",
      letterSpacing: "0.01em",
    },
    lg: {
      size: "18px",
      weight: 600,
      lineHeight: "1.4",
      letterSpacing: "0.01em",
    },
    xl: {
      size: "20px",
      weight: 700,
      lineHeight: "1.3",
      letterSpacing: "-0.01em",
    },
    "2xl": {
      size: "24px",
      weight: 800,
      lineHeight: "1.2",
      letterSpacing: "-0.02em",
    },
    "3xl": {
      size: "32px",
      weight: 900,
      lineHeight: "1.1",
      letterSpacing: "-0.03em",
    },
    "4xl": {
      size: "40px",
      weight: 900,
      lineHeight: "1",
      letterSpacing: "-0.03em",
    },
  },
} as const;

// ─── BORDERS ────────────────────────────────────────────────────────────────

export const Borders = {
  color: "rgba(100, 116, 139, 0.2)",
  radius: {
    none: "0",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },
  width: {
    default: "1px",
    thick: "2px",
  },
} as const;

// ─── SHADOWS ────────────────────────────────────────────────────────────────

export const Shadows = {
  none: "none",
  xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  sm: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",

  // Glows (brand accent)
  glow: {
    green: "0 0 20px rgba(34, 197, 94, 0.3)",
    blue: "0 0 20px rgba(14, 165, 233, 0.3)",
    inset: "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
  },
} as const;

// ─── TRANSITIONS ────────────────────────────────────────────────────────────

export const Transitions = {
  fast: "150ms ease-in-out",
  base: "200ms ease-in-out",
  slow: "300ms ease-in-out",
  verySlow: "500ms ease-in-out",
} as const;

// ─── COMPONENTS PRESETS ─────────────────────────────────────────────────────

export const Components = {
  panel: {
    bg: Colors.bg.elevation1,
    border: `1px solid ${Colors.border.default}`,
    borderRadius: Borders.radius.lg,
    padding: Spacing.lg,
  },

  panelRaised: {
    bg: Colors.bg.elevation2,
    border: `1px solid ${Colors.border.mid}`,
    borderRadius: Borders.radius.lg,
    padding: Spacing.lg,
    boxShadow: Shadows.md,
  },

  button: {
    primary: {
      bg: Colors.primary[500],
      text: Colors.text.inverse,
      hover: Colors.primary[600],
      active: Colors.primary[700],
      disabled: Colors.bg.elevation2,
      disabledText: Colors.text.muted,
      padding: `${Spacing.md} ${Spacing.lg}`,
      borderRadius: Borders.radius.md,
      fontWeight: 700,
      fontSize: "14px",
      transition: Transitions.fast,
    },

    secondary: {
      bg: Colors.bg.elevation2,
      text: Colors.text.primary,
      hover: Colors.bg.elevation3,
      border: Colors.border.default,
      padding: `${Spacing.md} ${Spacing.lg}`,
      borderRadius: Borders.radius.md,
      fontWeight: 600,
      fontSize: "14px",
      transition: Transitions.fast,
    },

    tertiary: {
      bg: "transparent",
      text: Colors.text.secondary,
      hover: Colors.overlay.light,
      padding: `${Spacing.sm} ${Spacing.md}`,
      borderRadius: Borders.radius.md,
      fontSize: "12px",
      transition: Transitions.fast,
    },
  },

  input: {
    bg: Colors.bg.elevation1,
    border: Colors.border.default,
    borderFocus: Colors.border.focus,
    text: Colors.text.primary,
    placeholder: Colors.text.tertiary,
    borderRadius: Borders.radius.md,
    padding: `${Spacing.md} ${Spacing.lg}`,
  },

  badge: {
    bg: Colors.bg.elevation2,
    text: Colors.text.secondary,
    borderRadius: Borders.radius.full,
    padding: `${Spacing.xs} ${Spacing.md}`,
    fontSize: "11px",
    fontWeight: 600,
  },
} as const;

// ─── RESPONSIVE BREAKPOINTS ─────────────────────────────────────────────────

export const Breakpoints = {
  xs: "0px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

// ─── LAYOUT DIMENSIONS ──────────────────────────────────────────────────────

export const Layout = {
  navigation: {
    height: "56px",
    heightMobile: "48px",
  },
  sidebar: {
    width: "260px",
    widthCollapsed: "80px",
  },
  maxWidth: "1600px",
} as const;

// ─── EXPORT AS OBJECT (for backwards compatibility) ───────────────────────

export const DesignSystem = {
  Colors,
  Spacing,
  Typography,
  Borders,
  Shadows,
  Transitions,
  Components,
  Breakpoints,
  Layout,
} as const;

export default DesignSystem;
