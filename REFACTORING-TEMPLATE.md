# Manager Legacy - Page Refactoring Template & Strategy

## Quick Start: How to Refactor Any Page

### Step 1: Copy This Template

```tsx
// ✅ UPDATED IMPORTS
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { 
  TMod, 
  ScreenHeader,
  MetricCard,
  ModPanel,
  ModSectionHead,
  ModTabs,
  ModButton,
  StatBarRow,
  FilterChip,
  EmptyState
} from "@/components/ui-modern";
import { useGameState } from "@/state/store";

export const Route = createFileRoute("/your-route")({
  head: () => ({
    meta: [
      { title: "Page Title — Manager Legacy" },
      { name: "description", content: "Description here." },
    ],
  }),
  component: YourPageScreen,
});

function YourPageScreen() {
  const { state } = useGameState();

  return (
    <>
      {/* ✅ HERO SECTION */}
      <ScreenHeader
        breadcrumb="SECTION NAME"
        title="Page Title"
        subtitle="Optional subtitle"
        stats={[
          { label: "Stat 1", value: "Value" },
          { label: "Stat 2", value: "Value" },
        ]}
      />

      {/* ✅ MAIN CONTENT */}
      <div
        style={{
          background: TMod.bgPrimary,
          color: TMod.textPrimary,
          minHeight: "calc(100vh - 200px)",
          padding: "32px",
        }}
      >
        <div style={{ maxWidth: "1600px", margin: "0 auto" }}>
          {/* REPLACE EVERYTHING BELOW WITH NEW COMPONENTS */}
        </div>
      </div>
    </>
  );
}
```

### Step 2: Identify Patterns to Replace

#### Pattern A: Header + Stats Grid
```tsx
// OLD - Remove this
<div style={{ ... header styles ... }}>
  <div style={{ fontSize: 48, ... }}>Title</div>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(...)" }}>
    <div style={{ ... card styles ... }}>
      <div style={{ ... label ... }}>Label</div>
      <div style={{ ... value ... }}>Value</div>
    </div>
  </div>
</div>

// NEW - Replace with this
<ScreenHeader
  breadcrumb="SECTION"
  title="Title"
  stats={[
    { label: "Label", value: "Value" },
    { label: "Label", value: "Value" },
  ]}
/>
```

#### Pattern B: Stat Cards Grid
```tsx
// OLD - Replace this
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
  <div style={{ background: "rgba(17,30,45,0.8)", border: "1px solid rgba(126,169,255,0.2)", borderRadius: 12, padding: "20px" }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: "#9db0c7", textTransform: "uppercase" }}>Label</div>
    <div style={{ fontSize: 32, fontWeight: 900, color: "#7bffb8" }}>Value</div>
  </div>
</div>

// NEW - With this
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
  <MetricCard label="Label" value="Value" variant="success" />
  <MetricCard label="Label" value="Value" variant="warning" />
  <MetricCard label="Label" value="Value" variant="default" />
</div>
```

#### Pattern C: Panels
```tsx
// OLD - This pattern
<div style={{ background: "rgba(17,30,45,0.8)", border: "1px solid rgba(126,169,255,0.2)", borderRadius: 12, padding: "20px" }}>

// NEW - This component
<ModPanel variant="secondary" padding="20px">
```

#### Pattern D: Section Titles
```tsx
// OLD - This
<div style={{ fontSize: 13, fontWeight: 700, color: "#d8f9ea", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16 }}>
  SECTION TITLE
</div>

// NEW - This component
<ModSectionHead title="Section Title" divider />
```

#### Pattern E: Player Stats Rows
```tsx
// OLD - This repeated pattern
<div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid ..." }}>
  <span>Stat Label</span>
  <div style={{ display: "flex", gap: 12 }}>
    <div style={{ width: 60, height: 4, ... }}>
      <div style={{ width: `${percentage}%`, ... }} />
    </div>
    <span>Value</span>
  </div>
</div>

// NEW - This component
<StatBarRow label="Stat Label" value={85} color={TMod.accentGreen} />
```

#### Pattern F: Tabs
```tsx
// OLD - This pattern
<div style={{ display: "flex", gap: 24, borderBottom: "1px solid ..." }}>
  {tabs.map(tab => (
    <button style={{ ... complex styling ... }}>
      {tab}
    </button>
  ))}
</div>

// NEW - This component
<ModTabs
  tabs={[
    { id: "tab1", label: "TAB 1" },
    { id: "tab2", label: "TAB 2" }
  ]}
  activeTab={activeTab}
  onChange={setActiveTab}
/>
```

#### Pattern G: Filter Buttons/Chips
```tsx
// OLD - This pattern
<button style={{ padding: "8px 14px", borderRadius: 6, border: "1px solid ...", background: "...", color: "..." }}>
  Filter Name
</button>

// NEW - This component
<FilterChip label="Filter Name" selected={isSelected} onClick={() => toggleFilter()} />
```

#### Pattern H: Empty States
```tsx
// OLD - This pattern
<div style={{ gridColumn: "1 / -1", padding: "40px 20px", textAlign: "center", color: "#a8bbd6" }}>
  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No items found</div>
  <div style={{ fontSize: 13 }}>Try adjusting your filters</div>
</div>

// NEW - This component
<EmptyState
  icon="🔍"
  title="No items found"
  description="Try adjusting your filters"
/>
```

#### Pattern I: Inline Color Values
```tsx
// OLD - All of these scattered throughout
#061727, #111C3F, #1A2750, #7bffb8, #4FDBFF, #3AA0FF, #f0c24b, #dce9ff, #a8bbd6

// NEW - Use TMod tokens instead
TMod.bgPrimary, TMod.bgSecondary, TMod.bgTertiary
TMod.accentGreen, TMod.accentCyan, TMod.accentBlue, TMod.accentGold
TMod.textPrimary, TMod.textSecondary, TMod.textTertiary
```

---

## Page-by-Page Refactoring Checklist

### Squad.tsx Refactoring (HIGH PRIORITY)

```tsx
// TOP CHANGES NEEDED:
1. Replace header with ScreenHeader component
2. Replace stat boxes with MetricCard (Overall, Fitness, etc.)
3. Replace custom tabs with ModTabs
4. Replace calendar day buttons with FilterChip or ModButton
5. Replace stat bars with StatBarRow throughout
6. Replace all inline border/shadow styles with TMod or ModPanel
7. Replace color #7bffb8 with TMod.accentGreen
8. Replace color #4FDBFF with TMod.accentCyan

// SPECIFIC REPLACEMENTS:
Line 89: TOP NAV bar - extract to component or simplify with TMod tokens
Line 140: TABS section - replace with ModTabs
Line 200: Stat boxes - replace with MetricCard or StatBox
Line 250: Calendar section - replace buttons with FilterChip
Line 320: All stat bars - use StatBarRow component
Line 450: Pitch area - keep but standardize container styling
```

### Training.tsx Refactoring (HIGH PRIORITY)

```tsx
// TOP CHANGES NEEDED:
1. Replace header gradient with ScreenHeader
2. Replace stat cards with MetricCard grid
3. Replace training plan selector buttons with FilterChip
4. Replace weekly schedule with ModPanel + StatBarRow for intensity
5. Replace all panel divs with ModPanel components
6. Remove duplicate header gradient styling
7. Replace color #7bffb8 with TMod.accentGreen
8. Replace color #f0c24b with TMod.accentGold

// LINE REFERENCES:
Line 53: Header section - replace with ScreenHeader
Line 90: Stat cards - replace with MetricCard grid
Line 130: Plan selector - use FilterChip for selection
Line 180: Weekly schedule - use ModPanel + consistent layout
Line 250: Player development list - use ModPlayerCard or consistent cards
```

### Tactics.tsx Refactoring (HIGH PRIORITY)

```tsx
// TOP CHANGES NEEDED:
1. Replace header with ScreenHeader
2. Replace SliderControl (now in ui-modern.tsx) usage
3. Replace custom tabs with ModTabs
4. Replace all inline panel styling with ModPanel
5. Replace instruction toggles with ModToggle component
6. Replace formation button groups with FilterChip/ModButton
7. Replace all hardcoded colors with TMod tokens
8. Replace player list with consistent card styling

// SPECIFIC ACTIONS:
Line 45-100: SliderControl already defined locally - import from ui-modern instead
Line 150: Header - replace with ScreenHeader
Line 180: Tabs - replace with ModTabs
Line 220: All panels - use ModPanel(variant="secondary", padding="24px")
Line 280: Toggle switches - use ModToggle component
Line 350: Color replacements - #061727→TMod.bgPrimary, #7bffb8→TMod.accentGreen
```

### Index.tsx (Home/Dashboard) Refactoring

```tsx
// TOP CHANGES NEEDED:
1. Replace header with ScreenHeader
2. Replace all stat cards with MetricCard
3. Replace sections with ModSectionHead + ModPanel
4. Replace buttons with ModButton
5. Replace all inline styling with component or token-based
6. Replace color #7bffb8 with TMod.accentGreen
7. Add consistent empty states
```

### Negotiations.tsx Refactoring

```tsx
// TOP CHANGES NEEDED:
1. Replace header with ScreenHeader
2. Replace negotiation step cards with ModPanel
3. Replace buttons with ModButton
4. Replace negotiation status badges with semantic colors
5. Create negotiation timeline (could use ModPanel + dividers)
6. Replace all custom styling with components/tokens
```

---

## Refactoring Checklist for Each File

Use this for every file you refactor:

```markdown
## Page: [Name].tsx

### Pre-Refactoring Analysis
- [ ] Identified all hardcoded colors → list them
- [ ] Counted inline styled divs → how many?
- [ ] Found duplicate patterns → which ones?
- [ ] Mapped to components → can they be replaced?
- [ ] Identified unique elements → must stay custom?

### Import Updates
- [ ] Import ScreenHeader if page has title + stats
- [ ] Import MetricCard if page has stat cards
- [ ] Import ModPanel for all card-like containers
- [ ] Import ModTabs if page has tabs
- [ ] Import ModButton for all buttons
- [ ] Import FilterChip if page has filter/selection chips
- [ ] Import StatBarRow if page displays stat bars
- [ ] Import other needed components

### Header/Hero Section
- [ ] Remove old header div styling
- [ ] Add ScreenHeader component
- [ ] Pass breadcrumb, title, stats to ScreenHeader
- [ ] Verify styling matches

### Main Content Container
- [ ] Verify outer div uses TMod.bgPrimary
- [ ] Verify padding is 32px
- [ ] Verify max-width is set to 1600px

### Card/Panel Sections
- [ ] Find all `<div style={{ background: "rgba..." }}>` 
- [ ] Replace with `<ModPanel variant="secondary">`
- [ ] Update padding if needed
- [ ] Remove inline border/shadow styles

### Color Replacements
- [ ] #061727 → TMod.bgPrimary
- [ ] #111C3F → TMod.bgSecondary
- [ ] #1A2750 → TMod.bgTertiary
- [ ] #7bffb8 → TMod.accentGreen
- [ ] #4FDBFF → TMod.accentCyan
- [ ] #3AA0FF → TMod.accentBlue
- [ ] #f0c24b → TMod.accentGold
- [ ] #dce9ff → TMod.textPrimary
- [ ] #a8bbd6 → TMod.textSecondary
- [ ] #9db0c7 → TMod.textTertiary

### Typography
- [ ] Page title: fontSize 40-48, weight 900
- [ ] Section heads: fontSize 18, weight 800
- [ ] Card titles: fontSize 13-14, weight 700
- [ ] Body text: fontSize 14, weight 400
- [ ] Labels: fontSize 11-12, weight 700

### Spacing
- [ ] Page padding: 32px
- [ ] Card padding: 16-20px
- [ ] Grid gaps: 16px
- [ ] Section gaps: 24-32px
- [ ] Flex gaps: 8px (tight), 12px (normal), 16px (loose)

### States & Interactions
- [ ] Hover states present
- [ ] Active/selected states styled
- [ ] Disabled states reduced opacity
- [ ] Loading states shown (if applicable)
- [ ] Empty states with EmptyState component

### Final Verification
- [ ] All inline styles use TMod tokens
- [ ] No hardcoded hex colors remain
- [ ] No duplicate border/shadow patterns
- [ ] Responsive layout preserved
- [ ] Mobile layout tested
- [ ] TypeScript compiles without errors
- [ ] Visual matches design system

### Testing Checklist
- [ ] Open page in browser
- [ ] Verify header renders correctly
- [ ] Verify all content displays
- [ ] Test hover states work
- [ ] Test interactions function
- [ ] Check mobile responsive layout
- [ ] Verify no console errors
```

---

## High-Impact Refactoring Order

**For Maximum Impact with Minimum Time:**

### Tier 1 (Must Do - 80% of visual impact)
1. **index.tsx** - Home screen used by everyone
2. **squad.tsx** - Most visited page
3. **transfers.tsx** - Already started ✅
4. **training.tsx** - High traffic
5. **tactics.tsx** - Frequently visited

### Tier 2 (Should Do - 15% of remaining impact)
6. **negotiations.tsx** - Important workflow
7. **match.tsx** - Key screen
8. **board.tsx** - Finance view
9. **scouting.tsx** - Discovery screen
10. **office.tsx** - Management screen

### Tier 3 (Nice to Have - 5% of remaining impact)
11. All other pages (staff, academy, calendar, fixtures, treatment, fans, inbox, league-pyramid, player profile, manager-profile)

---

## Shortcuts & Efficiency Tips

### Use Find & Replace for Color Swaps
```
Find: #061727
Replace: ${TMod.bgPrimary}

Find: #7bffb8
Replace: ${TMod.accentGreen}

Find: #4FDBFF
Replace: ${TMod.accentCyan}
```

### Extract Repeated Patterns
If you see this pattern 5+ times:
```tsx
<div style={{
  background: "rgba(17, 30, 45, 0.8)",
  border: "1px solid rgba(126, 169, 255, 0.2)",
  borderRadius: 12,
  padding: "20px",
}}>
```
Replace ALL with `<ModPanel variant="secondary" padding="20px">`

### Use Component Variants
Instead of:
```tsx
<div style={{ background: someColor, ... }}>
```
Use:
```tsx
<MetricCard label="..." value="..." color={someColor} />
```

### Copy Refactored Examples
- **transfers.tsx** - Header + MetricCard pattern
- Once squad.tsx is done - Use as template for similar pages
- Once negotiations.tsx is done - Use as template for flow pages

---

## Common Mistakes to Avoid

❌ **Don't** hardcode colors - always use TMod.accentGreen, etc.
❌ **Don't** create inline styles for spacing - use consistent scale
❌ **Don't** forget to import new components at top of file
❌ **Don't** mix old and new styling in same file
❌ **Don't** create custom styling when component exists
❌ **Don't** skip the header component - it provides context

✅ **DO** use ScreenHeader for every page
✅ **DO** use MetricCard for all stat displays
✅ **DO** use ModPanel for containers
✅ **DO** use TMod tokens for ALL colors
✅ **DO** follow the typography hierarchy
✅ **DO** maintain consistent spacing

---

## Performance Impact

- **File Size**: Each page saves ~40-50 lines by using components
- **CSS Payload**: Moved from inline to reusable classes
- **Parse Time**: Simpler JSX, fewer inline objects
- **Render Time**: Component memoization possible

**Expected Result**: ~5-10% improvement per page

---

## Quality Assurance Steps

After refactoring each page:

1. **Visual Check**: Does it look like before? (Should be pixel-perfect)
2. **Interaction Test**: Do buttons, tabs, interactions work?
3. **Responsive Test**: Mobile/tablet layout OK?
4. **Console Check**: Any errors or warnings?
5. **Performance**: Check DevTools performance tab
6. **Accessibility**: Tab navigation works? Screen reader OK?

---

## Success Indicators

- ✅ All pages compile without TypeScript errors
- ✅ All pages render without console errors
- ✅ Visual appearance identical to before
- ✅ All interactions functional
- ✅ Responsive layout works on all breakpoints
- ✅ 0 hardcoded hex colors in refactored code
- ✅ 0 duplicate inline styling patterns
- ✅ 100% component reuse where applicable
