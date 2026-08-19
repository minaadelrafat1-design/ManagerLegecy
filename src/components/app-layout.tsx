/**
 * Application Layout Shell
 *
 * Provides consistent page structure for all main gameplay screens.
 * Handles full-height viewport, content containers, and responsive layout.
 */

import { ReactNode, CSSProperties } from "react";
import { Colors, Spacing, Layout } from "./design-system";

interface AppLayoutProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Main application layout wrapper
 * Should wrap all route content (except new-career, match, etc. which are full-screen)
 */
export function AppLayout({ children, className, style }: AppLayoutProps) {
  return (
    <div
      className={className}
      style={{
        minHeight: "100vh",
        background: Colors.bg.surface,
        color: Colors.text.primary,
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Page container with consistent max-width and padding
 * Used inside AppLayout for main content
 */
export function PageContainer({
  children,
  className,
  style,
  maxWidth = "1600px",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  maxWidth?: string | number;
  padded?: boolean;
}) {
  return (
    <div
      className={className}
      style={{
        flex: 1,
        maxWidth: maxWidth,
        width: "100%",
        margin: "0 auto",
        padding: padded ? `${Spacing.xl} ${Spacing.lg}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Page header with title and metadata
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
  style,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: Spacing.lg,
        marginBottom: Spacing["3xl"],
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 900,
            color: Colors.text.primary,
            margin: 0,
            marginBottom: subtitle ? Spacing.sm : 0,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              fontSize: "14px",
              color: Colors.text.secondary,
              margin: 0,
              fontWeight: 500,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: Spacing.md, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}

/**
 * Content grid for organizing sections
 * Responsive grid that adapts to available space
 */
export function ContentGrid({
  children,
  columns = 2,
  gap = Spacing.lg,
  className,
  style,
}: {
  children: ReactNode;
  columns?: number | string;
  gap?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns:
          typeof columns === "number" ? `repeat(${columns}, minmax(0, 1fr))` : columns,
        gap: gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Panel - Elevated content container
 * Used for cards, sections, and grouped content
 */
export function Panel({
  children,
  header,
  footer,
  elevated = false,
  className,
  style,
}: {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  elevated?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={className}
      style={{
        background: elevated ? Colors.bg.elevation2 : Colors.bg.elevation1,
        border: `1px solid ${elevated ? Colors.border.mid : Colors.border.default}`,
        borderRadius: "12px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        transition: "all 150ms ease-in-out",
        ...style,
      }}
    >
      {header && (
        <div
          style={{
            padding: Spacing.lg,
            borderBottom: `1px solid ${Colors.border.default}`,
            background: elevated ? Colors.bg.elevation3 : undefined,
          }}
        >
          {header}
        </div>
      )}
      <div style={{ padding: Spacing.lg, flex: 1 }}>{children}</div>
      {footer && (
        <div
          style={{
            padding: Spacing.lg,
            borderTop: `1px solid ${Colors.border.default}`,
            background: elevated ? Colors.bg.elevation3 : undefined,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * Section - Grouping container for related content
 */
export function Section({
  title,
  subtitle,
  children,
  className,
  style,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={className} style={{ marginBottom: Spacing["3xl"], ...style }}>
      {(title || subtitle) && (
        <div style={{ marginBottom: Spacing.lg }}>
          {title && (
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 800,
                color: Colors.text.primary,
                margin: 0,
                marginBottom: subtitle ? Spacing.sm : 0,
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h2>
          )}
          {subtitle && (
            <p
              style={{
                fontSize: "13px",
                color: Colors.text.tertiary,
                margin: 0,
                fontWeight: 500,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Divider - Visual separator
 */
export function Divider({ style }: { style?: CSSProperties } = {}) {
  return (
    <div
      style={{
        height: "1px",
        background: Colors.border.default,
        margin: `${Spacing.lg} 0`,
        ...style,
      }}
    />
  );
}
