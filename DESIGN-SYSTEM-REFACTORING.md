# Manager Legacy - Design System Unification Refactoring

## Executive Summary

This document outlines the comprehensive UI/UX unification for Manager Legacy, transforming from fragmented page-specific styling to a cohesive, professional football management game interface.

**Status**: In Progress
**Scope**: 26 routes across 8 major game modes
**Design Goal**: Premium dark theme with consistent typography, spacing, colors, and components

---

## Design Foundation Complete ✅

### 1. **Design Tokens** (`src/components/design-system.ts`)
- **Colors**: Full palette with semantics (neutral, primary, secondary, success, warning, error, info)
- **Typography**: Scale from xs (11px) to 4xl (40px) with proper weights and line heights
- **Spacing**: xs (4px) → 5xl (48px) scale
- **Borders**: Radius sm-xl + full, width default/thick
- **Shadows**: xs → 2xl + glow variants
- **Transitions**: fast/base/slow/verySlow
- **Components**: Panel, button, input, badge presets
- **Breakpoints**: xs/sm/md/lg/xl/2xl
- **Layout**: Navigation heights, sidebar widths, max-width

### 2. **Modern Component Library** (`src/components/ui-modern.tsx`)

Exported components (fully implemented):
- **TMod**: Unified color and style tokens
- **ModPanel**: Variant-based panel card (primary/secondary/elevated/glass)
- **ModSectionHead**: Section title with icon, subtitle, action, divider
- **ModStatRow**: Row with label, value, bar, trend indicator
- **ModPlayerCard**: Player info card with number, position, stats
- **ModTabs**: Tab navigation with active indicator
- **ModBadge**: Colored badge with semantic variants
- **ModButton**: Button with size/variant/state control
- **ModFixtureCard**: Match card with score and date
- **ScreenHeader**: Large page title with breadcrumb, stats, action
- **MetricCard**: Stat card with label, value, color variant, icon
- **ContentGrid**: Responsive grid layout for cards
- **ScreenLayout**: Full-page layout wrapper with hero section
- **StatBarRow**: Skill bar with percentage display
- **FilterChip**: Selectable filter tag

---

## Current Page Status & Refactoring Plan

### Central Hub (Primary Navigation)
- **index.tsx** - Home/Dashboard
  - Status: ⚠️ HIGH PRIORITY
  - Issues: Mixed inline styles, custom gradients, duplicate card patterns
  - Action: Replace header with ScreenHeader, cards with MetricCard
  
- **board.tsx** - Club Board & Finances
  - Status: ⚠️ HIGH PRIORITY  
  - Issues: Custom color scheme for finance data, inline tables
  - Action: Use consistent panel styling, create table component

- **manager-profile.tsx** - Manager/Save Profile
  - Status: ⚠️ MEDIUM
  - Issues: Profile forms with custom input styling
  - Action: Standardize inputs with design tokens

### Squad Management
- **squad.tsx** - Squad Overview & Formation
  - Status: ⚠️ HIGH PRIORITY
  - Issues: Mixed TMod tokens with heavy inline styles, complex grid layouts
  - Action: Use ModPanel, StatBarRow for stats, ModTabs for sections, ScreenHeader
  - Current: Partially using TMod but needs component extraction
  - Inline styles to replace: TOP NAV bar, stat boxes, calendar section, pitch area

- **academy.tsx** - Youth Development
  - Status: ⚠️ MEDIUM
  - Issues: Similar to squad.tsx, custom player cards
  - Action: Replace with ModPlayerCard, consistent layout

- **player.$playerId.tsx** - Player Profile/Detail
  - Status: ⚠️ MEDIUM
  - Issues: Custom modal styling, inline stat displays
  - Action: Use ModPlayerCard, ModStatRow for all stats

### Tactics & Strategy
- **tactics.tsx** - Formation, Instructions, Mentality
  - Status: ⚠️ HIGH PRIORITY
  - Issues: Custom sliders, inconsistent layout, unique colors for instructions
  - Action: Create unified slider component, use ModPanel for sections, consistent state colors
  - Focus: Slider styling is critical for this page

### Player Development
- **training.tsx** - Training Drills, Weekly Plan
  - Status: ⚠️ HIGH PRIORITY  
  - Issues: Custom card layout for drills, duplicate header styling
  - Action: Use ScreenHeader with stats, ModPanel for cards, remove duplicate gradients

- **training-presets.tsx** - Training Plan Templates
  - Status: ⚠️ MEDIUM
  - Issues: Similar to training.tsx, custom button groups
  - Action: Use FilterChip for plan selection, ModButton for actions

### Transfers & Negotiations
- **transfers.tsx** - Transfer Market Discovery
  - Status: 🔄 IN PROGRESS
  - Issues: MASSIVE inline styles (200+ lines), repeated stat card pattern
  - Action: ✅ Started refactoring - use ScreenHeader, MetricCard grid, ContentGrid for players
  - Previous: Custom colors #061727, #7bffb8, #f0c24b scattered throughout
  - Now: Unified to TMod.accentGreen, TMod.accentGold, TMod.bgPrimary

- **negotiations.tsx** - Salary & Contract Negotiations
  - Status: ⚠️ HIGH PRIORITY
  - Issues: Custom negotiation UI, inline step indicators
  - Action: Create negotiation timeline component, use consistent button states

- **-negotiations.tsx** - Alternative/Legacy Route
  - Status: ⚠️ LOW (may be deprecated)
  - Action: Verify if still used, remove if redundant

### Club Management
- **office.tsx** - Facilities, Staff, Budget
  - Status: ⚠️ MEDIUM
  - Issues: Custom sidebar navigation, facility cards with unique styling
  - Action: Standardize all cards with ModPanel, use consistent sections

- **staff.tsx** - Coaching Staff & Roles
  - Status: ⚠️ MEDIUM
  - Issues: Staff list with custom styling, role badges
  - Action: Create staff card component using ModPlayerCard pattern

- **fans.tsx** - Fan Happiness, Stadium Atmosphere
  - Status: ⚠️ LOW-MEDIUM
  - Issues: Custom meter/gauge visualizations
  - Action: Use StatBarRow for happiness metrics

### Match & Competition
- **match.tsx** - Live Match/Match Report
  - Status: ⚠️ HIGH PRIORITY
  - Issues: Complex layout with inline pitch styles, custom stats
  - Action: Use ModFixtureCard, ModStatRow, consistent panel hierarchy

- **fixtures.tsx** - Fixture Schedule (Original)
  - Status: ⚠️ MEDIUM
  - Issues: Calendar with custom styling, date cells
  - Action: Use consistent date/fixture styling, replace with fixtures-modern if exists

- **fixtures-modern.tsx** - Fixture Schedule (Modern)
  - Status: ✅ POTENTIALLY COMPLETE
  - Issues: If already modern, audit alignment with new tokens
  - Action: Verify consistency with new design system

### Information & Utilities
- **calendar.tsx** - Game Calendar & Timeline
  - Status: ⚠️ MEDIUM
  - Issues: Custom calendar styling, date highlighting
  - Action: Standardize with design tokens

- **league-pyramid.tsx** - League Structure Visualization
  - Status: ⚠️ LOW
  - Issues: Visualization-heavy, custom styling for league tables
  - Action: Keep unique styling where necessary, use consistent panels

- **inbox.tsx** - Messages & Notifications
  - Status: ⚠️ MEDIUM
  - Issues: Message card styling, notification types
  - Action: Create notification component, use consistent panels

- **scouting.tsx** - Scout Network & Reports
  - Status: ⚠️ HIGH PRIORITY
  - Issues: Custom scout card layout, report styling
  - Action: Use ModPlayerCard for player scouting results, consistent panels

- **treatment.tsx** - Medical/Injury Management
  - Status: ⚠️ MEDIUM
  - Issues: Injury status indicators, treatment timeline
  - Action: Use consistent badge/status indicators, timeline styling

---

## Refactoring Patterns

### Pattern 1: Screen Header with Stats
```tsx
// OLD
<div style={{ fontSize: 48, fontWeight: 900, ... }}>Title</div>
<div style={{ ... stats cards inline ... }}></div>

// NEW
<ScreenHeader
  title="Title"
  breadcrumb="SECTION"
  stats={[
    { label: "Budget", value: "€10M" },
    { label: "Count", value: 25 }
  ]}
/>
```

### Pattern 2: Stat Cards Grid
```tsx
// OLD
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, ...)" }}>
  <div style={{ background: "rgba(17,30,45,0.8)", ... }}>
    <div style={{ ... label styles ... }}>Label</div>
    <div style={{ ... value styles ... }}>Value</div>
  </div>
</div>

// NEW
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
  <MetricCard label="Label" value="Value" variant="success" />
  <MetricCard label="Label2" value="Value2" variant="warning" />
</div>
```

### Pattern 3: Player Stats Rows
```tsx
// OLD
<div style={{ display: "flex", justifyContent: "space-between", ... }}>
  <span>Stat</span>
  <span>Value</span>
  <div style={{ width: 60, height: 4, ... bar ... }}</div>
</div>

// NEW
<StatBarRow label="Stat" value={85} color={TMod.accentGreen} />
```

### Pattern 4: Section Headers
```tsx
// OLD
<div style={{ fontSize: 13, fontWeight: 700, color: "#d8f9ea", ... }}>
  SECTION TITLE
</div>

// NEW
<ModSectionHead title="Section Title" divider />
```

### Pattern 5: Panels & Cards
```tsx
// OLD
<div style={{
  background: "rgba(17,30,45,0.8)",
  border: "1px solid rgba(126,169,255,0.2)",
  borderRadius: 12,
  padding: "20px"
}}>

// NEW
<ModPanel variant="secondary" padding="20px">
```

### Pattern 6: Tabs
```tsx
// OLD
<div style={{ display: "flex", gap: 24, borderBottom: "1px solid ..." }}>
  {tabs.map(tab => (
    <button style={{ ... }}>{tab}</button>
  ))}
</div>

// NEW
<ModTabs
  tabs={[{ id: "tab1", label: "TAB 1" }, ...]}
  activeTab={active}
  onChange={setActive}
/>
```

---

## Color Migration Guide

### Replace These Custom Colors:

| Old Value | Category | New Token | New Value |
|-----------|----------|-----------|-----------|
| #061727 | Background | TMod.bgPrimary | #0A0E27 |
| #111C3F | Panel | TMod.bgSecondary | #111C3F |
| #1A2750 | Layer | TMod.bgTertiary | #1A2750 |
| #7bffb8 | Accent Green | TMod.accentGreen | #2FE08A |
| #4FDBFF | Accent Cyan | TMod.accentCyan | #4FDBFF |
| #3AA0FF | Accent Blue | TMod.accentBlue | #3AA0FF |
| #f0c24b | Accent Gold | TMod.accentGold | #F0C24B |
| #dce9ff | Text Primary | TMod.textPrimary | #FFFFFF |
| #a8bbd6 | Text Secondary | TMod.textSecondary | #B8C5D6 |
| #9db0c7 | Text Tertiary | TMod.textTertiary | #7A8BA3 |
| rgba(126, 169, 255, 0.2) | Border | TMod.borderLight | rgba(255,255,255,0.08) |

### Semantic Color Usage:

- **Success**: TMod.accentGreen (#2FE08A) - player improvements, positive actions
- **Warning**: TMod.accentGold (#F0C24B) - pending items, caution states
- **Error**: TMod.accentRed (#FF5A62) - injuries, contract rejections
- **Info**: TMod.accentBlue (#3AA0FF) - information, squad status
- **Default**: TMod.accentCyan (#4FDBFF) - neutral states, UI accents

---

## Typography Consolidation

### Heading Hierarchy:

| Level | Font Size | Weight | Usage |
|-------|-----------|--------|-------|
| Display | 40-48px | 900 | Page titles |
| H1 | 32px | 900 | Section headers |
| H2 | 24px | 800 | Subsections |
| H3 | 18px | 800 | Card titles |
| Body | 14px | 400 | Content text |
| Small | 12px | 600 | Labels, captions |
| Tiny | 11px | 700 | Badges, micro text |

### Font Families:
- **Display/UI**: 'Chakra Petch' (bold, gaming style) for emphasis
- **Body**: 'Inter' for readability
- **Monospace**: For stats/scores when needed

---

## Spacing Standardization

### Padding/Margin Scale:
- **xs**: 4px - micro spacing
- **sm**: 8px - icon gaps
- **md**: 12px - content padding
- **lg**: 16px - section padding
- **xl**: 20px - card padding
- **2xl**: 24px - grid gaps
- **3xl**: 32px - page padding
- **4xl**: 40px - major sections
- **5xl**: 48px - hero sections

### Gap Values:
- Grid columns: 16px (page), 12px (cards)
- Flex items: 8px (tight), 12px (normal), 16px (loose)
- Section dividers: 24px
- Page sections: 32px

---

## Component State Consistency

All buttons, inputs, and interactive elements should support:

### States:
- **Default**: Base styling
- **Hover**: TMod.shadowLg + glow effect
- **Active/Selected**: Highlight with accent color + border
- **Disabled**: Reduced opacity (0.5) + cursor not-allowed
- **Loading**: Spinner overlay + disabled state

### Badges (for player status):
- **Fit** (Green): Player available, ready
- **Fatigued** (Gold): Warning state
- **Injured** (Red): Unavailable
- **Out of Contract** (Orange): Action needed
- **On Loan** (Cyan): Information

### Status Indicators:
- Victory: TMod.accentGreen
- Draw: TMod.textSecondary
- Loss: TMod.accentRed
- Pending: TMod.accentGold
- Scheduled: TMod.accentBlue

---

## Screen Context & Information Hierarchy

Every screen should communicate clearly:

1. **WHERE AM I?** 
   - Breadcrumb in ScreenHeader
   - Tab highlighting for current section
   - Title clearly stating current mode

2. **WHAT MATTERS?** 
   - Key metrics in MetricCard above fold
   - Color coding for status (green=good, red=bad)
   - Highlight current player/selection

3. **WHAT CAN I DO?** 
   - Action buttons in top section
   - Interactive elements clearly styled
   - State of action availability (enabled/disabled)

4. **WHAT CHANGED?** 
   - Recent activity sidebar (where applicable)
   - Notification badges on relevant items
   - Visual feedback on interactions

---

## Refactoring Checklist

### Phase 1: High Priority (Complete ASAP)
- [ ] transfers.tsx - START (in progress)
- [ ] squad.tsx 
- [ ] training.tsx
- [ ] tactics.tsx
- [ ] index.tsx (home)

### Phase 2: Medium Priority
- [ ] negotiations.tsx
- [ ] match.tsx
- [ ] scouting.tsx
- [ ] office.tsx
- [ ] board.tsx

### Phase 3: Lower Priority
- [ ] staff.tsx
- [ ] academy.tsx
- [ ] player.$playerId.tsx
- [ ] calendar.tsx
- [ ] fixtures.tsx / fixtures-modern.tsx
- [ ] league-pyramid.tsx
- [ ] fans.tsx
- [ ] treatment.tsx
- [ ] manager-profile.tsx
- [ ] inbox.tsx
- [ ] training-presets.tsx
- [ ] -negotiations.tsx

---

## Verification Checklist for Each Page

After refactoring, verify:

- [ ] Uses ScreenHeader for page title (or ScreenLayout)
- [ ] Metrics/stats displayed in MetricCard grid where applicable
- [ ] Panels use ModPanel instead of inline div styling
- [ ] All buttons use ModButton or inherit consistent styles
- [ ] Tabs use ModTabs component
- [ ] Player stats use StatBarRow
- [ ] No hardcoded hex colors (use TMod tokens)
- [ ] No duplicate border/shadow styles (use design tokens)
- [ ] Spacing uses consistent scale (xs/sm/md/lg/xl/etc)
- [ ] Hover states present and consistent
- [ ] Loading/empty states styled consistently
- [ ] Mobile responsive layout maintained
- [ ] Dark theme properly applied
- [ ] Breadcrumb or section indicator visible
- [ ] Action items clearly visible and accessible

---

## Additional Components to Create (If Needed)

Based on audit, may need to create:

- [ ] **Table**: Unified player/league table with sorting
- [ ] **Timeline**: For match events, negotiations, activities
- [ ] **Slider**: For tactics sliders (already started in tactics.tsx)
- [ ] **Notification**: Toast/alert notification system
- [ ] **Modal**: Unified modal styling (build on existing Dialog)
- [ ] **ProgressRing**: For circular progress/stats
- [ ] **Select**: Unified select/dropdown component
- [ ] **Form**: Unified form wrapper with consistent styling
- [ ] **EmptyState**: Standardized empty state component
- [ ] **LoadingState**: Standardized loading skeleton
- [ ] **ErrorState**: Standardized error message component

---

## Testing & QA

After all refactoring complete:

1. **Visual Consistency Audit**
   - Compare side-by-side: header styling across pages
   - Verify metric cards all use same colors/spacing
   - Check panel shadows and borders
   - Validate typography hierarchy

2. **Component Testing**
   - Test all button variants (primary/secondary/danger)
   - Test all tab transitions
   - Test MetricCard with different value lengths
   - Test player cards with real data
   - Test responsive layout on tablets/mobile

3. **Interaction Testing**
   - Hover states work on all interactive elements
   - Active/selected states persist correctly
   - Disabled state properly prevents interaction
   - Loading states show during async operations

4. **Accessibility**
   - Contrast ratios meet WCAG AA standard
   - Focus indicators visible on keyboard navigation
   - Screen reader text included where needed
   - Touch targets at least 44px on mobile

---

## Migration Complete Criteria

✅ Design system complete and documented
✅ Component library created with 15+ core components
🔄 Pages systematically refactored (in progress)
❌ Audit of all 26 routes for consistency
❌ Testing and QA validation
❌ Design documentation published
❌ Component showcase/storybook created

---

## Key Success Metrics

- **Consistency**: 100% of pages use design tokens for colors/spacing
- **Reusability**: 5+ instances of each component pattern found and unified
- **Performance**: No increase in CSS file size despite more components
- **Maintainability**: Design changes now affect entire app instantly
- **User Experience**: Premium, polished, professional appearance
- **Development**: New pages can be built 50% faster using component library

---

## Notes

- All refactoring maintains existing functionality - NO feature changes
- Dark premium football atmosphere preserved
- Each mode (Squad/Tactics/Transfers) keeps visual emphasis through variants
- Original information architecture preserved
- No emoji icons removed from functionality, only from navigation
