/**
 * Brand mark — the "two-pass annotated checker piece" rendered above
 * the menu's mode grid (P3.1). Sister mark of the P1.5 favicon and
 * OG image: same brand family, but rendered at 96x96 with the richer
 * annotation chrome (dashed inner ring, India-red "king?" callout)
 * that the 64x64 favicon omits for tab-size legibility. See
 * Documentation/UI Overhaul/P3.1-MenuScreen-Reskin.md §6.4 for the
 * source-of-truth disposition. If you edit this mark, the per-task
 * notebook for the change must enumerate public/favicon.svg and
 * public/og-image.png as sister edits.
 *
 * Decorative — paired with the visible wordmark, so it's aria-hidden.
 * Under non-Margin-Notes themes, the parent CSS module hides it via
 * `display: none;` (see MenuScreen.module.css).
 */

interface BrandMarkProps {
  readonly size?: number;
  readonly className?: string;
}

export default function BrandMark({ size = 96, className }: BrandMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 96 96"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      {/* Ink piece — the "what" */}
      <circle
        cx="48"
        cy="54"
        r="32"
        fill="var(--ui-surface)"
        stroke="var(--ui-text)"
        strokeWidth="2.5"
      />
      <circle
        cx="48"
        cy="54"
        r="24"
        fill="none"
        stroke="var(--ui-text)"
        strokeWidth="1.5"
        strokeDasharray="2 3"
      />
      {/* Pencil-blue crown sketched on top — the "annotation" */}
      <path
        d="M 24 26 L 30 8 L 38 22 L 48 6 L 58 22 L 66 8 L 72 26 L 24 26 Z"
        fill="none"
        stroke="var(--ballpoint-blue)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        transform="rotate(-2 48 18)"
      />
      {/* India-red arrow + "king?" annotation */}
      <path
        d="M 78 50 Q 90 50 88 38"
        fill="none"
        stroke="var(--india-red)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <text
        x="78"
        y="38"
        fontFamily="var(--annotation-font)"
        fontSize="13"
        fill="var(--india-red)"
      >
        king?
      </text>
    </svg>
  );
}
