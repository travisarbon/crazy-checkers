/**
 * CogitateGameAdapter interface and registry (Task 21.1).
 *
 * Every game mode that Cogitate tools operate on provides one adapter
 * implementation. Tools program against this interface; they never reference
 * concrete game-mode modules directly.
 */

import type { ActiveEvent, BoardState, RuleSet } from '../engine/types';
import type { Difficulty } from '../ai/difficulty';
import type { SearchConfig } from '../ai/search';
import type {
  BoardGeometry,
  PieceDefinition,
  ValidationResult,
} from './types';
import type { EvaluationProvider } from './EvaluationProvider';
import type { NotationAdapter } from './NotationAdapter';
import type { PieceDefinition as ClassifiedPieceDefinition } from '../engine/classified/pieceVocabulary';

/**
 * T7-08 extension (Task 27.4): on-board vs. in-hand piece palette split.
 *
 * The Phase 3 `getPiecePalette()` returns the union; Classified games
 * (especially Tier 7 Shogi family) expose the two sub-lists separately via
 * the optional `getOnBoardPalette` / `getHandPalette` methods. Phase 3
 * adapters leave these undefined and keep working unchanged.
 */
export type CogitateOnBoardPalette = readonly ClassifiedPieceDefinition[];
export type CogitateHandReserve = readonly ClassifiedPieceDefinition[];

export interface CogitateGameAdapter {
  /** Unique mode identifier matching GameModeRegistry (e.g., 'classic'). */
  readonly modeId: string;

  /** Parse a serialized board snapshot into a renderable BoardState. */
  getBoard(boardStateStr: string): BoardState;

  /** Serialize a BoardState back to the compact string format. */
  serializeBoard(board: BoardState): string;

  /** Return the correct RuleSet, optionally wired to an active-event context. */
  getRuleSet(eventContext?: readonly ActiveEvent[]): RuleSet;

  /** Return the AI search configuration for a given difficulty. */
  getAIConfig(difficulty: Difficulty): SearchConfig;

  /** Return all piece types available in this game mode (Free Play palette). */
  getPiecePalette(): readonly PieceDefinition[];

  /** Return board geometry descriptor. */
  getBoardGeometry(): BoardGeometry;

  /** Return the standard starting position. */
  getStartingPosition(): BoardState;

  /** Validate a board position under this game's rules. */
  validatePosition(board: BoardState): ValidationResult;

  /** Return the notation converter for this game family. */
  getNotationAdapter(): NotationAdapter;

  /** Whether the AI can produce meaningful position evaluations. */
  supportsEvaluation(): boolean;

  /** The raw evaluation function's score range [min, max]. */
  getEvaluationRange(): readonly [number, number];

  /** Return the evaluation provider for this game mode. */
  getEvaluationProvider(): EvaluationProvider;

  /**
   * T7-08 (Task 27.4): on-board sub-palette using the Phase 4
   * `PieceVocabulary` descriptor shape. Optional on Phase 3 adapters;
   * required for Tier 7 Shogi-family games.
   */
  getOnBoardPalette?(): CogitateOnBoardPalette;

  /**
   * T7-08 (Task 27.4): in-hand sub-palette using the Phase 4
   * `PieceVocabulary` descriptor shape. Empty for games without a hand;
   * optional on Phase 3 adapters.
   */
  getHandPalette?(): CogitateHandReserve;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const registry = new Map<string, CogitateGameAdapter>();

export function registerAdapter(adapter: CogitateGameAdapter): void {
  registry.set(adapter.modeId, adapter);
}

export function getAdapter(modeId: string): CogitateGameAdapter | null {
  return registry.get(modeId) ?? null;
}

export function getAdapterOrThrow(modeId: string): CogitateGameAdapter {
  const adapter = registry.get(modeId);
  if (!adapter) throw new Error(`No Cogitate adapter registered for mode: ${modeId}`);
  return adapter;
}

export function hasAdapter(modeId: string): boolean {
  return registry.has(modeId);
}

/** Test-only utility to clear the registry and re-register. */
export function _clearAdapterRegistry(): void {
  registry.clear();
}

/** Returns all registered mode IDs (for diagnostics). */
export function listRegisteredAdapterIds(): readonly string[] {
  return Array.from(registry.keys());
}
