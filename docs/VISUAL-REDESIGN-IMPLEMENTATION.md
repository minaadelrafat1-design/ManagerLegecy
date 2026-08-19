/**
 * IMPLEMENTATION GUIDE - Visual & Layout Redesign
 * 
 * This guide explains how to use the new design system and layout components
 * on existing pages without breaking functionality.
 */

/**
 * QUICK START
 */

// 1. GLOBAL DESIGN SYSTEM
// File: src/components/design-system.ts
// Exports: Colors, Spacing, Typography, Borders, Shadows, Transitions, Components, Breakpoints, Layout

// Example:
import { Colors, Spacing, Borders } from "@/components/design-system";

const myStyle = {
  background: Colors.bg.elevation1,
  padding: Spacing.lg,
  borderRadius: Borders.radius.md,
  color: Colors.text.primary,
};

// 2. NEW NAVIGATION SYSTEM
// File: src/components/app-navigation.tsx
// Automatically integrated into src/routes/__root.tsx
// Shows active section based on current route
// 8 sections: HOME, CENTRAL, SQUAD, TACTICS, TRANSFERS, DEVELOPMENT, CLUB, MANAGER

// 3. LAYOUT COMPONENTS
// File: src/components/app-layout.tsx
// Components: AppLayout, PageContainer, PageHeader, ContentGrid, Panel, Section, Divider

import { 
  AppLayout, 
  PageContainer, 
  PageHeader, 
  ContentGrid, 
  Panel, 
  Section 
} from "@/components/app-layout";

/**
 * CONVERTING AN EXISTING PAGE
 * 
 * BEFORE: Old page using inline styles or old TopNav
 * AFTER: Page using new design system and layout components
 */

// EXAMPLE: Converting /squad page

// OLD APPROACH (before redesign):
/*
function SquadScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "...", padding: "20px" }}>
      <ScreenHeader title="Squad" />
      <div style={{ display: "grid", gap: "12px" }}>
        // Squad content
      </div>
    </div>
  );
}
*/

// NEW APPROACH (after redesign):
import { AppLayout, PageContainer, PageHeader, Section, Panel, ContentGrid } from "@/components/app-layout";
import { Colors, Spacing } from "@/components/design-system";

function SquadScreen() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader 
          title="Squad Management"
          subtitle="View squad, manage lineup, player details"
          actions={<button>Some Action</button>}
        />
        
        <ContentGrid columns={2}>
          <Panel header="Starting XI">
            {/* Starting XI content */}
          </Panel>
          
          <Panel header="Squad Status">
            {/* Status content */}
          </Panel>
        </ContentGrid>

        <Section title="All Players" subtitle="Full squad roster">
          <Panel>
            {/* Player list */}
          </Panel>
        </Section>
      </PageContainer>
    </AppLayout>
  );
}

/**
 * DESIGN TOKENS REFERENCE
 */

// Colors - Use Colors.* for all colors
const COLORS_PALETTE = {
  primary: Colors.primary[500],        // Main brand green (grass)
  secondary: Colors.secondary[500],    // Football blue
  backgrounds: {
    surface: Colors.bg.surface,        // Page background
    elevation0: Colors.bg.elevation0,  // Card background
    elevation1: Colors.bg.elevation1,  // Raised elements
    elevation2: Colors.bg.elevation2,  // Very raised elements
  },
  text: {
    primary: Colors.text.primary,      // Main text
    secondary: Colors.text.secondary,  // Secondary text
    muted: Colors.text.muted,          // Disabled, hints
  },
  borders: {
    default: Colors.border.default,    // Subtle lines
    mid: Colors.border.mid,            // Medium emphasis
    focus: Colors.border.focus,        // Focus state (green)
  },
};

// Spacing - Use Spacing.* for consistent spacing
const SPACING_SCALE = {
  xs: Spacing.xs,    // 4px
  sm: Spacing.sm,    // 8px
  md: Spacing.md,    // 12px
  lg: Spacing.lg,    // 16px
  xl: Spacing.xl,    // 20px
  "2xl": Spacing["2xl"], // 24px
  "3xl": Spacing["3xl"], // 32px
};

// Typography - Available font families
const TYPOGRAPHY = {
  display: "'Rajdhani', monospace",  // Bold, gaming-style (use for headings)
  ui: "'Chakra Petch', sans-serif",  // UI elements
  body: "'Inter', sans-serif",       // Body text
};

/**
 * COMPONENT EXAMPLES
 */

// 1. Simple Page with Header and Content
function SimplePage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="My Page" subtitle="Subtitle text" />
        
        <Panel header="Main Content">
          Page content goes here
        </Panel>
      </PageContainer>
    </AppLayout>
  );
}

// 2. Multi-Section Page with Grid
function ComplexPage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Complex Page" />
        
        {/* 2-column layout */}
        <ContentGrid columns={2} gap={Spacing.lg}>
          <Panel elevated header="Column 1 Header">
            Content 1
          </Panel>
          
          <Panel elevated header="Column 2 Header">
            Content 2
          </Panel>
        </ContentGrid>
        
        {/* Full-width section */}
        <Section title="Full Width Section" subtitle="Below the grid">
          <Panel>
            Full width content
          </Panel>
        </Section>
      </PageContainer>
    </AppLayout>
  );
}

// 3. Responsive Grid (Auto-fit columns)
function ResponsivePage() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader title="Responsive Layout" />
        
        <ContentGrid 
          columns="repeat(auto-fit, minmax(300px, 1fr))" 
          gap={Spacing.lg}
        >
          <Panel>Card 1</Panel>
          <Panel>Card 2</Panel>
          <Panel>Card 3</Panel>
          <Panel>Card 4</Panel>
        </ContentGrid>
      </PageContainer>
    </AppLayout>
  );
}

// 4. Custom Styling with Design Tokens
function CustomStyling() {
  return (
    <AppLayout>
      <PageContainer>
        <div
          style={{
            background: Colors.bg.elevation1,
            border: `2px solid ${Colors.primary[500]}`,
            borderRadius: "12px",
            padding: Spacing.xl,
            marginBottom: Spacing.xl,
            color: Colors.text.primary,
          }}
        >
          Custom styled container using design tokens
        </div>
      </PageContainer>
    </AppLayout>
  );
}

/**
 * NAVIGATION SECTION MAPPING
 * 
 * Use this to understand which section your page belongs to,
 * and to know which routes will show each section as active.
 */

const SECTION_ROUTES = {
  home: ["/"],
  central: ["/notifications", "/league-pyramid"],
  squad: ["/squad", "/player", "/staff"],
  tactics: ["/tactics", "/match", "/fixtures"],
  transfers: ["/transfers", "/negotiations"],
  development: ["/training", "/academy", "/treatment"],
  club: ["/board", "/fans"],
  manager: ["/manager-profile"],
};

/**
 * MIGRATION PRIORITY
 * 
 * Suggested order for migrating existing pages:
 * 
 * PHASE 1 (Quick wins - minimal changes):
 * - index.tsx (home)
 * - manager-profile.tsx (manager)
 * 
 * PHASE 2 (Most-used pages):
 * - squad.tsx (squad)
 * - transfers.tsx (transfers)
 * - tactics.tsx (tactics)
 * 
 * PHASE 3 (Admin pages):
 * - board.tsx (club)
 * - training.tsx (development)
 * - academy.tsx (development)
 * 
 * PHASE 4 (Completion):
 * - remaining pages
 * 
 * Note: You can migrate incrementally without breaking existing functionality.
 *       Old pages continue to work as-is, new ones use the new system.
 */

/**
 * TESTING CHECKLIST
 * 
 * After migrating a page:
 * 
 * ✓ Page renders without errors
 * ✓ Navigation shows correct section as active
 * ✓ Responsive layout works (desktop and mobile)
 * ✓ All existing game logic preserved
 * ✓ State management still works
 * ✓ Links navigate correctly
 * ✓ Tests still pass
 * ✓ No console errors
 * ✓ Performance acceptable (<100ms first paint)
 */

/**
 * BACKWARDS COMPATIBILITY
 * 
 * All existing pages continue to work without changes:
 * - Old TopNav (if referenced) still exists
 * - Old styling still works
 * - No breaking changes to routes
 * - No changes to game state or logic
 * 
 * You can migrate pages one at a time at your own pace.
 */
