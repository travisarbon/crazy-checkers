/**
 * Classic mode sub-menu screen.
 * Displays board preview, rules summary, game setup, and expanded detail.
 */

import { PieceColor, PieceType, GameMode } from '../engine/types';
import type { PlayerSetup, BoardState } from '../engine/types';
import type { TimeControlConfig } from '../engine/clock';
import ModeScreenShell from './ModeScreenShell';
import BoardPreviewLarge from './BoardPreviewLarge';
import ExpandableDetailPanel from './ExpandableDetailPanel';
import GameSetupSection from './GameSetupSection';
import shellStyles from './ModeScreenShell.module.css';
import styles from './ClassicScreen.module.css';

interface ClassicScreenProps {
  onBack: () => void;
  onStartGame: (players: PlayerSetup, flipped: boolean, mode: GameMode, timeControl: TimeControlConfig | null) => void;
  defaultTimeControl: TimeControlConfig | null;
  savedGameExists: boolean;
  onResumeSavedGame?: () => void;
}

// Piece diagram board positions (hand-crafted for illustration)
const W = PieceColor.White;
const B = PieceColor.Black;
const P = PieceType.Pawn;
const K = PieceType.King;

function diagramBoard(placements: Array<[number, PieceColor, PieceType]>): BoardState {
  const b: Array<{ color: PieceColor; type: PieceType } | null> = Array.from({ length: 32 }, () => null);
  for (const [sq, color, type] of placements) {
    b[sq - 1] = { color, type };
  }
  return b;
}

// Pawn movement: white pawn at sq 22, forward moves highlighted
const PAWN_MOVES_BOARD = diagramBoard([[22, W, P]]);
// King movement: white king at sq 18, all four diagonals highlighted
const KING_MOVES_BOARD = diagramBoard([[18, W, K]]);
// Multi-jump: white pawn jumping two black pawns
const MULTI_JUMP_BOARD = diagramBoard([[22, W, P], [18, B, P], [11, B, P]]);
// Kinging: white pawn about to reach back row
const KINGING_BOARD = diagramBoard([[5, W, P]]);

export default function ClassicScreen({
  onBack,
  onStartGame,
  defaultTimeControl,
  savedGameExists,
  onResumeSavedGame,
}: ClassicScreenProps) {
  return (
    <ModeScreenShell title="Classic" onBack={onBack} testId="classic-screen">
      {/* Hero row: board left, setup right on desktop */}
      <div className={shellStyles.heroRow}>
        <div className={shellStyles.heroBoard}>
          <div className={styles.boardSection}>
            <BoardPreviewLarge
              size={260}
              label="Standard 8 by 8 checkers starting position with 12 white pieces and 12 black pieces"
            />
            <p className={styles.boardCaption}>Standard 8&times;8 board &mdash; 12 pieces per side.</p>
          </div>
        </div>
        <div className={shellStyles.heroControls}>
          <GameSetupSection
            mode={GameMode.Classic}
            defaultTimeControl={defaultTimeControl}
            onStartGame={onStartGame}
            savedGameExists={savedGameExists}
            onResumeSavedGame={onResumeSavedGame}
          />
        </div>
      </div>

      {/* How to Play */}
      <div className={styles.section}>
        <p className={styles.howToPlay}>
          Pieces move diagonally forward one square. Captures are mandatory: jump over an
          adjacent opponent piece into an empty square beyond it. If you can continue capturing,
          you must. Reach the far row to become a king, which moves and captures in all four
          diagonal directions. Win by capturing all opponent pieces or leaving them with no legal moves.
        </p>
      </div>

      {/* Section 4: Expanded Detail Panel */}
      <ExpandableDetailPanel
        title="Learn More About Classic Checkers"
        summary="History, complete rules, strategy, and piece diagrams"
      >
        <h3 className={styles.subsectionTitle}>History</h3>
        <p className={styles.contentParagraph}>
          American Checkers, also known as English Draughts, is one of the world&rsquo;s oldest
          board games. Played on an 8&times;8 board with 12 pieces per side, the game has been
          enjoyed across cultures for centuries. Its simplicity makes it accessible to beginners,
          while its depth has challenged mathematicians and computer scientists alike.
        </p>
        <p className={styles.contentParagraph}>
          In 1952, Arthur Samuel created one of the first self-learning programs by teaching a
          computer to play checkers, a landmark achievement in artificial intelligence. In 2007,
          the Chinook project at the University of Alberta proved that checkers is a solved game
          &mdash; with perfect play from both sides, the result is always a draw.
        </p>

        <h3 className={styles.subsectionTitle}>Complete Rules</h3>
        <p className={styles.contentParagraph}>
          The game is played on the 32 dark squares of an 8&times;8 board. Each player starts with
          12 pieces (pawns) arranged on the three rows closest to them. White moves first. Pawns
          move one square diagonally forward toward the opponent&rsquo;s side.
        </p>
        <p className={styles.contentParagraph}>
          Captures are mandatory. To capture, jump diagonally over an adjacent opponent piece into
          an empty square beyond it. The captured piece is removed. If the landing square offers
          another capture, you must continue jumping (multi-jump). When a pawn reaches the far
          row, it is promoted to a king.
        </p>
        <p className={styles.contentParagraph}>
          Kings move and capture in all four diagonal directions. A player wins by capturing all
          opponent pieces or by blocking all their moves. The game is drawn if the same position
          occurs three times or if 40 consecutive moves pass without a capture or promotion.
        </p>

        <h3 className={styles.subsectionTitle}>Basic Strategy</h3>
        <p className={styles.contentParagraph}>
          Control the center of the board to maximize your pieces&rsquo; mobility. Keep your back
          row intact as long as possible &mdash; back-row pieces prevent your opponent from easily
          kinging. When ahead in material, trade pieces to simplify toward a winning endgame.
        </p>
        <p className={styles.contentParagraph}>
          Kings are powerful in endgames due to their ability to move in all directions. Aim to
          create kings while preventing your opponent from doing the same. Tempo (initiative) is
          crucial &mdash; the player who controls the pace of exchanges often has the advantage.
        </p>

        <h3 className={styles.subsectionTitle}>Piece Diagrams</h3>
        <div className={styles.diagramGrid}>
          <div className={styles.diagramItem}>
            <BoardPreviewLarge
              position={PAWN_MOVES_BOARD}
              size={120}
              highlightSquares={[18, 17]}
              label="Pawn movement: forward diagonal moves"
            />
            <span className={styles.diagramCaption}>Pawn moves forward diagonally</span>
          </div>
          <div className={styles.diagramItem}>
            <BoardPreviewLarge
              position={KING_MOVES_BOARD}
              size={120}
              highlightSquares={[15, 14, 22, 23]}
              label="King movement: all four diagonal directions"
            />
            <span className={styles.diagramCaption}>King moves in all directions</span>
          </div>
          <div className={styles.diagramItem}>
            <BoardPreviewLarge
              position={MULTI_JUMP_BOARD}
              size={120}
              highlightSquares={[15, 8]}
              label="Multi-jump chain: two captures in sequence"
            />
            <span className={styles.diagramCaption}>Multi-jump chain</span>
          </div>
          <div className={styles.diagramItem}>
            <BoardPreviewLarge
              position={KINGING_BOARD}
              size={120}
              highlightSquares={[1, 2]}
              label="Kinging: pawn reaching the back row for promotion"
            />
            <span className={styles.diagramCaption}>Pawn reaches back row</span>
          </div>
        </div>
      </ExpandableDetailPanel>
    </ModeScreenShell>
  );
}
