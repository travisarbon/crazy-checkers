/**
 * Stacking-draughts apply-move (Phase 4 Task 29.1).
 *
 * Atomic state transition: given a `StackingGameState` and a legal
 * `StackingMove`, produce the next state with the tower moved (step) or with
 * captures resolved (capture). Capture resolution implements the unique
 * Lasca/Bashni mechanic — the captured tower's commander is lifted onto the
 * bottom of the capturing tower as a prisoner, and the captured tower's
 * remainder reforms under the next-down piece (which may flip the square's
 * allegiance).
 *
 * The function is pure: input state is never mutated. Returned state shares
 * identity with the input for unchanged squares.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  StackingDraughtsConfig,
  StackingGameState,
  StackingMeta,
  StackingMove,
  StackingOwner,
} from './types';
import {
  attachPrisoner,
  fromClassifiedPiece,
  liftCommander,
  replaceCommanderKind,
  toClassifiedPiece,
  topPieceOf,
} from './StackState';
import {
  hashPosition,
  incrementRepetition,
} from './stackingZobrist';

export function applyStackingMove(
  state: StackingGameState,
  move: StackingMove,
  config: StackingDraughtsConfig,
): StackingGameState {
  if (move.kind === 'step') {
    return applyStep(state, move, config);
  }
  return applyCapture(state, move, config);
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

function applyStep(
  state: StackingGameState,
  move: StackingMove,
  config: StackingDraughtsConfig,
): StackingGameState {
  const fromNode = parseLabel(config, move.from, 'step.from');
  const toNode = parseLabel(config, move.to, 'step.to');
  const moverPiece = state.pieces.get(fromNode);
  if (!moverPiece) {
    throw new Error(`[stacking applyMove] step: no tower at ${move.from}`);
  }

  const tower = fromClassifiedPiece(moverPiece);
  const commander = topPieceOf(tower);

  let newTower = tower;
  if (move.promotion === 'king' && commander.kind === 'man') {
    newTower = replaceCommanderKind(tower, 'king');
  }

  const nextPieces = new Map(state.pieces);
  nextPieces.delete(fromNode);
  nextPieces.set(toNode, toClassifiedPiece(newTower));

  return finalize(state, move, nextPieces, config, /*wasCapture=*/ false);
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

function applyCapture(
  state: StackingGameState,
  move: StackingMove,
  config: StackingDraughtsConfig,
): StackingGameState {
  const fromNode = parseLabel(config, move.from, 'capture.from');
  const toNode = parseLabel(config, move.to, 'capture.to');
  const captureNodes = move.capture.map((label, i) =>
    parseLabel(config, label, `capture[${String(i)}]`),
  );
  const pathNodes = pathFromMeta(move);
  if (!pathNodes) {
    throw new Error(
      `[stacking applyMove] capture: move ${move.from}→${move.to} missing required meta.path`,
    );
  }

  const nextPieces = new Map(state.pieces);
  const moverPiece = state.pieces.get(fromNode);
  if (!moverPiece) {
    throw new Error(`[stacking applyMove] capture: no tower at ${move.from}`);
  }
  let workingTower = fromClassifiedPiece(moverPiece);
  nextPieces.delete(fromNode);

  // Lift commanders one at a time, applying mid-capture promotion when the
  // commander steps onto its promotion row mid-chain (Bashni only).
  for (let i = 0; i < captureNodes.length; i += 1) {
    const victimNode = captureNodes[i] as NodeId;
    const victimPiece = nextPieces.get(victimNode);
    if (!victimPiece) {
      throw new Error(
        `[stacking applyMove] capture: no tower at victim square ${move.capture[i] ?? '<unknown>'}`,
      );
    }

    const victimTower = fromClassifiedPiece(victimPiece);
    const { lifted, remainder } = liftCommander(victimTower);

    nextPieces.delete(victimNode);
    if (remainder !== null) {
      nextPieces.set(victimNode, toClassifiedPiece(remainder));
    }

    workingTower = attachPrisoner(workingTower, lifted);

    // Mid-capture promotion (Bashni): if the commander is a man and the
    // landing square (path index i+1) is the promotion row for its owner,
    // promote in place so the next leg uses king mechanics. Note that
    // legalisation already considered this when generating the move.
    if (config.midCapturePromotion && topPieceOf(workingTower).kind === 'man') {
      const landingNode = pathNodes[i + 1] as NodeId;
      const landingRow = Math.floor((landingNode as unknown as number) / config.boardSize);
      const owner = topPieceOf(workingTower).owner;
      if (landingRow === config.promotionRow[owner]) {
        workingTower = replaceCommanderKind(workingTower, 'king');
      }
    }
  }

  // Terminal-square promotion: if the commander is still a man and the chain
  // ends on the promotion row, promote it now (covers Lasca's
  // capture-arrival-promotion case and Bashni when no mid-leg promoted).
  const commanderAfter = topPieceOf(workingTower);
  if (commanderAfter.kind === 'man') {
    const finalRow = Math.floor((toNode as unknown as number) / config.boardSize);
    if (finalRow === config.promotionRow[commanderAfter.owner]) {
      workingTower = replaceCommanderKind(workingTower, 'king');
    }
  }

  nextPieces.set(toNode, toClassifiedPiece(workingTower));

  return finalize(state, move, nextPieces, config, /*wasCapture=*/ true);
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function pathFromMeta(move: StackingMove): readonly NodeId[] | null {
  const path = move.meta?.path;
  if (!path) return null;
  return path.map((n) => n as unknown as NodeId);
}

// ---------------------------------------------------------------------------
// Finalisation
// ---------------------------------------------------------------------------

function finalize(
  state: StackingGameState,
  move: StackingMove,
  nextPieces: Map<NodeId, ClassifiedPiece>,
  config: StackingDraughtsConfig,
  wasCapture: boolean,
): StackingGameState {
  const nextTurn: StackingOwner = state.turn === 'white' ? 'black' : 'white';
  const nextHash = hashPosition(nextPieces, nextTurn, config);

  const meta: StackingMeta = {
    stackingTurn: nextTurn,
    halfMoveClock: wasCapture ? 0 : state.meta.halfMoveClock + 1,
    repetitionTable: incrementRepetition(state.meta.repetitionTable, nextHash),
  };

  return {
    pieces: nextPieces,
    turn: nextTurn,
    plyCount: state.plyCount + 1,
    moveHistory: Object.freeze([...state.moveHistory, move]),
    meta,
  };
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function parseLabel(
  config: StackingDraughtsConfig,
  label: string,
  context: string,
): NodeId {
  const node = config.boardGeometry.coordinateLabels.parseNotation(label);
  if (node === null) {
    throw new Error(
      `[stacking applyMove] ${context}: unparsable notation token "${label}"`,
    );
  }
  return node;
}

