/**
 * Responsive breakpoint thresholds. CSS media queries in .module.css files
 * must use the same pixel values as these constants.
 *
 * Breakpoint naming follows a mobile-first convention:
 *   - MOBILE: 0 – 479px   (small phones, 360px target)
 *   - PHABLET: 480 – 767px (large phones, 414px target)
 *   - TABLET: 768 – 1023px (tablets, 768px target)
 *   - DESKTOP: 1024 – 1439px (standard desktop, 1024px target)
 *   - WIDE: 1440px+        (large desktop, 1440px target)
 */
export const BREAKPOINT = {
  /** Max-width for small-phone-specific rules */
  MOBILE_MAX: 479,
  /** Max-width for all phone layouts (landscape included) */
  PHABLET_MAX: 767,
  /** Min-width for tablet layout */
  TABLET_MIN: 768,
  /** Max-width for tablet layout */
  TABLET_MAX: 1023,
  /** Min-width for standard desktop */
  DESKTOP_MIN: 1024,
  /** Min-width for wide desktop */
  WIDE_MIN: 1440,
} as const;
