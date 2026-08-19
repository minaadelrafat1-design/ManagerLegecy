/**
 * EXAMPLE MIGRATIONS
 * Before & After: Converting pages to use new layout system
 * 
 * These are real-world examples of how existing pages can be updated
 * to use the new design system and layout components.
 */

/**
 * EXAMPLE 1: Simple Dashboard Page
 * BEFORE: index.tsx (Home/Manager HQ)
 */

// ─────────────────────────────────────────────────────────────────
// BEFORE: Using old approach (current state)
// ─────────────────────────────────────────────────────────────────

function HomeScreenBEFORE() {
  // Returns hero section with custom styling
  // Mixed inline styles
  // No consistent design tokens
  // Rigid structure
  return (
    <div style={{ minHeight: "100vh", background: "#040A1E" }}>
      <div style={{ height: 420, background: "linear-gradient(...)" }}>
        {/* Hero content */}
      </div>
      <div style={{ padding: "40px 40px 0", maxWidth: 1600 }}>
        {/* Main content */}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AFTER: Using new design system and components
// ─────────────────────────────────────────────────────────────────

import {
  AppLayout,
  PageContainer,
  PageHeader,
  Section,
  Panel,
  ContentGrid,
} from "@/components/app-layout";
import { Colors, Spacing, Borders } from "@/components/design-system";

function HomeScreenAFTER() {
  return (
    <AppLayout>
      {/* Hero Banner - Can be inside PageContainer or separate */}
      <div
        style={{
          background: `linear-gradient(135deg, ${Colors.bg.elevation1}, ${Colors.bg.elevation2})`,
          padding: `${Spacing["3xl"]} ${Spacing.lg}`,
          borderBottom: `1px solid ${Colors.border.default}`,
        }}
      >
        <PageContainer>
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: 900, color: Colors.text.primary }}>
              Manager HQ
            </h1>
            <p style={{ color: Colors.text.secondary }}>Season 2026 · Overview</p>
          </div>
        </PageContainer>
      </div>

      {/* Main Content */}
      <PageContainer>
        <Section title="Next Fixture" subtitle="Upcoming match">
          <Panel elevated>
            {/* Fixture card content */}
          </Panel>
        </Section>

        <ContentGrid columns={2} gap={Spacing.lg}>
          <Panel header="League Position">
            {/* League info */}
          </Panel>
          <Panel header="Squad Status">
            {/* Squad stats */}
          </Panel>
        </ContentGrid>

        <Section title="Form & Stats">
          <ContentGrid columns="repeat(auto-fit, minmax(200px, 1fr))">
            <Panel>
              <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: Spacing.md }}>
                Recent Form
              </h3>
              {/* Form content */}
            </Panel>
          </ContentGrid>
        </Section>
      </PageContainer>
    </AppLayout>
  );
}

/**
 * EXAMPLE 2: Squad Management Page
 * BEFORE: squad.tsx
 */

// ─────────────────────────────────────────────────────────────────
// BEFORE: Squad list with custom styling
// ─────────────────────────────────────────────────────────────────

function SquadScreenBEFORE() {
  return (
    <div style={{ minHeight: "100vh", background: "#040A1E", padding: "20px" }}>
      <div>
        <ScreenHeader title="Squad" subtitle="Team Management" />
      </div>
      <div style={{ display: "grid", gap: "12px", marginTop: "20px" }}>
        {/* Player items with inline styles */}
        {/* Custom grid layout */}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AFTER: Squad page with new components
// ─────────────────────────────────────────────────────────────────

function SquadScreenAFTER() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Squad Management"
          subtitle="View squad, manage lineup, player details"
          actions={
            <button
              style={{
                padding: `${Spacing.md} ${Spacing.lg}`,
                background: Colors.primary[600],
                color: Colors.text.inverse,
                border: "none",
                borderRadius: Borders.radius.md,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Edit Lineup
            </button>
          }
        />

        {/* Starting XI Section */}
        <Section title="Starting XI" subtitle="Current formation">
          <Panel elevated header="4-3-3 Formation">
            {/* Pitch visualization */}
            {/* Player cards in formation */}
          </Panel>
        </Section>

        {/* Squad Stats */}
        <ContentGrid columns={3} gap={Spacing.lg}>
          <Panel>
            <div style={{ fontSize: "12px", color: Colors.text.muted }}>Overall Rating</div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: Colors.primary[400] }}>
              87
            </div>
          </Panel>
          <Panel>
            <div style={{ fontSize: "12px", color: Colors.text.muted }}>Squad Size</div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: Colors.text.primary }}>
              25
            </div>
          </Panel>
          <Panel>
            <div style={{ fontSize: "12px", color: Colors.text.muted }}>Injuries</div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: Colors.error }}>
              2
            </div>
          </Panel>
        </ContentGrid>

        {/* Full Squad */}
        <Section title="Full Squad" subtitle="All players">
          <Panel>
            {/* Sortable player list */}
          </Panel>
        </Section>
      </PageContainer>
    </AppLayout>
  );
}

/**
 * EXAMPLE 3: Transfers Page
 * BEFORE: transfers.tsx
 */

// ─────────────────────────────────────────────────────────────────
// BEFORE: Transfer listing with custom styling
// ─────────────────────────────────────────────────────────────────

function TransfersScreenBEFORE() {
  return (
    <div style={{ minHeight: "100vh", background: "#040A1E" }}>
      <ScreenHeader title="Transfers" subtitle="Market & Deals" />
      <div style={{ padding: "20px", maxWidth: 1200 }}>
        {/* Custom transfer cards */}
        {/* Nested divs with mixed styles */}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AFTER: Transfer page with design system
// ─────────────────────────────────────────────────────────────────

function TransfersScreenAFTER() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Transfer Market"
          subtitle="Buy and sell players, manage listings"
          actions={
            <button style={{ /* Primary button style */ }}>
              Sell Player
            </button>
          }
        />

        {/* Available Targets */}
        <Section title="Available Players" subtitle="Players in market">
          <ContentGrid columns={2} gap={Spacing.lg}>
            {/* Transfer cards */}
            <Panel elevated>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: Spacing.md }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 700, color: Colors.text.primary }}>
                    Player Name
                  </h3>
                  <p style={{ fontSize: "12px", color: Colors.text.secondary }}>Current Club</p>
                </div>
                <div style={{ fontSize: "18px", fontWeight: 800, color: Colors.primary[400] }}>
                  €5M
                </div>
              </div>
              <button style={{ /* Secondary button */ }}>View Profile</button>
            </Panel>
          </ContentGrid>
        </Section>

        {/* Your Listings */}
        <Section title="Your Listings" subtitle="Players for sale">
          <Panel>
            {/* Seller-side listings */}
          </Panel>
        </Section>

        {/* Active Negotiations */}
        <Section title="Active Negotiations" subtitle="Ongoing deals">
          <Panel header="Negotiations">
            {/* Negotiation threads */}
          </Panel>
        </Section>
      </PageContainer>
    </AppLayout>
  );
}

/**
 * EXAMPLE 4: Training/Development Page
 * BEFORE: training.tsx
 */

// ─────────────────────────────────────────────────────────────────
// BEFORE: Training settings with custom layout
// ─────────────────────────────────────────────────────────────────

function TrainingScreenBEFORE() {
  return (
    <div style={{ minHeight: "100vh", background: "#040A1E", padding: "20px" }}>
      <ScreenHeader title="Training Ground" />
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Training sliders */}
        {/* Custom grid for focus areas */}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AFTER: Training page with new components
// ─────────────────────────────────────────────────────────────────

function TrainingScreenAFTER() {
  return (
    <AppLayout>
      <PageContainer>
        <PageHeader
          title="Training Ground"
          subtitle="Set team training focus and player development"
        />

        {/* Training Focus Areas */}
        <Section title="Team Training Focus">
          <ContentGrid columns={2} gap={Spacing.lg}>
            <Panel header="Attacking Focus">
              <div style={{ marginBottom: Spacing.lg }}>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: Spacing.sm }}>
                  Intensity: 75%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="75"
                  style={{ width: "100%" }}
                />
              </div>
              <button style={{ /* Secondary button */ }}>Apply</button>
            </Panel>

            <Panel header="Defensive Focus">
              <div style={{ marginBottom: Spacing.lg }}>
                <label style={{ fontSize: "12px", fontWeight: 700, display: "block", marginBottom: Spacing.sm }}>
                  Intensity: 50%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="50"
                  style={{ width: "100%" }}
                />
              </div>
              <button style={{ /* Secondary button */ }}>Apply</button>
            </Panel>
          </ContentGrid>
        </Section>

        {/* Individual Development */}
        <Section title="Individual Development" subtitle="Player-specific focus">
          <Panel>
            {/* Player development list */}
          </Panel>
        </Section>
      </PageContainer>
    </AppLayout>
  );
}

/**
 * PATTERN REFERENCE
 * 
 * When converting pages, follow this pattern:
 * 
 * 1. Wrap in AppLayout
 * 2. Use PageContainer for max-width + padding
 * 3. Start with PageHeader for title
 * 4. Group related content in Section
 * 5. Use Panel for card containers
 * 6. Use ContentGrid for multi-column layouts
 * 7. Replace all inline colors with Colors.*
 * 8. Replace all inline spacing with Spacing.*
 * 9. Test responsive behavior
 * 10. Verify navigation shows active section
 */

/**
 * COMMON MISTAKES TO AVOID
 * 
 * ✗ Don't use hardcoded colors (#abc123)
 * ✓ Use Colors.* from design system
 * 
 * ✗ Don't use hardcoded padding/margin
 * ✓ Use Spacing.* scale
 * 
 * ✗ Don't nest PageContainer multiple times
 * ✓ Use single PageContainer as content wrapper
 * 
 * ✗ Don't recreate panels as custom divs
 * ✓ Use Panel component for cards
 * 
 * ✗ Don't use inline grids without ContentGrid
 * ✓ Use ContentGrid for responsive layouts
 * 
 * ✗ Don't forget PageHeader for page identity
 * ✓ Always include title/subtitle
 */

/**
 * TESTING CHECKLIST FOR EACH PAGE
 * 
 * After migration:
 * □ Page renders without errors
 * □ Navigation shows correct section active
 * □ Responsive layout works (resize browser)
 * □ All links still work
 * □ Game logic unchanged
 * □ State management still functional
 * □ No console errors
 * □ Colors match design system
 * □ Spacing looks consistent
 * □ Forms/inputs functional
 */
