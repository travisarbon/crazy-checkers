/**
 * animateAlongArc — sampled polyline along one of Surakarta's corner arcs.
 *
 * Exposed for Tier 3 Task 30 (Surakarta gameplay) which drives the piece
 * animation through the arc on capture. Separated from the renderer so the
 * helper stays tree-shakeable and the renderer file obeys the
 * `react-refresh/only-export-components` rule.
 */

const INNER_SIZE = 6;

export interface ArcAnimationPoint {
  readonly x: number;
  readonly y: number;
}

export function animateAlongArc(
  cell: number,
  from: { row: number; col: number },
  to: { row: number; col: number },
  samples = 24,
): readonly ArcAnimationPoint[] {
  const cornerR = from.row < INNER_SIZE / 2 ? -0.5 : INNER_SIZE - 0.5;
  const cornerC = from.col < INNER_SIZE / 2 ? -0.5 : INNER_SIZE - 0.5;
  const cx = cornerC * cell;
  const cy = cornerR * cell;
  const fx = from.col * cell;
  const fy = from.row * cell;
  const tx = to.col * cell;
  const ty = to.row * cell;
  const startAngle = Math.atan2(fy - cy, fx - cx);
  const endAngle = Math.atan2(ty - cy, tx - cx);
  const radius = Math.hypot(fx - cx, fy - cy);
  const points: ArcAnimationPoint[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const angle = startAngle + (endAngle - startAngle) * t;
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return points;
}
