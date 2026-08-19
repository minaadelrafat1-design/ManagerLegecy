/**
 * Application Navigation
 *
 * Premium football management command center navigation.
 * 8 main sections for career management.
 */

import { Link, useLocation } from "@tanstack/react-router";
import { Colors, Spacing, Borders, Transitions, Typography, Shadows } from "./design-system";
import { useCurrentClub } from "@/state/store";

export type NavigationSection =
  | "home"
  | "fixtures"
  | "calendar"
  | "central"
  | "squad"
  | "staff"
  | "tactics"
  | "transfers"
  | "development"
  | "scouting"
  | "club"
  | "manager";

interface NavSection {
  id: NavigationSection;
  label: string;
  icon: string;
  description: string;
  routes: string[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    id: "home",
    label: "Home",
    icon: "⌂",
    description: "Career overview",
    routes: ["/"],
  },
  {
    id: "fixtures",
    label: "Fixtures",
    icon: "📅",
    description: "Match schedule & results",
    routes: ["/fixtures", "/fixtures-modern"],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: "🗓",
    description: "Season calendar",
    routes: ["/calendar"],
  },
  {
    id: "central",
    label: "Central",
    icon: "📰",
    description: "News & events",
    routes: ["/inbox", "/notifications", "/league-pyramid"],
  },
  {
    id: "squad",
    label: "Squad",
    icon: "👥",
    description: "Team management",
    routes: ["/squad", "/player"],
  },
  {
    id: "staff",
    label: "Staff",
    icon: "👔",
    description: "Backroom management",
    routes: ["/staff"],
  },
  {
    id: "tactics",
    label: "Tactics",
    icon: "🎯",
    description: "Formation & prep",
    routes: ["/tactics", "/match"],
  },
  {
    id: "transfers",
    label: "Transfers",
    icon: "🔄",
    description: "Market & deals",
    routes: ["/transfers", "/negotiations"],
  },
  {
    id: "development",
    label: "Development",
    icon: "📈",
    description: "Growth & training",
    routes: ["/training", "/academy", "/treatment"],
  },
  {
    id: "scouting",
    label: "Scouting",
    icon: "🔍",
    description: "Talent identification",
    routes: ["/scouting"],
  },
  {
    id: "club",
    label: "Club",
    icon: "🏟",
    description: "Club management",
    routes: ["/office", "/board", "/fans", "/stadium"],
  },
  {
    id: "manager",
    label: "Manager",
    icon: "👔",
    description: "Career & profile",
    routes: ["/manager-profile", "/season-report"],
  },
];

function getActiveSectionFromPath(pathname: string): NavigationSection | null {
  for (const section of NAV_SECTIONS) {
    for (const route of section.routes) {
      if (pathname === route || pathname.startsWith(route + "/")) {
        return section.id;
      }
    }
  }
  return null;
}

export function AppNavigation() {
  const location = useLocation();
  const activeSection = getActiveSectionFromPath(location.pathname);
  const currentClub = useCurrentClub();

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: Colors.bg.elevation0,
        borderBottom: `1px solid ${Colors.border.default}`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: "1600px",
          margin: "0 auto",
          height: "56px",
          padding: `0 ${Spacing.lg}`,
          gap: Spacing.xl,
        }}
      >
        {/* Logo / Branding */}
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: Spacing.md,
            textDecoration: "none",
            color: "inherit",
            minWidth: 0,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              fontWeight: 900,
              color: Colors.text.inverse,
              background: `linear-gradient(135deg, ${Colors.primary[400]}, ${Colors.primary[600]})`,
              borderRadius: Borders.radius.md,
              boxShadow: Shadows.glow.green,
            }}
          >
            ⚽
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "15px",
                fontWeight: 800,
                color: Colors.text.primary,
                letterSpacing: "-0.02em",
              }}
            >
              Manager Legacy
            </div>
            <div
              style={{
                fontSize: "11px",
                color: Colors.text.tertiary,
                fontWeight: 600,
                marginTop: "2px",
              }}
            >
              {currentClub.name}
            </div>
          </div>
        </Link>

        {/* Main Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: Spacing.sm,
            flex: 1,
            minWidth: 0,
            overflowX: "auto",
            scrollBehavior: "smooth",
            paddingBottom: Spacing.sm,
            marginBottom: `-${Spacing.sm}`,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {NAV_SECTIONS.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <Link
                key={section.id}
                to={section.routes[0] === "/" ? "/" : (section.routes[0] ?? "/")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: Spacing.sm,
                  padding: `${Spacing.sm} ${Spacing.lg}`,
                  fontSize: "12px",
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? Colors.primary[400] : Colors.text.secondary,
                  textDecoration: "none",
                  borderRadius: Borders.radius.md,
                  background: isActive ? `rgba(34, 197, 94, 0.1)` : "transparent",
                  border: isActive ? `1px solid ${Colors.border.focus}` : `1px solid transparent`,
                  transition: Transitions.fast,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = `rgba(100, 116, 139, 0.08)`;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
              >
                <span style={{ fontSize: "14px" }}>{section.icon}</span>
                <span style={{ letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {section.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Right Actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: Spacing.md,
            flexShrink: 0,
          }}
        >
          <Link
            to="/manager-profile"
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: Colors.text.secondary,
              textDecoration: "none",
              padding: `${Spacing.sm} ${Spacing.md}`,
              borderRadius: Borders.radius.md,
              border: `1px solid ${Colors.border.default}`,
              background: Colors.bg.elevation1,
              transition: Transitions.fast,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = Colors.bg.elevation2;
              e.currentTarget.style.borderColor = Colors.border.mid;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = Colors.bg.elevation1;
              e.currentTarget.style.borderColor = Colors.border.default;
            }}
          >
            Profile
          </Link>
          <Link
            to="/new-career"
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: Colors.text.inverse,
              textDecoration: "none",
              padding: `${Spacing.sm} ${Spacing.md}`,
              borderRadius: Borders.radius.md,
              background: Colors.primary[600],
              border: `1px solid ${Colors.primary[700]}`,
              transition: Transitions.fast,
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = Colors.primary[700];
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = Colors.primary[600];
            }}
          >
            New Career
          </Link>
        </div>
      </div>
    </nav>
  );
}

// For use in route detection/context
export { NAV_SECTIONS, getActiveSectionFromPath };
