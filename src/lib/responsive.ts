/**
 * Responsive design breakpoints and utilities
 */

export const BREAKPOINTS = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
};

export const MEDIA_QUERIES = {
  xs: `@media (min-width: ${BREAKPOINTS.xs}px)`,
  sm: `@media (min-width: ${BREAKPOINTS.sm}px)`,
  md: `@media (min-width: ${BREAKPOINTS.md}px)`,
  lg: `@media (min-width: ${BREAKPOINTS.lg}px)`,
  xl: `@media (min-width: ${BREAKPOINTS.xl}px)`,
  "2xl": `@media (min-width: ${BREAKPOINTS["2xl"]}px)`,
  "max-sm": `@media (max-width: ${BREAKPOINTS.sm - 1}px)`,
  "max-md": `@media (max-width: ${BREAKPOINTS.md - 1}px)`,
  "max-lg": `@media (max-width: ${BREAKPOINTS.lg - 1}px)`,
};

/**
 * Hook to detect mobile viewport
 */
export function useIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(max-width: ${BREAKPOINTS.md - 1}px)`).matches;
}

/**
 * Hook to detect tablet viewport
 */
export function useIsTablet(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(
    `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  ).matches;
}

/**
 * Hook to detect desktop viewport
 */
export function useIsDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`).matches;
}

/**
 * Responsive grid template columns
 */
export function getResponsiveGridCols(mobile?: number, tablet?: number, desktop?: number): string {
  const mobileVal = mobile || 1;
  const tabletVal = tablet || 2;
  const desktopVal = desktop || 3;

  return `
    grid-template-columns: repeat(${mobileVal}, 1fr);
    @media (min-width: ${BREAKPOINTS.md}px) {
      grid-template-columns: repeat(${tabletVal}, 1fr);
    }
    @media (min-width: ${BREAKPOINTS.lg}px) {
      grid-template-columns: repeat(${desktopVal}, 1fr);
    }
  `;
}

/**
 * Responsive padding helper
 */
export function getResponsivePadding(
  mobilePx?: number,
  tabletPx?: number,
  desktopPx?: number,
): { padding: string; "@media (min-width: 768px)": any; "@media (min-width: 1024px)": any } {
  const mp = mobilePx || 16;
  const tp = tabletPx || 24;
  const dp = desktopPx || 32;

  return {
    padding: `${mp}px`,
    "@media (min-width: 768px)": { padding: `${tp}px` },
    "@media (min-width: 1024px)": { padding: `${dp}px` },
  };
}
