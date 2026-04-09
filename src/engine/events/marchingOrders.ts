/**
 * Marching Orders — production event decorator (Event 10).
 *
 * Permanent event. Replaces all diagonal movement with orthogonal (up, down,
 * left, right). The playable surface expands to all 64 squares. Pieces
 * remain on their current (dark) squares at activation.
 *
 * An internal 64-element grid in metadata is the source of truth for move
 * generation. The 32-square BoardState is kept in sync as a projection
 * (dark-square positions only). Light-square pieces exist solely in metadata
 * and are rendered by the MarchingOrdersIndicator overlay.
 *
 * Moves use "extended square" numbers: 1–32 = dark squares (standard),
 * 33–64 = light squares. The UI Board must render light squares as
 * interactive when Marching Orders is active.
 *
 * Duration: -1 (permanent). Overrides getLegalMoves, applyMove, shouldPromote.
 */

import type { BoardState, GameResult, Move, Piece, RuleSet, Square, SquareState } from '../types';
import { CrazyEvent, GameEndReason, GameResultType, PieceColor, PieceType } from '../types';
import { BOARD_SIZE, squareToGrid, gridToSquare } from '../board';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

// ---------------------------------------------------------------------------
// Serialized piece type for metadata storage
// ---------------------------------------------------------------------------

interface SerializedPiece {
  readonly color: PieceColor;
  readonly type: PieceType;
}

/** Metadata stored in ActiveEvent.metadata for Marching Orders. */
export interface MarchingOrdersMetadata {
  readonly orthogonalGrid: readonly (SerializedPiece | null)[]; // 64 elements
  readonly applied: boolean;
}

// ---------------------------------------------------------------------------
// Extended square mapping (1–32 dark, 33–64 light)
// ---------------------------------------------------------------------------

/**
 * Converts an 8×8 grid position to an extended square number (1–64).
 * Dark squares map to 1–32 (standard), light squares map to 33–64.
 */
export function gridToExtSquare(row: number, col: number): number {
  const darkSq = gridToSquare(row, col);
  if (darkSq !== null) return darkSq as number;
  // Light square: compute index among light squares
  // Even rows: light squares at cols 0, 2, 4, 6
  // Odd rows: light squares at cols 1, 3, 5, 7
  const posInRow = row % 2 === 0 ? col / 2 : (col - 1) / 2;
  return 32 + row * 4 + posInRow + 1;
}

/**
 * Converts an extended square number (1–64) to an 8×8 grid position.
 */
export function extSquareToGrid(sq: number): { row: number; col: number } {
  if (sq <= 32) return squareToGrid(sq as Square);
  const lightIndex = sq - 33;
  const row = Math.floor(lightIndex / 4);
  const posInRow = lightIndex % 4;
  const col = row % 2 === 0 ? posInRow * 2 : posInRow * 2 + 1;
  return { row, col };
}

// ---------------------------------------------------------------------------
// Orthogonal direction definitions
// ---------------------------------------------------------------------------

interface OrthoDelta {
  readonly dRow: number;
  readonly dCol: number;
}

const ORTHO_UP: OrthoDelta = { dRow: -1, dCol: 0 };
const ORTHO_DOWN: OrthoDelta = { dRow: 1, dCol: 0 };
const ORTHO_LEFT: OrthoDelta = { dRow: 0, dCol: -1 };
const ORTHO_RIGHT: OrthoDelta = { dRow: 0, dCol: 1 };

const ALL_ORTHO: readonly OrthoDelta[] = [ORTHO_UP, ORTHO_DOWN, ORTHO_LEFT, ORTHO_RIGHT];

/** Simple-move directions. Pawns: forward + sideways. Kings: all 4. */
function getOrthoSimpleDirs(piece: SerializedPiece): readonly OrthoDelta[] {
  if (piece.type === PieceType.King) return ALL_ORTHO;
  if (piece.color === PieceColor.White) {
    return [ORTHO_UP, ORTHO_LEFT, ORTHO_RIGHT];
  }
  return [ORTHO_DOWN, ORTHO_LEFT, ORTHO_RIGHT];
}

/** Capture directions. Pawns: forward + sideways. Kings: all 4. */
function getOrthoCaptureDirs(piece: SerializedPiece, stepBackActive: boolean): readonly OrthoDelta[] {
  if (piece.type === PieceType.King) return ALL_ORTHO;
  if (piece.color === PieceColor.White) {
    const dirs: OrthoDelta[] = [ORTHO_UP, ORTHO_LEFT, ORTHO_RIGHT];
    if (stepBackActive) dirs.push(ORTHO_DOWN);
    return dirs;
  }
  const dirs: OrthoDelta[] = [ORTHO_DOWN, ORTHO_LEFT, ORTHO_RIGHT];
  if (stepBackActive) dirs.push(ORTHO_UP);
  return dirs;
}

// ---------------------------------------------------------------------------
// Orthogonal jump chain generator (64-square grid)
// ---------------------------------------------------------------------------

function getOrthoJumpsForPiece(
  grid: readonly (SerializedPiece | null)[],
  startSq: number,
  startRow: number,
  startCol: number,
  piece: SerializedPiece,
  jumpDirs: readonly OrthoDelta[],
  flippedActive: boolean,
): Move[] {
  const chains: Move[] = [];

  function shouldPromoteOrtho(p: SerializedPiece, row: number): boolean {
    if (p.type === PieceType.King) return false;
    if (flippedActive) {
      return p.color === PieceColor.White ? row === 7 : row === 0;
    }
    return p.color === PieceColor.White ? row === 0 : row === 7;
  }

  function explore(
    row: number,
    col: number,
    path: number[],
    captured: number[],
    capturedSet: Set<number>,
  ): void {
    // Promotion stop
    if (piece.type === PieceType.Pawn && path.length > 0 && shouldPromoteOrtho(piece, row)) {
      chains.push({
        from: startSq as Square,
        path: [...path] as Square[],
        captured: [...captured] as Square[],
      });
      return;
    }

    let foundContinuation = false;

    for (const dir of jumpDirs) {
      const adjRow = row + dir.dRow;
      const adjCol = col + dir.dCol;
      if (adjRow < 0 || adjRow > 7 || adjCol < 0 || adjCol > 7) continue;

      const adjIdx = adjRow * 8 + adjCol;
      if (capturedSet.has(adjIdx)) continue;

      const adjPiece = grid[adjIdx];
      if (adjPiece === null || adjPiece === undefined || adjPiece.color === piece.color) continue;

      const landRow = adjRow + dir.dRow;
      const landCol = adjCol + dir.dCol;
      if (landRow < 0 || landRow > 7 || landCol < 0 || landCol > 7) continue;

      const landIdx = landRow * 8 + landCol;
      const landPiece = grid[landIdx];
      if (landPiece !== null && landPiece !== undefined && landIdx !== startRow * 8 + startCol) continue;

      const landSq = gridToExtSquare(landRow, landCol);
      const capSq = gridToExtSquare(adjRow, adjCol);

      foundContinuation = true;
      const newCapturedSet = new Set(capturedSet);
      newCapturedSet.add(adjIdx);

      explore(landRow, landCol, [...path, landSq], [...captured, capSq], newCapturedSet);
    }

    if (!foundContinuation && path.length > 0) {
      chains.push({
        from: startSq as Square,
        path: [...path] as Square[],
        captured: [...captured] as Square[],
      });
    }
  }

  explore(startRow, startCol, [], [], new Set());
  return chains;
}

// ---------------------------------------------------------------------------
// Orthogonal Leapfrog jump chain generator (64-square grid)
// ---------------------------------------------------------------------------

/**
 * Generates orthogonal jump chains that include friendly-piece leapfrogs
 * (non-capturing) and enemy captures, mixable in the same chain.
 * Used when both Marching Orders and Leapfrog are active.
 */
function getOrthoLeapfrogJumps(
  grid: readonly (SerializedPiece | null)[],
  startSq: number,
  startRow: number,
  startCol: number,
  piece: SerializedPiece,
  jumpDirs: readonly OrthoDelta[],
  flippedActive: boolean,
): Move[] {
  const chains: Move[] = [];

  function shouldPromoteOrtho(p: SerializedPiece, row: number): boolean {
    if (p.type === PieceType.King) return false;
    if (flippedActive) {
      return p.color === PieceColor.White ? row === 7 : row === 0;
    }
    return p.color === PieceColor.White ? row === 0 : row === 7;
  }

  function explore(
    row: number,
    col: number,
    path: number[],
    captured: number[],
    visitedSet: Set<number>,
    boardState: readonly (SerializedPiece | null)[],
  ): void {
    if (piece.type === PieceType.Pawn && path.length > 0 && shouldPromoteOrtho(piece, row)) {
      chains.push({ from: startSq as Square, path: [...path] as Square[], captured: [...captured] as Square[] });
      return;
    }

    let foundContinuation = false;

    for (const dir of jumpDirs) {
      const adjRow = row + dir.dRow;
      const adjCol = col + dir.dCol;
      if (adjRow < 0 || adjRow > 7 || adjCol < 0 || adjCol > 7) continue;

      const adjIdx = adjRow * 8 + adjCol;
      if (visitedSet.has(adjIdx)) continue;

      const adjPiece = boardState[adjIdx];
      if (adjPiece === null || adjPiece === undefined) continue;

      const landRow = adjRow + dir.dRow;
      const landCol = adjCol + dir.dCol;
      if (landRow < 0 || landRow > 7 || landCol < 0 || landCol > 7) continue;

      const landIdx = landRow * 8 + landCol;
      const landPiece = boardState[landIdx];
      if (landPiece !== null && landPiece !== undefined && landIdx !== startRow * 8 + startCol) continue;

      const landSq = gridToExtSquare(landRow, landCol);
      const newVisited = new Set(visitedSet);
      newVisited.add(adjIdx);

      if (adjPiece.color !== piece.color) {
        // Enemy capture
        const capSq = gridToExtSquare(adjRow, adjCol);
        const newBoard = [...boardState] as (SerializedPiece | null)[];
        newBoard[adjIdx] = null;
        foundContinuation = true;
        explore(landRow, landCol, [...path, landSq], [...captured, capSq], newVisited, newBoard);
      } else {
        // Friendly leapfrog — non-capturing, don't remove the friendly piece
        foundContinuation = true;
        explore(landRow, landCol, [...path, landSq], captured, newVisited, boardState);
      }
    }

    if (!foundContinuation && path.length > 0) {
      chains.push({ from: startSq as Square, path: [...path] as Square[], captured: [...captured] as Square[] });
    }
  }

  explore(startRow, startCol, [], [], new Set(), grid);
  return chains;
}

// ---------------------------------------------------------------------------
// Orthogonal Rush Hour double-step generator (64-square grid)
// ---------------------------------------------------------------------------

/**
 * Generates orthogonal double-step moves for pawns on the 64-square grid.
 * Pawns move two squares forward orthogonally (up for White, down for Black)
 * with the intermediate square also empty. Non-capturing only.
 */
function getOrthoDoubleSteps(
  grid: readonly (SerializedPiece | null)[],
  activeColor: PieceColor,
): Move[] {
  const moves: Move[] = [];
  const forwardDelta: OrthoDelta = activeColor === PieceColor.White ? ORTHO_UP : ORTHO_DOWN;

  for (let i = 0; i < 64; i++) {
    const piece = grid[i];
    if (piece === null || piece === undefined || piece.color !== activeColor) continue;
    if (piece.type !== PieceType.Pawn) continue;

    const row = Math.floor(i / 8);
    const col = i % 8;

    // First step forward
    const midRow = row + forwardDelta.dRow;
    const midCol = col + forwardDelta.dCol;
    if (midRow < 0 || midRow > 7 || midCol < 0 || midCol > 7) continue;
    const midIdx = midRow * 8 + midCol;
    if (grid[midIdx] !== null && grid[midIdx] !== undefined) continue;

    // Second step forward
    const destRow = midRow + forwardDelta.dRow;
    const destCol = midCol + forwardDelta.dCol;
    if (destRow < 0 || destRow > 7 || destCol < 0 || destCol > 7) continue;
    const destIdx = destRow * 8 + destCol;
    if (grid[destIdx] !== null && grid[destIdx] !== undefined) continue;

    const fromSq = gridToExtSquare(row, col);
    const destSq = gridToExtSquare(destRow, destCol);
    moves.push({ from: fromSq as Square, path: [destSq as Square], captured: [] });
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Grid ↔ Board projection
// ---------------------------------------------------------------------------

/**
 * Projects a 64-element orthogonal grid to a 32-element BoardState.
 * Only dark-square positions are represented in BoardState.
 */
export function projectGridToBoard(grid: readonly (SerializedPiece | null)[]): BoardState {
  const board: SquareState[] = new Array<SquareState>(BOARD_SIZE).fill(null);
  for (let sq = 1; sq <= 32; sq++) {
    const { row, col } = squareToGrid(sq as Square);
    const gridPiece = grid[row * 8 + col];
    board[sq - 1] = gridPiece
      ? { color: gridPiece.color, type: gridPiece.type }
      : null;
  }
  return board;
}

// ---------------------------------------------------------------------------
// Decorator
// ---------------------------------------------------------------------------

export class MarchingOrdersDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.MarchingOrders;
  }

  withInner(inner: RuleSet): MarchingOrdersDecorator {
    return new MarchingOrdersDecorator(inner);
  }

  /**
   * Synchronizes the 64-square MO grid with the current 32-square BoardState.
   *
   * When instant events (ChecksMix, Stampede, SwapMeet, Reinforcements) shuffle
   * the board via onTurnStart, the MO grid metadata becomes stale because those
   * events modify only the 32-square BoardState without knowledge of the MO grid.
   *
   * This method detects discrepancies between the grid's dark-square projection
   * and the actual BoardState, and rebuilds the grid by:
   * - Replacing all dark-square entries with the current BoardState contents.
   * - Keeping all light-square pieces from the existing grid unchanged.
   *
   * If a sync is needed, a metadata update is requested so the corrected grid
   * is persisted in the ActiveEvent for subsequent operations.
   */
  syncGridFromBoard(board: BoardState, metadata: MarchingOrdersMetadata): MarchingOrdersMetadata {
    const grid = metadata.orthogonalGrid;

    // Check if dark-square entries in the grid match the BoardState
    let needsSync = false;
    for (let sq = 1; sq <= 32; sq++) {
      const { row, col } = squareToGrid(sq as Square);
      const gridPiece = grid[row * 8 + col];
      const boardPiece = board[sq - 1];

      if (boardPiece === null || boardPiece === undefined) {
        if (gridPiece !== null && gridPiece !== undefined) {
          needsSync = true;
          break;
        }
      } else {
        if (
          gridPiece === null ||
          gridPiece === undefined ||
          gridPiece.color !== boardPiece.color ||
          gridPiece.type !== boardPiece.type
        ) {
          needsSync = true;
          break;
        }
      }
    }

    if (!needsSync) return metadata;

    // Rebuild grid: keep light-square pieces, replace dark-square entries
    const newGrid = [...grid] as (SerializedPiece | null)[];
    for (let sq = 1; sq <= 32; sq++) {
      const { row, col } = squareToGrid(sq as Square);
      const boardPiece = board[sq - 1];
      newGrid[row * 8 + col] = boardPiece
        ? { color: boardPiece.color, type: boardPiece.type }
        : null;
    }

    const synced: MarchingOrdersMetadata = {
      orthogonalGrid: newGrid,
      applied: metadata.applied,
    };

    // Persist the corrected grid
    this.requestMetadataUpdate(CrazyEvent.MarchingOrders, synced as unknown as Readonly<Record<string, unknown>>);

    return synced;
  }

  override getLegalMoves(board: BoardState, activeColor: PieceColor): Move[] {
    if (!this.isActive(this.activeEventsContext)) {
      return this.inner.getLegalMoves(board, activeColor);
    }

    let metadata = this.getMarchingOrdersMetadata();
    if (!metadata) return this.inner.getLegalMoves(board, activeColor);

    // Sync grid with board in case instant events shuffled the board
    metadata = this.syncGridFromBoard(board, metadata);

    const grid = metadata.orthogonalGrid;
    const stepBackActive = this.activeEventsContext.some(e => e.type === CrazyEvent.StepBack);
    const flippedActive = this.activeEventsContext.some(e => e.type === CrazyEvent.FlippedScript);
    const leapfrogActive = this.activeEventsContext.some(e => e.type === CrazyEvent.Leapfrog);
    const rushHourActive = this.activeEventsContext.some(e => e.type === CrazyEvent.RushHour);

    const allMoves: Move[] = [];

    for (let i = 0; i < 64; i++) {
      const piece = grid[i];
      if (piece === null || piece === undefined || piece.color !== activeColor) continue;

      const row = Math.floor(i / 8);
      const col = i % 8;
      const sq = gridToExtSquare(row, col);

      // Generate simple moves
      const simpleDirs = getOrthoSimpleDirs(piece);
      for (const dir of simpleDirs) {
        const nr = row + dir.dRow;
        const nc = col + dir.dCol;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
        const destIdx = nr * 8 + nc;
        if (grid[destIdx] !== null && grid[destIdx] !== undefined) continue;
        const destSq = gridToExtSquare(nr, nc);
        allMoves.push({ from: sq as Square, path: [destSq as Square], captured: [] });
      }

      // Generate jump chains — use leapfrog variant when active
      const jumpDirs = getOrthoCaptureDirs(piece, stepBackActive);
      if (leapfrogActive) {
        const leapfrogChains = getOrthoLeapfrogJumps(grid, sq, row, col, piece, jumpDirs, flippedActive);
        allMoves.push(...leapfrogChains);
      } else {
        const jumps = getOrthoJumpsForPiece(grid, sq, row, col, piece, jumpDirs, flippedActive);
        allMoves.push(...jumps);
      }
    }

    // Rush Hour: add orthogonal double-step moves for pawns
    if (rushHourActive) {
      allMoves.push(...getOrthoDoubleSteps(grid, activeColor));
    }

    // Mandatory capture
    const jumps = allMoves.filter(m => m.captured.length > 0);
    if (jumps.length > 0) return jumps;
    return allMoves.filter(m => m.captured.length === 0);
  }

  override applyMove(board: BoardState, move: Move): BoardState {
    if (!this.isActive(this.activeEventsContext)) {
      return this.inner.applyMove(board, move);
    }

    let metadata = this.getMarchingOrdersMetadata();
    if (!metadata) return this.inner.applyMove(board, move);

    // Sync grid with board in case instant events shuffled the board
    metadata = this.syncGridFromBoard(board, metadata);

    const grid = [...metadata.orthogonalGrid] as (SerializedPiece | null)[];
    const fromGrid = extSquareToGrid(move.from as number);
    const piece = grid[fromGrid.row * 8 + fromGrid.col];

    // Clear origin
    grid[fromGrid.row * 8 + fromGrid.col] = null;

    // Clear captured squares
    for (const cap of move.captured) {
      const capGrid = extSquareToGrid(cap as number);
      grid[capGrid.row * 8 + capGrid.col] = null;
    }

    // Place piece at destination
    const dest = move.path[move.path.length - 1] as number;
    const destGrid = extSquareToGrid(dest);
    let finalPiece = piece;

    // Check promotion
    if (finalPiece && this.shouldPromoteOrtho(finalPiece, destGrid.row)) {
      finalPiece = { color: finalPiece.color, type: PieceType.King };
    }

    grid[destGrid.row * 8 + destGrid.col] = finalPiece ?? null;

    // Update metadata
    this.requestMetadataUpdate(CrazyEvent.MarchingOrders, {
      orthogonalGrid: grid,
      applied: true,
    });

    // Project grid back to 32-square BoardState
    return projectGridToBoard(grid);
  }

  override checkGameOver(board: BoardState, activeColor: PieceColor): GameResult | null {
    if (!this.isActive(this.activeEventsContext)) {
      return this.inner.checkGameOver(board, activeColor);
    }

    const legalMoves = this.getLegalMoves(board, activeColor);
    if (legalMoves.length > 0) return null;

    // Count pieces from the 64-square grid, not the 32-square projection
    const metadata = this.getMarchingOrdersMetadata();
    let pieceCount = 0;
    if (metadata) {
      for (const cell of metadata.orthogonalGrid) {
        if (cell !== null && cell.color === activeColor) {
          pieceCount++;
        }
      }
    }

    const reason = pieceCount === 0 ? GameEndReason.NoPiecesLeft : GameEndReason.NoLegalMoves;
    const type = activeColor === PieceColor.White ? GameResultType.BlackWin : GameResultType.WhiteWin;
    return { type, reason };
  }

  override shouldPromote(piece: Piece, sq: Square): boolean {
    if (!this.isActive(this.activeEventsContext)) {
      return this.inner.shouldPromote(piece, sq);
    }
    // For dark squares, use squareToGrid; for light squares, shouldn't reach here
    // from base applyMove. Marching Orders handles promotion in its own applyMove.
    if (piece.type === PieceType.King) return false;
    const { row } = squareToGrid(sq);
    return this.shouldPromoteOrtho(piece, row);
  }

  private shouldPromoteOrtho(piece: SerializedPiece, row: number): boolean {
    if (piece.type === PieceType.King) return false;
    const flippedActive = this.activeEventsContext.some(
      e => e.type === CrazyEvent.FlippedScript,
    );
    if (flippedActive) {
      return piece.color === PieceColor.White ? row === 7 : row === 0;
    }
    return piece.color === PieceColor.White ? row === 0 : row === 7;
  }

  private getMarchingOrdersMetadata(): MarchingOrdersMetadata | undefined {
    for (let i = this.activeEventsContext.length - 1; i >= 0; i--) {
      const event = this.activeEventsContext[i];
      if (event?.type === CrazyEvent.MarchingOrders && event.metadata) {
        return event.metadata as unknown as MarchingOrdersMetadata;
      }
    }
    return undefined;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.MarchingOrders,
  (base: RuleSet) => new MarchingOrdersDecorator(base),
);

// Register metadata factory: initialize 64-element grid from current board
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.MarchingOrders,
  (board: BoardState) => {
    const grid: (SerializedPiece | null)[] = new Array<SerializedPiece | null>(64).fill(null);
    for (let sq = 1; sq <= 32; sq++) {
      const piece = board[sq - 1];
      if (piece !== null && piece !== undefined) {
        const { row, col } = squareToGrid(sq as Square);
        grid[row * 8 + col] = { color: piece.color, type: piece.type };
      }
    }
    return { orthogonalGrid: grid, applied: false };
  },
);
