/**
 * Utility functions for the Challenge gameplay screen.
 *
 * Rating calculation, timer formatting, and color mapping.
 */

import type { PieceColor } from '../engine/types';
import { PieceColor as PC } from '../engine/types';

/**
 * Calculates the star rating for a puzzle based on solve time.
 * - 3 stars: solveTimeMs <= thresholdFastMs
 * - 2 stars: thresholdFastMs < solveTimeMs <= thresholdSlowMs
 * - 1 star:  solveTimeMs > thresholdSlowMs
 */
export function calculatePuzzleRating(
  solveTimeMs: number,
  thresholdFastMs: number,
  thresholdSlowMs: number,
): number {
  if (solveTimeMs <= thresholdFastMs) return 3;
  if (solveTimeMs <= thresholdSlowMs) return 2;
  return 1;
}

/**
 * Maps puzzle activeColor strings to engine PieceColor values.
 */
export function puzzleColorToPieceColor(color: 'white' | 'black'): PieceColor {
  return color === 'white' ? PC.White : PC.Black;
}

/**
 * Formats milliseconds as "M:SS" for display (e.g., "1:05").
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes) + ':' + String(seconds).padStart(2, '0');
}

/**
 * Formats milliseconds as "M:SS.T" with tenths precision (e.g., "1:05.4").
 */
export function formatPreciseTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes) + ':' + String(seconds).padStart(2, '0') + '.' + String(tenths);
}
