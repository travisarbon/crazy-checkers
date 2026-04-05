# Crazy Checkers

A browser-based American Rules Checkers game with AI opponent, five visual themes,
full keyboard accessibility, and a modular architecture designed for expansion to
30+ board games across four development phases.

**Play now:** [https://travisarbon.github.io/crazy-checkers/](https://travisarbon.github.io/crazy-checkers/)

## Game Modes

### Classic Mode

Standard American Rules Checkers (8x8 board, mandatory captures, multi-jumps, kinging). Play against a friend in pass-and-play or challenge the AI at Easy or Hard difficulty.

### Crazy Mode (Phase 2)

American Rules Checkers with random events. When a player performs a multi-jump (2+ captures in a single turn), a random event is triggered that temporarily modifies the rules.

**Events:**

| Event | Effect | Duration |
|-------|--------|----------|
| King for a Day | All pawns temporarily become kings | 1 round (2 plies) |
| Live Grenade | Next capture causes an explosion, destroying adjacent pieces | Until next capture |
| Hot Potato | The piece you move switches to your opponent's color | 1 round (2 plies) |
| Checks Mix | All pieces are randomly redistributed across the board | Instant |
| Opposite Day | Win condition is inverted (lose all pieces = win) | 8 rounds (16 plies) |
| Up in the Air | All pieces gain flying movement (move any distance diagonally) | 1 round (2 plies) |
| No Touching! | Pawns cannot capture kings | 1 round (2 plies) |

The active events indicator shows which events are currently in effect and their remaining duration.

## Features

- Classic and Crazy game modes with local two-player and AI opponent
- AI opponent at two difficulty levels (Easy and Hard)
  - Minimax search with alpha-beta pruning, iterative deepening, and quiescence search
  - Event-aware evaluation with per-event weight adjustments
  - AI runs in a Web Worker to keep the UI responsive
- Seven Crazy mode events with unique animations and visual indicators
- Event announcement overlays with auto-dismiss
- Five visual themes: Crazy (default), Cork, Current, Classic, and Contrast (high-visibility)
- Full keyboard navigation and screen-reader support (WCAG 2.1 AA)
- Responsive layout for desktop and mobile
- Persistent settings, in-progress game, and game history
- Audio system with configurable sound effects and music
- Game clock with time controls and per-game overrides
- Smooth move and event animations with configurable speed

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Framework | React 19 with hooks |
| Board rendering | SVG components |
| State management | Zustand |
| AI execution | Web Worker via Comlink |
| Persistence | localStorage (settings, in-progress game), IndexedDB via idb (game history) |
| Build tool | Vite |
| Testing | Vitest (unit), Playwright (e2e) |
| CI/CD | GitHub Actions -> GitHub Pages |

## Local Development

### Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm 9+

### Setup

```bash
git clone https://github.com/travisarbon/crazy-checkers.git
cd crazy-checkers
npm install
npm run dev
```

The dev server starts at `http://localhost:5173/crazy-checkers/`.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:coverage` | Run unit tests with v8 coverage report |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run lint` | Lint with ESLint (zero warnings allowed) |
| `npm run typecheck` | Type-check without emitting |
| `npm run format` | Format code with Prettier |
| `npm run validate:ai` | Run AI self-play validation |
| `npm run test:perf` | Run performance benchmarks (AI response time, memory) |
| `npm run test:stress` | Run event system stress tests |
| `npm run test:ai` | Run AI validation test suite |

### Build and Deploy

Production builds are automatic. Every push to `main` triggers:
1. **CI workflow** -- lint, type-check, test, build (must all pass).
2. **Deploy workflow** -- builds and publishes to the `gh-pages` branch.

The live site updates within a few minutes of a successful push.

To build locally:

```bash
npm run build    # Output in ./dist
npm run preview  # Serve locally at http://localhost:4173/crazy-checkers/
```

## Project Structure

```
src/
├── engine/        # Game engine (board, moves, rules, game state, Zobrist hashing)
│   └── events/    # Event decorator implementations (7 Phase 2 events)
├── ai/            # AI opponent (evaluator, search, difficulty, event-aware weights)
│   └── validation/# Self-play validation and Crazy mode testing
├── ui/            # React components (board, pieces, screens, dialogs, hooks)
│   └── dialogs/   # Game setup, game over, resume, confirm dialogs
├── audio/         # Audio system (AudioManager, packs, music mapping)
├── themes/        # Five visual themes with CSS custom property mapping
├── persistence/   # Settings (localStorage) and game history (IndexedDB)
└── utils/         # Notation conversion, timer, performance benchmarks
```

## Architecture Notes

The codebase is designed for extensibility across four planned development phases:

- **Rule interface:** `src/engine/rules.ts` defines a `RuleSet` interface that the engine
  calls for move generation, move application, and game-over detection. American Rules is the
  first implementation. Phase 2 event modifiers and Phase 4 variant games will plug into this
  interface without modifying core engine code.
- **Immutable game state:** Each move produces a new `GameState` object. This enables trivial
  undo/redo, efficient AI search branching, and complete move history for future replay features.
- **Web Worker AI:** AI computation runs off the main thread. The `Comlink` library provides
  ergonomic async function calls. Games with different evaluation needs can swap in specialized
  evaluators without changing the integration surface.
- **Theme system:** Themes map semantic names to CSS custom properties. New themes can be added
  by creating a theme definition file -- no code changes required elsewhere.

## Phase Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Core engine, Classic mode, AI, UI, accessibility | Complete |
| 2 | Crazy mode (7 random events), event-aware AI, audio, game clock | Complete |
| 3 | Challenge (100 puzzles), Choice (8 event-based modes), progression, Cogitate, Career, Code | Planned |
| 4 | Classified (30 additional abstract strategy board games) | Planned |

## License

All rights reserved.
