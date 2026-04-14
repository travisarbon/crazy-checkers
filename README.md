# Crazy Checkers

A browser-based American Rules Checkers game with AI opponents, five visual themes,
full keyboard accessibility, a 40-event "Crazy Mode", puzzle challenges, post-game
analysis & training, a career-progression layer, and a modular architecture designed
for expansion to 30+ board games across four development phases.

**Play now:** [https://travisarbon.github.io/crazy-checkers/](https://travisarbon.github.io/crazy-checkers/)

## Game Modes

### Classic Mode

Standard American Rules Checkers (8x8 board, mandatory captures, multi-jumps, kinging). Play against a friend in pass-and-play or challenge the AI at Easy or Hard difficulty.

### Crazy Mode

American Rules Checkers with 40 random gameplay-altering events. When a player performs a multi-jump (2+ captures in a single turn), a random event is triggered from a tiered pool that temporarily modifies the rules. Tier 1 events are foundational (one-dimensional effects, short duration); Tier 2 events layer on movement, promotion, or capture side effects; Tier 3 events introduce board-wide transformations.

Examples include *King for a Day*, *Live Grenade*, *Opposite Day*, *Up in the Air*, *Ghost Walk*, *Wormhole*, *Chain Reaction*, *Shrinking Board*, *Haunted*, and *Double Trouble* (a meta-event that stacks two events at once). The active-events indicator shows which events are currently in effect and their remaining duration; the in-app Event Reference lists all 40 with full mechanics and stacking notes.

### Choice Mode

Curated "always-on" game variants where a single event is permanent for the whole game instead of appearing randomly. Forty Choice modes are defined, each with its own display name (e.g. *Revolution* for King for a Day, *Boom Box* for Live Grenade, *Phantom Zone* for Ghost Walk). All modes start locked and unlock in tiered groups of eight by advancing through the Career tracks described below.

### Chaos Mode

An amped-up Crazy Mode where the Double Trouble meta-event fires on *every* capture — not just multi-jumps — so every single jump triggers two simultaneous random events. Events stack rapidly, typically leaving 4–6 events active at once.

### Challenge Mode

A library of procedurally-generated checkers puzzles (see `scripts/generatePuzzles.ts`) organized by difficulty (Easy / Medium / Hard). Each puzzle gives you a position and asks for the best move or forced sequence. Solutions are validated by the engine; progress is persisted and feeds into Career unlocks.

### Cogitate

A post-game analysis and training suite with four tools:

- **Replay** — step through any completed game move-by-move with notation and metadata.
- **Analysis** — engine-annotated per-move evaluation, quality classification (best / good / inaccuracy / mistake / blunder), and principal-variation browsing.
- **Training** — the Analysis tool extracts positions where your move lost evaluation; Training lets you retry those positions interactively against the engine's recommended play.
- **Free Play** — a diagram / position editor for exploring positions, annotating squares, and staging custom puzzles.

### Code Mode

Unlock hidden modes and Classified-preview content via codes entered in Code Mode. Codes are also awarded for Career milestones.

### Classified (Phase 4)

Slot reserved for 30+ additional abstract-strategy board games in Phase 4. The Classified detail screen is live and previews upcoming titles.

## Career & Unlocks

The Career screen tracks progress across five unlock tracks, each of which opens a tier of eight Choice modes:

| Track | Unlocks Choice modes | Advances by |
|-------|----------------------|-------------|
| Puzzle Mastery | 1–8 | Completing Challenge puzzles |
| Chaos Veteran | 9–16 | Winning Crazy Mode games vs. Hard CPU |
| Rule Bender | 17–24 | Winning Choice Mode games vs. Hard CPU |
| Lifer | 25–32 | Reaching cross-mode career milestones |
| World Player | 33–40 | Winning Classified games vs. Hard CPU (Phase 4) |

Code Mode entries can also unlock hidden Choice modes and Classified previews. Unlock state is persisted in localStorage; detailed game history and challenge records are persisted in IndexedDB.

## Data Management

Configure → Data lets you export all persisted state as a versioned JSON envelope, re-import an envelope to restore, or reset everything with a guarded confirmation. The envelope covers settings, in-progress game, unlock state, code-unlock records, redemption history, IndexedDB game history (including Cogitate analyses and training positions stored on game records), and Challenge records. Envelopes carry the running app version to support future schema migration.

## Features

- Classic, Crazy, Choice, Chaos, Challenge, Cogitate, Code, and Classified (preview) modes
- AI opponent at two difficulty levels (Easy and Hard) — minimax + alpha-beta + iterative deepening + quiescence + event-aware evaluation, executed in a Web Worker
- Forty Crazy-mode events with unique announcements and overlays, plus a unified event-trigger SFX
- Five visual themes: Crazy (default), Cork, Current, Classic, and Contrast (high-visibility)
- Full keyboard navigation and screen-reader support (WCAG 2.1 AA)
- Drag-and-drop and click-to-move interactions on board and in Free Play
- Responsive layout for desktop and mobile
- Persistent settings, in-progress game, game history, Career progress, Challenge records, and Cogitate analyses
- Audio system with configurable sound effects, a unified event-trigger cue, and per-mode music mapping
- Game clock with time controls and per-game overrides
- Smooth move and event animations with configurable speed and reduced-motion respect
- Data export / import / reset across every persisted store

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript (strict mode) |
| Framework | React 19 with hooks |
| Board rendering | SVG components |
| State management | Zustand |
| AI execution | Web Worker via Comlink |
| Persistence | localStorage (settings, in-progress game, unlock state, code-unlock records), IndexedDB via idb (game history incl. Cogitate analyses, Challenge records) |
| Build tool | Vite |
| Testing | Vitest (unit), Playwright (e2e), axe-core (a11y) |
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
| `npm run test:perf` | Run performance benchmarks (AI response time, memory, render) |
| `npm run test:stress` | Run event system stress tests |
| `npm run test:ai` | Run AI validation test suite |
| `npm run validate:ai` | Run AI self-play validation |
| `npm run generate-puzzles` | Regenerate Challenge-Mode puzzle library |
| `npm run generate-puzzles:quick` | Fast subset puzzle generation for iteration |
| `npm run validate-puzzles` | Validate puzzle data integrity |

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
│   └── events/    # Event decorator implementations (40 events)
├── ai/            # AI opponent (evaluator, search, difficulty, event-aware weights)
│   └── validation/# Self-play validation and Crazy mode testing
├── cogitate/      # Cogitate analysis/training/replay/diagram engines and adapters
├── ui/            # React components (board, screens, dialogs, hooks)
│   └── cogitate/  # Cogitate-tool React components (Replay, Analysis, Training, Free Play)
├── audio/         # Audio system (AudioManager, packs, music mapping, event cues)
├── themes/        # Five visual themes with CSS custom property mapping
├── persistence/   # Settings, unlock state, game history (incl. Cogitate analyses), Challenge records
├── data/          # Puzzle data, event reference data, unlock codes
└── utils/         # Notation conversion, timer, performance benchmarks
```

## Architecture Notes

The codebase is designed for extensibility across four planned development phases:

- **Rule interface:** `src/engine/rules.ts` defines a `RuleSet` interface that the engine
  calls for move generation, move application, and game-over detection. American Rules is the
  first implementation. Crazy / Choice / Chaos modes plug in via the `CompositeEventRuleSet`
  decorator composition (`src/engine/compositeRuleSet.ts`) without modifying core engine code.
- **Immutable game state:** Each move produces a new `GameState` object. This enables trivial
  undo/redo, efficient AI search branching, complete move history for replay, and Cogitate
  post-game analysis over snapshots.
- **Web Worker AI:** AI computation runs off the main thread. The `Comlink` library provides
  ergonomic async function calls. Cogitate Analysis reuses the same worker infrastructure.
- **Theme system:** Themes map semantic names to CSS custom properties. New themes can be added
  by creating a theme definition file -- no code changes required elsewhere.
- **Cogitate adapter layer:** Each game mode registers a `CogitateGameAdapter` that knows how
  to rebuild game state from a persisted record and walk it for analysis / training / replay.
  Phase 4 variant games will plug in via the same interface.

## Phase Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Core engine, Classic mode, AI, UI, accessibility | Complete |
| 2 | Crazy mode (7 events), event-aware AI, audio, game clock | Complete |
| 3 | 33 additional events (40 total), Choice / Chaos / Challenge / Cogitate / Career / Code / Free Play / Data Management | Complete |
| 4 | Classified (30 additional abstract strategy board games) | Planned |

## License

All rights reserved.
