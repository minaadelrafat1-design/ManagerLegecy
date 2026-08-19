/**
 * VISUAL REFERENCE & COLOR GUIDE
 * Manager Legacy Redesign
 * 
 * This document provides the visual direction and design specifications
 * for the new UI system.
 */

/**
 * NAVIGATION BAR LAYOUT
 * 
 * [⚽ Manager Legacy / Club Name] [HOME] [CENTRAL] [SQUAD] [TACTICS] [TRANSFERS] [DEVELOPMENT] [CLUB] [MANAGER] [Profile] [New Career]
 * 
 * Sticky, 56px height
 * Background: #020617 (deep navy)
 * Border-bottom: 1px solid rgba(100, 116, 139, 0.2)
 * Backdrop filter: blur(8px)
 */

const NAVIGATION_SPECS = {
  height: "56px",
  background: "#020617",
  backdropFilter: "blur(8px)",
  stickyTop: true,
  zIndex: 40,
  border: {
    bottom: "1px solid rgba(100, 116, 139, 0.2)",
  },
  sections: [
    {
      label: "HOME",
      icon: "⌂",
      active: "background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.4); color: #4ADE80;",
      inactive: "color: #CBD5E1; border: 1px solid transparent;",
    },
    {
      label: "CENTRAL",
      icon: "📰",
    },
    {
      label: "SQUAD",
      icon: "👥",
    },
    {
      label: "TACTICS",
      icon: "🎯",
    },
    {
      label: "TRANSFERS",
      icon: "🔄",
    },
    {
      label: "DEVELOPMENT",
      icon: "📈",
    },
    {
      label: "CLUB",
      icon: "🏟",
    },
    {
      label: "MANAGER",
      icon: "👔",
    },
  ],
};

/**
 * COLOR PALETTE
 * 
 * PRIMARY COLORS (Stadium/Pitch Inspired)
 */
const COLOR_GUIDE = {
  // Background Layers - Deep to Light
  backgrounds: {
    surface: "#020617",        // Page background (deepest)
    elevation0: "#0F172A",     // Stadium night sky
    elevation1: "#1E293B",     // Card backgrounds
    elevation2: "#334155",     // Raised elements
    elevation3: "#475569",     // Hover states
  },

  // Primary Brand - Grass Green
  primaryGreen: {
    50: "#F0FDF4",
    100: "#DCFCE7",
    300: "#86EFAC",
    400: "#4ADE80",
    500: "#22C55E",  // Main brand color
    600: "#16A34A",
    700: "#15803D",
  },

  // Secondary - Football Blue (Sky)
  secondaryBlue: {
    50: "#F0F9FF",
    300: "#7DD3FC",
    500: "#0EA5E9",  // Football sky
    700: "#0369A1",
  },

  // Text & Contrast
  text: {
    primary: "#F8FAFC",        // Main text (almost white)
    secondary: "#CBD5E1",      // Secondary labels
    tertiary: "#94A3B8",       // Muted text
    muted: "#64748B",          // Disabled, very subtle
    inverse: "#020617",        // White on green button
  },

  // Borders & Lines (Stadium Lines)
  borders: {
    default: "rgba(100, 116, 139, 0.2)",   // Subtle
    mid: "rgba(100, 116, 139, 0.4)",       // Medium
    strong: "rgba(100, 116, 139, 0.6)",    // Strong
    focus: "rgba(34, 197, 94, 0.4)",       // Focus (green)
  },

  // Semantic
  success: "#22C55E",
  warning: "#EAB308",
  error: "#EF4444",
  info: "#3B82F6",
};

/**
 * COMPONENT STYLING EXAMPLES
 */

const COMPONENT_EXAMPLES = {
  // Primary Button
  buttonPrimary: {
    background: "linear-gradient(180deg, #4CF0A4 0%, #22C55E 52%, #15803D 100%)",
    color: "#020617",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "8px",
    padding: "12px 22px",
    fontWeight: 800,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 8px 20px -12px rgba(47,224,138,0.75)",
    description: "Green gradient with glow - premium feel",
  },

  // Secondary Button
  buttonSecondary: {
    background: "#334155",
    border: "1px solid rgba(100, 116, 139, 0.2)",
    color: "#CBD5E1",
    borderRadius: "8px",
    padding: "12px 22px",
    hover: "background: #475569; border-color: rgba(100, 116, 139, 0.4);",
    description: "Subtle with hover enhancement",
  },

  // Card / Panel
  panel: {
    background: "#1E293B",
    border: "1px solid rgba(100, 116, 139, 0.2)",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
    description: "Elevation 1 - main card container",
  },

  // Panel Raised
  panelRaised: {
    background: "#334155",
    border: "1px solid rgba(100, 116, 139, 0.4)",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    description: "Elevation 2 - prominent cards",
  },

  // Input Field
  input: {
    background: "#1E293B",
    border: "1px solid rgba(100, 116, 139, 0.2)",
    borderRadius: "8px",
    padding: "12px 16px",
    color: "#F8FAFC",
    placeholder: "color: #94A3B8;",
    focusBorder: "1px solid rgba(34, 197, 94, 0.4)",
    description: "Clean input with green focus state",
  },

  // Badge
  badge: {
    background: "#334155",
    color: "#CBD5E1",
    borderRadius: "9999px",
    padding: "4px 12px",
    fontSize: "11px",
    fontWeight: 600,
    description: "Small status indicators",
  },
};

/**
 * TYPOGRAPHY HIERARCHY
 */

const TYPOGRAPHY_SCALE = {
  xs: {
    size: "11px",
    weight: 400,
    lineHeight: "1.3",
    use: "Small labels, hints",
  },
  sm: {
    size: "12px",
    weight: 500,
    lineHeight: "1.4",
    use: "Small text, secondary info",
  },
  base: {
    size: "14px",
    weight: 400,
    lineHeight: "1.5",
    use: "Body text, descriptions",
  },
  md: {
    size: "16px",
    weight: 500,
    lineHeight: "1.5",
    use: "Card titles, section headers",
  },
  lg: {
    size: "18px",
    weight: 600,
    lineHeight: "1.4",
    use: "Section titles",
  },
  xl: {
    size: "20px",
    weight: 700,
    lineHeight: "1.3",
    use: "Page sections",
  },
  "2xl": {
    size: "24px",
    weight: 800,
    lineHeight: "1.2",
    use: "Secondary headings",
  },
  "3xl": {
    size: "32px",
    weight: 900,
    lineHeight: "1.1",
    use: "Page headings",
  },
  "4xl": {
    size: "40px",
    weight: 900,
    lineHeight: "1",
    use: "Hero titles",
  },
};

const TYPOGRAPHY_FAMILIES = {
  display: "'Rajdhani', 'Chakra Petch', monospace",
  ui: "'Chakra Petch', 'Inter', sans-serif",
  body: "'Inter', 'Segoe UI', sans-serif",
  description: {
    display: "Bold, gaming-style energy (headings)",
    ui: "Clean, command center feeling (UI elements)",
    body: "Highly readable (body text, descriptions)",
  },
};

/**
 * SPACING SYSTEM
 * 
 * Based on 8px unit (8, 12, 16, 20, 24, 32, 40, 48px)
 */

const SPACING = {
  xs: "4px",      // Minimal gaps
  sm: "8px",      // Small gaps, padding
  md: "12px",     // Default padding
  lg: "16px",     // Main padding
  xl: "20px",     // Large sections
  "2xl": "24px",  // Very large sections
  "3xl": "32px",  // Section spacing
  "4xl": "40px",  // Page spacing
  "5xl": "48px",  // Hero spacing
};

/**
 * SHADOWS & GLOW EFFECTS
 */

const SHADOWS = {
  none: "none",
  xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  sm: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  glowGreen: "0 0 20px rgba(34, 197, 94, 0.3)",
  glowBlue: "0 0 20px rgba(14, 165, 233, 0.3)",
  inset: "inset 0 1px 0 rgba(255, 255, 255, 0.08)",
};

/**
 * RESPONSIVE BREAKPOINTS
 */

const BREAKPOINTS = {
  xs: "0px",      // Mobile
  sm: "640px",    // Small tablets
  md: "768px",    // Tablets
  lg: "1024px",   // Small desktop
  xl: "1280px",   // Desktop
  "2xl": "1536px", // Large desktop
};

const RESPONSIVE_LAYOUT = {
  mobileFirst: true,
  designStrategy: "Desktop optimized, mobile supported",
  maxContentWidth: "1600px",
  defaultPadding: "16px on all sides",
  horizontalScroll: "Navigation scrolls horizontally on narrow viewports",
};

/**
 * DESIGN PRINCIPLES
 * 
 * 1. PREMIUM FOOTBALL AESTHETIC
 *    - Stadium night colors (deep navy)
 *    - Grass green accents (pitch inspiration)
 *    - Professional, not playful
 *    - Manager/coach perspective
 * 
 * 2. CLEAR HIERARCHY
 *    - Large headings with clear weight
 *    - Consistent spacing
 *    - Visual grouping with panels
 *    - Active state highlighting
 * 
 * 3. DARK THEME
 *    - Reduces eye strain for long play sessions
 *    - Premium, focused atmosphere
 *    - Better for concentrating on stats/data
 *    - Green/blue accents pop against dark
 * 
 * 4. MINIMAL MOTION
 *    - Fast transitions (150-200ms)
 *    - Subtle hover effects
 *    - No distraction from gameplay
 *    - Functional, not flashy
 * 
 * 5. ACCESSIBILITY
 *    - High contrast text
 *    - Semantic color usage
 *    - Clear focus states
 *    - Readable fonts at all sizes
 * 
 * 6. COMMAND CENTER VIBE
 *    - Top navigation like mission control
 *    - Clear section organization
 *    - Efficient information density
 *    - Professional, managerial feel
 */

/**
 * ORIGINAL VS INSPIRED APPROACH
 * 
 * NOT COPYING EA Sports:
 * ✗ No EA logos, icons, or branding
 * ✗ No exact color matching
 * ✗ No exact layout replication
 * ✗ No proprietary asset reuse
 * 
 * ORIGINAL DESIGN:
 * ✓ Custom color palette (stadium-inspired)
 * ✓ Unique section mapping (8 areas)
 * ✓ Original navigation design
 * ✓ Custom typography hierarchy
 * ✓ Unique design system
 * ✓ Original component structure
 * 
 * INSPIRED BY CONCEPT:
 * ✓ Persistent top navigation
 * ✓ Clear section organization
 * ✓ Dark premium aesthetic
 * ✓ Information hierarchy
 * ✓ Professional management feel
 * ✓ Focus on gameplay over visuals
 */

/**
 * USAGE IN COMPONENTS
 * 
 * Everything is defined in:
 * - src/components/design-system.ts
 * 
 * Import and use:
 * 
 * import { Colors, Spacing, Typography, Borders, Shadows } from "@/components/design-system";
 * 
 * const myStyle = {
 *   background: Colors.bg.elevation1,
 *   padding: Spacing.lg,
 *   borderRadius: Borders.radius.md,
 *   color: Colors.text.primary,
 *   boxShadow: Shadows.md,
 * };
 */
