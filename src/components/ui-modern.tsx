import { useState, useRef, useEffect, type ReactNode, type CSSProperties } from "react";

// ─── Modern AAA Design Tokens ────────────────────────────────────────────────

export const TMod = {
  // Backgrounds - Professional dark theme
  bgPrimary: "#0A0E27", // Deep dark navy (main background)
  bgSecondary: "#111C3F", // Slightly lighter for panels
  bgTertiary: "#1A2750", // For tertiary layers
  bgPanel: "rgba(17, 28, 63, 0.85)", // Semi-transparent panels
  bgHover: "rgba(30, 45, 90, 0.5)", // Hover state

  // Borders - Subtle, professional
  borderLight: "rgba(255, 255, 255, 0.08)",
  borderMid: "rgba(255, 255, 255, 0.14)",
  borderAccent: "rgba(76, 240, 164, 0.3)",
  borderHighlight: "rgba(76, 240, 164, 0.6)",

  // Text - Clean hierarchy
  textPrimary: "#FFFFFF", // Pure white for primary text
  textSecondary: "#B8C5D6", // Light gray for secondary
  textTertiary: "#7A8BA3", // Muted gray for tertiary
  textMuted: "#5A6A7F", // Very muted for disabled/inactive

  // Accent colors - Professional football palette
  accentGreen: "#2FE08A", // Vibrant accent green
  accentGreenDark: "#0D7A52", // Dark green
  accentGreenLight: "#4FDBFF", // Light cyan
  accentBlue: "#3AA0FF", // Professional blue
  accentCyan: "#4FDBFF", // Cyan accent
  accentGold: "#F0C24B", // Gold for highlights
  accentOrange: "#FF9F45", // Orange for warnings
  accentRed: "#FF5A62", // Red for critical
  accentPurple: "#9D4EDD", // Purple for special

  // Semantic colors
  success: "#2FE08A",
  warning: "#F0C24B",
  error: "#FF5A62",
  info: "#4FDBFF",

  // Shadows - Professional depth
  shadowSm: "0 2px 8px rgba(0, 0, 0, 0.3)",
  shadowMd: "0 4px 16px rgba(0, 0, 0, 0.4)",
  shadowLg: "0 8px 32px rgba(0, 0, 0, 0.5)",
  shadowXl: "0 12px 48px rgba(0, 0, 0, 0.6)",
  glowGreen: "0 0 24px rgba(47, 224, 138, 0.3)",
  glowBlue: "0 0 24px rgba(58, 160, 255, 0.3)",

  // Gradients
  gradientGreen: "linear-gradient(135deg, #2FE08A 0%, #0D7A52 100%)",
  gradientBlue: "linear-gradient(135deg, #3AA0FF 0%, #1A5FD4 100%)",
  gradientGold: "linear-gradient(135deg, #F0C24B 0%, #D4942C 100%)",
};

// ─── Professional Panel Cards ────────────────────────────────────────────────

interface PanelProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "elevated" | "glass";
  padding?: string;
  style?: CSSProperties;
  onClick?: () => void;
  interactive?: boolean;
}

export function ModPanel({
  children,
  variant = "primary",
  padding = "20px",
  style,
  onClick,
  interactive = false,
}: PanelProps) {
  const [hovered, setHovered] = useState(false);

  const variants = {
    primary: {
      background: `linear-gradient(135deg, ${TMod.bgSecondary} 0%, ${TMod.bgTertiary} 100%)`,
      border: `1px solid ${TMod.borderMid}`,
      boxShadow: TMod.shadowMd,
    },
    secondary: {
      background: TMod.bgPanel,
      border: `1px solid ${TMod.borderLight}`,
      boxShadow: TMod.shadowSm,
    },
    elevated: {
      background: `linear-gradient(135deg, ${TMod.bgSecondary} 0%, ${TMod.bgPanel} 100%)`,
      border: `1.5px solid ${TMod.borderAccent}`,
      boxShadow: `${TMod.shadowLg}, ${TMod.glowGreen}`,
    },
    glass: {
      background: "rgba(17, 28, 63, 0.3)",
      backdropFilter: "blur(12px)",
      border: `1px solid ${TMod.borderLight}`,
      boxShadow: TMod.shadowSm,
    },
  };

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding,
        borderRadius: 12,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        cursor: interactive ? "pointer" : "default",
        transform: interactive && hovered ? "translateY(-2px)" : "translateY(0)",
        ...variants[variant],
        ...(interactive &&
          hovered && {
            borderColor: TMod.borderAccent,
            boxShadow: `${TMod.shadowLg}, ${TMod.glowGreen}`,
          }),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Modern Header/Section Components ────────────────────────────────────────

interface SectionHeadProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  divider?: boolean;
}

export function ModSectionHead({
  title,
  subtitle,
  icon,
  action,
  divider = true,
}: SectionHeadProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {icon && (
            <div
              style={{
                fontSize: 22,
                display: "flex",
                alignItems: "center",
                color: TMod.accentGreen,
              }}
            >
              {icon}
            </div>
          )}
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: TMod.textPrimary,
                letterSpacing: "0.02em",
                textTransform: "uppercase",
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: TMod.textTertiary,
                  fontWeight: 400,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      {divider && (
        <div
          style={{
            height: 1,
            background: `linear-gradient(90deg, ${TMod.borderAccent}, transparent)`,
          }}
        />
      )}
    </div>
  );
}

// ─── Modern Data Display Cards ───────────────────────────────────────────────

interface StatRowProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
  barValue?: number; // 0-100
  trend?: "up" | "down" | "neutral";
}

export function ModStatRow({
  label,
  value,
  unit,
  color = TMod.accentGreen,
  barValue,
  trend,
}: StatRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: `1px solid ${TMod.borderLight}`,
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: TMod.textSecondary,
          flex: 1,
        }}
      >
        <span>{label}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {barValue !== undefined && (
          <div
            style={{
              width: 60,
              height: 4,
              borderRadius: 2,
              background: TMod.borderLight,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${barValue}%`,
                height: "100%",
                background: color,
                boxShadow: `0 0 8px ${color}`,
              }}
            />
          </div>
        )}

        <div
          style={{
            minWidth: 60,
            textAlign: "right",
            display: "flex",
            alignItems: "center",
            gap: 4,
            color,
            fontWeight: 700,
          }}
        >
          {value}
          {unit && <span style={{ fontSize: 11, opacity: 0.7 }}>{unit}</span>}
          {trend && (
            <span style={{ fontSize: 12, marginLeft: 4 }}>
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modern Player Card ──────────────────────────────────────────────────────

interface ModPlayerCardProps {
  name: string;
  position: string;
  number?: number;
  overall: number;
  image?: string;
  stats?: { label: string; value: number | string }[];
  onSelect?: () => void;
  selected?: boolean;
  highlighted?: boolean;
}

export function ModPlayerCard({
  name,
  position,
  number,
  overall,
  image,
  stats,
  onSelect,
  selected = false,
  highlighted = false,
}: ModPlayerCardProps) {
  const ratingColor = (rating: number): string => {
    if (rating >= 85) return TMod.accentGreen;
    if (rating >= 80) return TMod.accentBlue;
    if (rating >= 75) return TMod.accentCyan;
    if (rating >= 70) return TMod.textSecondary;
    return TMod.textTertiary;
  };

  return (
    <ModPanel
      variant={selected ? "elevated" : highlighted ? "primary" : "secondary"}
      padding="16px"
      {...(onSelect ? { onClick: onSelect } : {})}
      interactive={!!onSelect}
      style={{
        cursor: onSelect ? "pointer" : "default",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 16 }}>
        {/* Player image/number area */}
        <div
          style={{
            position: "relative",
            width: 60,
            height: 80,
            borderRadius: 8,
            background: TMod.bgTertiary,
            border: `2px solid ${ratingColor(overall)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {image ? (
            <img
              src={image}
              alt={name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span style={{ fontSize: 24, fontWeight: 800, color: ratingColor(overall) }}>
                {number || "—"}
              </span>
              <span style={{ fontSize: 10, color: TMod.textTertiary }}>
                {position.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Player info */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 800,
                  color: TMod.textPrimary,
                }}
              >
                {name}
              </h3>
              <span
                style={{
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 700,
                  color: ratingColor(overall),
                  background: `rgba(${hexToRgb(ratingColor(overall))}, 0.1)`,
                  border: `1px solid ${ratingColor(overall)}`,
                }}
              >
                {overall}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: TMod.textTertiary,
              }}
            >
              {position}
            </p>
          </div>

          {stats && stats.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {stats.slice(0, 4).map((stat, i) => (
                <div key={i} style={{ fontSize: 11 }}>
                  <div style={{ color: TMod.textTertiary, marginBottom: 2 }}>{stat.label}</div>
                  <div style={{ color: TMod.accentGreen, fontWeight: 700 }}>{stat.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModPanel>
  );
}

// ─── Modern Tabs Component ───────────────────────────────────────────────────

interface ModTabsProps {
  tabs: { id: string; label: string; icon?: ReactNode }[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export function ModTabs({ tabs, activeTab, onChange }: ModTabsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        borderBottom: `1px solid ${TMod.borderLight}`,
        marginBottom: 20,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            padding: "12px 20px",
            border: "none",
            background: "transparent",
            color: activeTab === tab.id ? TMod.accentGreen : TMod.textSecondary,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 8,
            transition: "all 0.25s ease",
            textTransform: "uppercase",
            letterSpacing: "0.02em",
          }}
        >
          {tab.icon && <span>{tab.icon}</span>}
          {tab.label}
          {activeTab === tab.id && (
            <div
              style={{
                position: "absolute",
                bottom: -1,
                left: 0,
                right: 0,
                height: 2,
                background: TMod.accentGreen,
                boxShadow: TMod.glowGreen,
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Modern Badge ───────────────────────────────────────────────────────────

interface ModBadgeProps {
  label: string;
  color?: "green" | "blue" | "gold" | "red" | "orange";
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "outline" | "subtle";
}

export function ModBadge({
  label,
  color = "green",
  size = "md",
  variant = "subtle",
}: ModBadgeProps) {
  const colorMap = {
    green: TMod.accentGreen,
    blue: TMod.accentBlue,
    gold: TMod.accentGold,
    red: TMod.accentRed,
    orange: TMod.accentOrange,
  };

  const sizeMap = {
    sm: { padding: "4px 10px", fontSize: 11 },
    md: { padding: "6px 14px", fontSize: 12 },
    lg: { padding: "8px 16px", fontSize: 13 },
  };

  const c = colorMap[color];
  const s = sizeMap[size];

  const variants = {
    solid: {
      background: c,
      color: "#000",
      border: "none",
    },
    outline: {
      background: "transparent",
      color: c,
      border: `1.5px solid ${c}`,
    },
    subtle: {
      background: `rgba(${hexToRgb(c)}, 0.15)`,
      color: c,
      border: `1px solid rgba(${hexToRgb(c)}, 0.3)`,
    },
  };

  return (
    <span
      style={{
        ...s,
        ...variants[variant],
        borderRadius: 6,
        fontWeight: 700,
        display: "inline-block",
        whiteSpace: "nowrap",
        letterSpacing: "0.02em",
      }}
    >
      {label}
    </span>
  );
}

// ─── Screen Header (Large title with breadcrumb, context info) ──────────────

interface ScreenHeaderProps {
  title: string;
  breadcrumb?: string;
  subtitle?: string;
  stats?: { label: string; value: string | number }[];
  action?: ReactNode;
  variant?: "standard" | "elevated";
}

export function ScreenHeader({
  title,
  breadcrumb,
  subtitle,
  stats,
  action,
  variant = "standard",
}: ScreenHeaderProps) {
  return (
    <div
      style={{
        width: "100%",
        background:
          variant === "elevated"
            ? `linear-gradient(135deg, ${TMod.bgSecondary} 0%, ${TMod.bgTertiary} 100%)`
            : TMod.bgPrimary,
        borderBottom: `1px solid ${TMod.borderLight}`,
        padding: "28px 32px",
      }}
    >
      <div style={{ maxWidth: "100%", margin: "0 auto" }}>
        {breadcrumb && (
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.12em",
              color: TMod.textTertiary,
              fontWeight: 700,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {breadcrumb}
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            marginBottom: subtitle || stats ? 16 : 0,
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 40,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: TMod.textPrimary,
              }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 13,
                  color: TMod.textSecondary,
                  fontWeight: 500,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>

        {stats && stats.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.min(4, stats.length)}, 1fr)`,
              gap: 16,
              marginTop: 12,
            }}
          >
            {stats.map((stat, i) => (
              <div key={i}>
                <div
                  style={{
                    fontSize: 11,
                    color: TMod.textTertiary,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 4,
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: TMod.accentGreen,
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Metric Card (for stats display) ─────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: string | number;
  color?: string;
  variant?: "default" | "success" | "warning" | "error";
  icon?: ReactNode;
  subtitle?: string;
}

export function MetricCard({
  label,
  value,
  color,
  variant = "default",
  icon,
  subtitle,
}: MetricCardProps) {
  const variantColors = {
    default: TMod.accentGreen,
    success: "#2FE08A",
    warning: TMod.accentGold,
    error: TMod.accentRed,
  };

  const displayColor = color || variantColors[variant];

  return (
    <ModPanel
      variant="secondary"
      padding="20px"
      style={{
        borderLeft: `3px solid ${displayColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: TMod.textTertiary,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: displayColor,
              letterSpacing: "-0.02em",
              marginBottom: subtitle ? 4 : 0,
            }}
          >
            {value}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 12,
                color: TMod.textSecondary,
                marginTop: 4,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {icon && (
          <div
            style={{
              fontSize: 32,
              opacity: 0.6,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </ModPanel>
  );
}

// ─── Content Grid (unified grid layout) ──────────────────────────────────────

interface ContentGridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: number;
  style?: CSSProperties;
}

export function ContentGrid({ children, columns = 3, gap = 20, style }: ContentGridProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(280px, 1fr))`,
        gap: `${gap}px`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Screen Layout (main wrapper with consistent padding) ────────────────────

interface ScreenLayoutProps {
  children: ReactNode;
  showHero?: boolean;
  heroTitle?: string;
  heroBreadcrumb?: string;
  heroStats?: { label: string; value: string | number }[];
  heroAction?: ReactNode;
}

export function ScreenLayout({
  children,
  showHero,
  heroTitle,
  heroBreadcrumb,
  heroStats,
  heroAction,
}: ScreenLayoutProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: TMod.bgPrimary,
        color: TMod.textPrimary,
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {showHero && heroTitle && (
        <ScreenHeader
          title={heroTitle}
          {...(heroBreadcrumb ? { breadcrumb: heroBreadcrumb } : {})}
          {...(heroStats ? { stats: heroStats } : {})}
          {...(heroAction ? { action: heroAction } : {})}
        />
      )}
      <div style={{ flex: 1, padding: "32px" }}>
        <div style={{ maxWidth: "1600px", margin: "0 auto" }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Stat Bar Row (for player stats, skill bars, etc.) ───────────────────────

interface StatBarRowProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
  showPercent?: boolean;
}

export function StatBarRow({
  label,
  value,
  max = 99,
  color = TMod.accentGreen,
  showPercent = true,
}: StatBarRowProps) {
  const percentage = (value / max) * 100;
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: TMod.textSecondary,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color,
          }}
        >
          {showPercent ? `${Math.round(percentage)}%` : value}
        </span>
      </div>
      <div
        style={{
          width: "100%",
          height: 6,
          borderRadius: 3,
          background: TMod.borderLight,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: color,
            boxShadow: `0 0 8px ${color}`,
            borderRadius: 3,
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}

// ─── Filter Chip (for filter selections) ────────────────────────────────────

interface FilterChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export function FilterChip({ label, selected, onClick, onRemove }: FilterChipProps) {
  return (
    <button
      onClick={onRemove || onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 20,
        border: `1px solid ${selected ? TMod.borderAccent : TMod.borderLight}`,
        background: selected ? `rgba(${hexToRgb(TMod.accentGreen)}, 0.1)` : "transparent",
        color: selected ? TMod.accentGreen : TMod.textSecondary,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        alignItems: "center",
        gap: 6,
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {onRemove && <span style={{ marginLeft: 4, fontSize: 14 }}>×</span>}
    </button>
  );
}

// ─── Utility: Hex to RGB converter ───────────────────────────────────────────

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) return "255, 255, 255";
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)].join(", ");
}

// ─── Modern Button (replacing old ones) ──────────────────────────────────────

interface ModButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "tertiary" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  loading?: boolean;
}

export function ModButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  fullWidth = false,
  disabled = false,
  icon,
  loading = false,
}: ModButtonProps) {
  const [pressed, setPressed] = useState(false);

  const sizeMaps = {
    sm: { padding: "8px 16px", fontSize: 12 },
    md: { padding: "12px 24px", fontSize: 13 },
    lg: { padding: "14px 32px", fontSize: 14 },
  };

  const variantMaps = {
    primary: {
      background: TMod.gradientGreen,
      color: "#000",
      border: `1px solid ${TMod.accentGreen}`,
      hover: { boxShadow: `${TMod.shadowLg}, ${TMod.glowGreen}` },
    },
    secondary: {
      background: `rgba(${hexToRgb(TMod.accentGreen)}, 0.1)`,
      color: TMod.accentGreen,
      border: `1px solid ${TMod.borderAccent}`,
      hover: { background: `rgba(${hexToRgb(TMod.accentGreen)}, 0.2)` },
    },
    tertiary: {
      background: "transparent",
      color: TMod.textSecondary,
      border: `1px solid ${TMod.borderMid}`,
      hover: { color: TMod.accentGreen },
    },
    danger: {
      background: TMod.accentRed,
      color: "#FFF",
      border: `1px solid ${TMod.accentRed}`,
      hover: { boxShadow: `0 0 16px rgba(255, 90, 98, 0.4)` },
    },
  };

  const s = sizeMaps[size];
  const v = variantMaps[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        ...s,
        width: fullWidth ? "100%" : "auto",
        ...v,
        borderRadius: 8,
        fontWeight: 700,
        fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        transform: pressed && !disabled ? "scale(0.98)" : "scale(1)",
      }}
    >
      {icon && <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>}
      {loading ? "..." : children}
    </button>
  );
}

// ─── Modern Match/Fixture Card ──────────────────────────────────────────────

interface ModFixtureCardProps {
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  date: string;
  time?: string;
  competition?: string;
  isPlayable?: boolean;
  isManager?: boolean; // If this is the manager's match
  onSelect?: () => void;
}

export function ModFixtureCard({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  date,
  time,
  competition,
  isPlayable = false,
  isManager = false,
  onSelect,
}: ModFixtureCardProps) {
  const isPlayed = homeScore !== undefined && awayScore !== undefined;

  return (
    <ModPanel
      variant={isManager ? "elevated" : "secondary"}
      padding="16px"
      {...(onSelect ? { onClick: onSelect } : {})}
      interactive={!!onSelect}
      style={{
        borderLeft: isManager ? `4px solid ${TMod.accentGreen}` : "none",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 16,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        {/* Home team */}
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: TMod.textPrimary,
              marginBottom: 4,
            }}
          >
            {homeTeam}
          </div>
          {isPlayed && (
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: TMod.accentGreen,
              }}
            >
              {homeScore}
            </div>
          )}
        </div>

        {/* Score/Divider */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          {isPlayed ? (
            <span style={{ fontSize: 14, color: TMod.textTertiary, fontWeight: 700 }}>VS</span>
          ) : (
            <span style={{ fontSize: 12, color: TMod.textTertiary }}>VS</span>
          )}
          {isPlayable && <ModBadge label="PLAYABLE" color="green" size="sm" variant="solid" />}
        </div>

        {/* Away team */}
        <div style={{ textAlign: "left" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: TMod.textPrimary,
              marginBottom: 4,
            }}
          >
            {awayTeam}
          </div>
          {isPlayed && (
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: TMod.accentBlue,
              }}
            >
              {awayScore}
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: TMod.textTertiary,
          borderTop: `1px solid ${TMod.borderLight}`,
          paddingTop: 10,
        }}
      >
        <div>
          <span>{date}</span>
          {time && <span style={{ marginLeft: 12 }}>• {time}</span>}
        </div>
        {competition && <span style={{ color: TMod.accentGold }}>{competition}</span>}
      </div>
    </ModPanel>
  );
}

// ─── Slider Control (for tactics, training intensity) ────────────────────────

interface SliderControlProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  hint?: string;
  color?: string;
}

export function SliderControl({
  label,
  value,
  min = 0,
  max = 100,
  onChange,
  hint,
  color = TMod.accentGreen,
}: SliderControlProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div>
          <label
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: TMod.textPrimary,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {label}
          </label>
          {hint && (
            <div
              style={{
                fontSize: 11,
                color: TMod.textTertiary,
                marginTop: 2,
              }}
            >
              {hint}
            </div>
          )}
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 900,
            color,
            minWidth: 40,
            textAlign: "right",
          }}
        >
          {value}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{
          width: "100%",
          height: 8,
          borderRadius: 4,
          background: `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, ${TMod.borderMid} ${percentage}%, ${TMod.borderMid} 100%)`,
          WebkitAppearance: "none",
          appearance: "none",
          cursor: "pointer",
          outline: "none",
        }}
      />
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${color};
          cursor: pointer;
          box-shadow: 0 0 12px ${color};
          border: 2px solid ${TMod.bgPrimary};
          transition: box-shadow 0.2s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          box-shadow: 0 0 20px ${color};
        }
        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: ${color};
          cursor: pointer;
          box-shadow: 0 0 12px ${color};
          border: 2px solid ${TMod.bgPrimary};
          transition: box-shadow 0.2s ease;
        }
        input[type="range"]::-moz-range-thumb:hover {
          box-shadow: 0 0 20px ${color};
        }
      `}</style>
    </div>
  );
}

// ─── Toggle Button (for on/off settings) ──────────────────────────────────────

interface ToggleProps {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  hint?: string;
  color?: string;
}

export function ModToggle({
  label,
  enabled,
  onChange,
  hint,
  color = TMod.accentGreen,
}: ToggleProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: "12px 0",
        borderBottom: `1px solid ${TMod.borderLight}`,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: TMod.textPrimary,
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        {hint && <div style={{ fontSize: 11, color: TMod.textTertiary }}>{hint}</div>}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        style={{
          width: 48,
          height: 24,
          borderRadius: 12,
          border: "none",
          background: enabled ? color : TMod.borderMid,
          cursor: "pointer",
          position: "relative",
          transition: "all 0.25s ease",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 2,
            left: enabled ? 26 : 2,
            width: 20,
            height: 20,
            borderRadius: 50,
            background: TMod.textPrimary,
            transition: "left 0.25s ease",
            boxShadow: `0 0 8px ${enabled ? color : "transparent"}`,
          }}
        />
      </button>
    </div>
  );
}

// ─── Empty State (for no results) ────────────────────────────────────────────

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 20px",
        color: TMod.textSecondary,
      }}
    >
      {icon && (
        <div
          style={{
            fontSize: 48,
            marginBottom: 16,
            opacity: 0.6,
          }}
        >
          {icon}
        </div>
      )}
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: TMod.textPrimary,
          marginBottom: 8,
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: 13,
            marginBottom: action ? 24 : 0,
          }}
        >
          {description}
        </p>
      )}
      {action && action}
    </div>
  );
}

// ─── Stat Box (compact stat display) ──────────────────────────────────────────

interface StatBoxProps {
  label: string;
  value: string | number;
  color?: string;
  size?: "sm" | "md" | "lg";
}

export function StatBox({ label, value, color = TMod.accentGreen, size = "md" }: StatBoxProps) {
  const sizeMaps = {
    sm: { padding: "8px 12px", fontSize: 11, valueSize: 14 },
    md: { padding: "12px 16px", fontSize: 12, valueSize: 18 },
    lg: { padding: "16px 20px", fontSize: 13, valueSize: 24 },
  };

  const s = sizeMaps[size];

  return (
    <div
      style={{
        padding: s.padding,
        borderRadius: 8,
        background: `rgba(${hexToRgb(color)}, 0.08)`,
        border: `1px solid rgba(${hexToRgb(color)}, 0.2)`,
      }}
    >
      <div
        style={{
          fontSize: s.fontSize,
          fontWeight: 700,
          color: TMod.textTertiary,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: s.valueSize,
          fontWeight: 900,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}
