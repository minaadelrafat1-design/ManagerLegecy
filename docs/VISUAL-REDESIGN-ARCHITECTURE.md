/**
 * ROUTE MAPPING GUIDE
 * 
 * Comprehensive mapping of all existing routes to the 8-section navigation structure
 */

export const ROUTE_MAPPING = {
  // HOME SECTION
  // Entrypoint, career overview, next fixture, urgent actions
  "home": {
    id: "home",
    label: "Home",
    icon: "⌂",
    primaryRoute: "/",
    description: "Career overview",
    routes: [
      {
        path: "/",
        file: "index.tsx",
        name: "Manager HQ",
        description: "Dashboard with next fixture, league position, squad overview",
        status: "existing",
        preserved: true,
      },
    ],
  },

  // CENTRAL SECTION
  // News, events, notifications, world view
  "central": {
    id: "central",
    label: "Central",
    icon: "📰",
    primaryRoute: "/league-pyramid",
    description: "News & events",
    routes: [
      {
        path: "/league-pyramid",
        file: "league-pyramid.tsx",
        name: "Leagues & Pyramid",
        description: "World league overview, standings across divisions",
        status: "existing",
        preserved: true,
        note: "Currently world view; could show news/events in future",
      },
      {
        path: "/notifications",
        name: "Notifications",
        description: "Game events, messages, alerts [Future Implementation]",
        status: "planned",
      },
    ],
  },

  // SQUAD SECTION
  // Team management, player profiles, staff
  "squad": {
    id: "squad",
    label: "Squad",
    icon: "👥",
    primaryRoute: "/squad",
    description: "Team management",
    routes: [
      {
        path: "/squad",
        file: "squad.tsx",
        name: "Squad Management",
        description: "View squad, manage lineup, player details",
        status: "existing",
        preserved: true,
      },
      {
        path: "/player/:playerId",
        file: "player.$playerId.tsx",
        name: "Player Profile",
        description: "Individual player stats, contract, development",
        status: "existing",
        preserved: true,
      },
      {
        path: "/staff",
        file: "staff.tsx",
        name: "Staff Management",
        description: "Hire, manage, and review coaching staff",
        status: "existing",
        preserved: true,
      },
    ],
  },

  // TACTICS SECTION
  // Formations, tactical settings, match preparation
  "tactics": {
    id: "tactics",
    label: "Tactics",
    icon: "🎯",
    primaryRoute: "/tactics",
    description: "Formation & prep",
    routes: [
      {
        path: "/tactics",
        file: "tactics.tsx",
        name: "Tactics & Formation",
        description: "Set formation, player roles, tactical instructions",
        status: "existing",
        preserved: true,
      },
      {
        path: "/match",
        file: "match.tsx",
        name: "Match Day",
        description: "Live match simulation and result recording",
        status: "existing",
        preserved: true,
        note: "Full-screen experience; shown in TACTICS during match day",
      },
      {
        path: "/fixtures",
        file: "fixtures.tsx or fixtures-modern.tsx",
        name: "Fixtures",
        description: "View upcoming fixtures and schedule",
        status: "existing",
        preserved: true,
        note: "Could be in TACTICS or HOME; currently standalone",
      },
    ],
  },

  // TRANSFERS SECTION
  // Transfer market, negotiations, contracts
  "transfers": {
    id: "transfers",
    label: "Transfers",
    icon: "🔄",
    primaryRoute: "/transfers",
    description: "Market & deals",
    routes: [
      {
        path: "/transfers",
        file: "transfers.tsx",
        name: "Transfer Market",
        description: "Buy/sell players, manage transfer listings",
        status: "existing",
        preserved: true,
      },
      {
        path: "/negotiations",
        file: "-negotiations.tsx",
        name: "Negotiations",
        description: "Active transfer and contract negotiations",
        status: "existing",
        preserved: true,
      },
    ],
  },

  // DEVELOPMENT SECTION
  // Training, academy, recovery/treatment
  "development": {
    id: "development",
    label: "Development",
    icon: "📈",
    primaryRoute: "/training",
    description: "Growth & training",
    routes: [
      {
        path: "/training",
        file: "training.tsx",
        name: "Training Ground",
        description: "Set team training focus and player development",
        status: "existing",
        preserved: true,
      },
      {
        path: "/academy",
        file: "academy.tsx",
        name: "Academy",
        description: "Youth development, academy squad, promotions",
        status: "existing",
        preserved: true,
      },
      {
        path: "/treatment",
        file: "treatment.tsx",
        name: "Treatment Room",
        description: "Injury management, recovery, medical staff",
        status: "existing",
        preserved: true,
      },
    ],
  },

  // CLUB SECTION
  // Board, fans, club management
  "club": {
    id: "club",
    label: "Club",
    icon: "🏟",
    primaryRoute: "/board",
    description: "Club management",
    routes: [
      {
        path: "/board",
        file: "board.tsx",
        name: "Board & Management",
        description: "Board expectations, financials, club decisions",
        status: "existing",
        preserved: true,
      },
      {
        path: "/fans",
        file: "fans.tsx",
        name: "Fans & Atmosphere",
        description: "Crowd reactions, fan confidence, atmosphere",
        status: "existing",
        preserved: true,
      },
    ],
  },

  // MANAGER SECTION
  // Career profile, reputation, history
  "manager": {
    id: "manager",
    label: "Manager",
    icon: "👔",
    primaryRoute: "/manager-profile",
    description: "Career & profile",
    routes: [
      {
        path: "/manager-profile",
        file: "manager-profile.tsx",
        name: "Manager Profile",
        description: "Career overview, reputation, achievements, CV",
        status: "existing",
        preserved: true,
      },
    ],
  },

  // SPECIAL ROUTES (Not in main nav)
  "special": {
    routes: [
      {
        path: "/new-career",
        file: "new-career.tsx",
        name: "New Career",
        description: "Career creation wizard",
        status: "existing",
        preserved: true,
        note: "Full-screen route; linked from nav but not in main sections",
      },
    ],
  },
};

/**
 * VISUAL HIERARCHY & LAYOUT STRATEGY
 */
export const LAYOUT_STRATEGY = {
  navigation: {
    type: "persistent top navigation bar",
    height: "56px",
    positioning: "sticky, z-index: 40",
    sections: 8,
    responsive: {
      desktop: "All sections visible, horizontal scrolling if needed",
      mobile: "Hamburger menu or vertical scroll navigation [Future]",
    },
  },

  pageStructure: {
    components: [
      "AppNavigation (top bar)",
      "AppLayout (page wrapper)",
      "PageContainer (content area with max-width)",
      "PageHeader (title, subtitle, actions)",
      "ContentGrid (responsive grid system)",
      "Panel (card containers)",
      "Section (content grouping)",
    ],
    contentMaxWidth: "1600px",
    defaultPadding: "16px",
  },

  designTokens: {
    file: "src/components/design-system.ts",
    exports: [
      "Colors",
      "Spacing",
      "Typography",
      "Borders",
      "Shadows",
      "Transitions",
      "Components",
      "Breakpoints",
      "Layout",
    ],
    usage: "Use DesignSystem object or individual exports",
  },
};

/**
 * COMPONENT USAGE EXAMPLES
 */
export const USAGE_EXAMPLES = {
  // Basic page structure
  basicPage: `
    import { AppLayout, PageContainer, PageHeader, Section, Panel } from "@/components/app-layout";
    import { Colors } from "@/components/design-system";
    
    function MyPage() {
      return (
        <AppLayout>
          <PageContainer>
            <PageHeader 
              title="Page Title"
              subtitle="Optional subtitle"
              actions={<button>Action</button>}
            />
            
            <Section title="Section Title">
              <Panel header="Panel Header">
                Panel content goes here
              </Panel>
            </Section>
          </PageContainer>
        </AppLayout>
      );
    }
  `,

  // Using design tokens
  designTokens: `
    import { Colors, Spacing, Borders } from "@/components/design-system";
    
    <div style={{
      background: Colors.bg.elevation1,
      border: \`1px solid \${Colors.border.default}\`,
      borderRadius: Borders.radius.lg,
      padding: Spacing.lg,
      color: Colors.text.primary,
    }}>
      Styled content
    </div>
  `,

  // Responsive grid
  responsiveGrid: `
    import { ContentGrid } from "@/components/app-layout";
    
    <ContentGrid columns={2} gap={Spacing.lg}>
      <Panel>Column 1</Panel>
      <Panel>Column 2</Panel>
    </ContentGrid>
    
    // For complex responsiveness:
    <ContentGrid columns="repeat(auto-fit, minmax(300px, 1fr))">
      ...
    </ContentGrid>
  `,
};

/**
 * MIGRATION CHECKLIST FOR EXISTING PAGES
 * 
 * To migrate a page to use the new layout:
 * 
 * 1. Import new components:
 *    import { AppLayout, PageContainer, PageHeader, Section, Panel } from "@/components/app-layout"
 *    import { Colors, Spacing } from "@/components/design-system"
 * 
 * 2. Wrap page content:
 *    <AppLayout><PageContainer>...</PageContainer></AppLayout>
 * 
 * 3. Replace existing styling with design tokens
 * 
 * 4. Test navigation active state (automatic via app-navigation.tsx)
 * 
 * 5. Verify responsive behavior
 * 
 * 6. Run tests to ensure no regressions
 */
