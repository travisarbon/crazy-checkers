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
