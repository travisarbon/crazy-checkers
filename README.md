# Crazy Checkers

A browser-based American Rules Checkers game with AI opponent, five visual themes,
full keyboard accessibility, and a modular architecture designed for expansion to
30+ board games across four development phases.

**Play now:** [https://travisarbon.github.io/crazy-checkers/](https://travisarbon.github.io/crazy-checkers/)

## Features (Phase 1)

- Classic American Rules Checkers (8x8 board, mandatory captures, multi-jumps, kinging)
- Local two-player pass-and-play mode
- AI opponent at two difficulty levels (Easy and Hard)
  - Minimax search with alpha-beta pruning, iterative deepening, and quiescence search
  - AI runs in a Web Worker to keep the UI responsive
- Five visual themes: Crazy (default), Cork, Current, Classic, and Contrast (high-visibility)
- Full keyboard navigation and screen-reader support (WCAG 2.1 AA)
- Responsive layout for desktop and mobile
- Persistent settings and in-progress game (survives browser close)
- Smooth move animations with configurable speed

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
├── ai/            # AI opponent (evaluator, minimax search, difficulty presets, Web Worker)
├── ui/            # React components (board, pieces, screens, dialogs, hooks)
├── themes/        # Five visual themes with CSS custom property mapping
├── persistence/   # Settings (localStorage) and game history (IndexedDB)
└── utils/         # Notation conversion, timer utility
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
| 2 | Crazy mode (random events on multi-jumps), 7 event types | Planned |
| 3 | Challenge (100 puzzles), Choice (8 event-based modes), progression, Cogitate, Career, Code | Planned |
| 4 | Classified (30 additional abstract strategy board games) | Planned |

## License

All rights reserved.
