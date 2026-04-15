# src/ui/piece — Classified piece-rendering subsystem (Task 27.5)

This folder is the UI-layer substrate every Phase 4 Classified game plugs
its piece art into. Engine-layer `PieceDefinition` and `PieceVocabulary`
(Task 27.4, `src/engine/classified/pieceVocabulary.ts`) define identity;
`PieceVisualSpec` here adds the rendering-only companion.

## Registering a piece

1. Create a render function under `assets/{family}/{piece}.tsx` that returns
   an SVG fragment. Follow the draughts convention: `viewBox`
   `[-50, -50, 100, 100]`, disc radius 38, stroke-width 3.
2. Create a barrel `assets/{family}/index.ts` that builds `PieceVisualSpec`
   objects and registers them via `registerPieceVisual(spec)`.
3. Export a `register{Family}Pieces()` function from the barrel and add a
   call to it inside `assets/index.ts`'s `registerAllPieceFamilies()`.
4. The `pieceId` must match the engine-layer `PieceDefinition.pieceId` (or
   its `svgSymbolId` when present) exactly.

## Colour-policy matrix

| Policy         | Use for                                | Body fill         | Stroke           | Halo/selection |
|---------------|----------------------------------------|-------------------|------------------|----------------|
| `theme-driven` | Draughts, chess, tafl, cheskers        | theme tokens      | theme tokens     | theme tokens   |
| `absolute`     | Go/Gomoku stones, Shogi kanji glyphs   | hardcoded colour  | hardcoded colour | theme tokens   |
| `hybrid`       | Reversi-style two-tone pieces          | mixed (see spec)  | mixed            | theme tokens   |

Worked example: a Reversi disc whose rim always reads from the active theme
but whose face is tradition-locked:

```ts
colorPolicy: {
  kind: 'hybrid',
  themeParts: ['stroke'],
  absoluteParts: ['body'],
  light: '#FFFFFF',
  dark: '#000000',
}
```

## `__PIECE_STUB__` lifecycle

Scaffold families ship one placeholder entry per piece slot carrying
`__PIECE_STUB__: true`. When the owning tier task (Task 28–34) lands real
art, it re-registers the same `pieceId` with a non-stub spec — the idempotent
HMR path in `registerPieceVisual` tolerates bit-identical re-registration
but throws `PieceVisualCollisionError` on differing specs, so replacing a
stub requires also clearing its `__PIECE_STUB__` flag deliberately.

The production-build guard `scripts/check-piece-stubs.ts` fails the build
if any `pieceId` reachable from a registered Classified game still carries
`__PIECE_STUB__: true`.

## Hand / reserve rendering

`<HandReserve>` consumes `PieceVocabulary.inHand` directly plus two
`Record<pieceId, number>` count maps. Responsive collapse uses a
container query (`@container (max-width: 768px)`) so the reserve folds into
a single column inside any parent whose inline size drops below 768 px —
works even inside modals and nested layouts.

`onDropRequest(pieceId)` is a caller-wired event; legality is never
checked here. Wire the event to `ClassifiedRuleSet.applyMove` in the owning
tier task.

## `describePiece` extension guide

Default label:
`{Colour} {kind}{, promoted | , unpromoted}{ on {square} | in hand (×{n})}{ — selected, last moved, capturing}{, stack of {n}}`

Per-vocabulary overrides plug into `PieceVisualSpec.describe`.

## Migration for Phase 2/3 call-sites

The Phase 2/3 `src/ui/Piece.tsx` remains the source-of-truth renderer for
the shipped American Checkers game. Classified mode uses this subsystem via
`src/ui/board/PieceLayer.tsx`. New code should import from `src/ui/piece`.
