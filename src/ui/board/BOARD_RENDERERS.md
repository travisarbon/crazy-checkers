# Board Renderers — Authoring Guide & Registry Contract

Task 27.3 of Phase 4 introduces a pluggable `BoardRendererRegistry` keyed by
`BoardGeometryKind`. Every Phase 4 geometry maps to exactly one canonical
renderer; tier tasks register specialised variants via the same registry API.

## Registry API

```typescript
import {
  registerBoardRenderer,
  getBoardRenderer,
  listRegisteredRenderers,
  BoardRendererMissingError,
} from '../ui/board';
```

Resolution order inside `getBoardRenderer(geometry)`:

1. First entry with matching `kind` and a `matchesGeometry(geometry)` that
   returns `true`. (Morabaraba claims the `ring` kind when
   `dimensions.ring.hasCornerDiagonals === true`.)
2. Else, first entry with matching `kind` and no predicate.
3. Else, throw `BoardRendererMissingError`.

## Default registry (normative)

| `BoardGeometryKind` | Renderer | Serves |
|---|---|---|
| `square`            | `SquareBoardRenderer`       | Draughts 8/10/12, Go, Gomoku, Tak, Shogi 5/7/9, Konane, Hasami |
| `rectangle`         | `RectangleBoardRenderer`    | Fanorona 9×5, Xiangqi 9×10, Yoté 5×6 |
| `hex-rhombus`       | `HexBoardRenderer`          | Hex 11×11 |
| `hex-triangular`    | `HexBoardRenderer`          | Havannah 5/6/8 |
| `ring`              | `RingBoardRenderer`         | NMM (default), Morabaraba (predicate) |
| `cross`             | `CrossBoardRenderer`        | Fox and Geese |
| `arc-track`         | `ArcTrackBoardRenderer`     | Surakarta |
| `dot-grid`          | `DotBoardRenderer`          | Dots and Boxes |
| `mancala-pit`       | `MancalaPitBoardRenderer`   | Oware, Bao |
| `terrain-overlay`   | `TerrainOverlayDecorator`   | Hnefatafl, Tablut, Arimaa, Halma, Chinese Checkers |
| `irregular-registered` | (per expansion tier)     | Camelot, Trax |

## `BoardRendererProps` contract

Every renderer accepts the same shape:

```typescript
interface BoardRendererProps {
  geometry: BoardGeometry;
  state: ClassifiedGameState;
  selection: SelectionState;
  onNodeInteract?: (node: NodeId, kind: InteractionKind) => void;
  overlays?: ReactNode;
  theme: Theme;
  mode: 'interactive' | 'preview' | 'replay';
  size?: number;
  ariaLabel: string;
}
```

`mode` gates interactivity and animation:

- `interactive` — full pointer + keyboard handlers, roving tabindex active.
- `preview` — clamped to 200–280 px, no interaction layer, saturation 0.85.
- `replay` — interaction suppressed; last-move highlight sticky.

## Hit-testing model

Every renderer composes a `<PieceLayer>` with node positions and an
`<InteractionLayer>` with `HitTarget[]` rectangles. The interaction layer:

- Dispatches `click`, `alt-click`, `drag-*`, `hover-*`, `focus`,
  `keyboard-activate` via the single `onNodeInteract` callback.
- Maintains roving tabindex — one tabbable node at a time.
- Arrow keys walk neighbours via the renderer's `primaryDirection`:
  - `orthogonal` for square/rectangle/cross/ring/arc-track.
  - `hex` for hex-rhombus and hex-triangular.
  - `ring-around` for ring.
  - `pit-chain` for mancala.
  - `dot-edge` for dots-and-boxes.

## Preview-mode rules

`usePreviewMode(mode, size)` clamps size to [200, 280] and returns:

```typescript
{ size, interactive: false, animate: false, saturation: 0.85, tabbable: false }
```

The Classified gallery (Task 35) mounts many preview cards at once; each
renderer calls this hook to keep them cheap.

## Accessibility contract

- Every interactive node wears `aria-label` from
  `geometry.coordinateLabels.ariaOf(node)`.
- `<InteractionLayer>` exposes a `role="grid"` container with `role="gridcell"`
  children.
- `preview` renders a single `role="img"` wrapper — no tabindex on cells.

## Registering a new renderer (expansion tiers)

```typescript
import { registerBoardRenderer, asRendererKey } from '../ui/board';

registerBoardRenderer({
  key: asRendererKey('trax'),
  kind: 'irregular-registered',
  component: TraxBoardRenderer,
  supportsPreview: true,
  matchesGeometry: (g) => g.serializedKey === 'irregular-trax',
});
```

Tier modules call `registerBoardRenderer` at their tier's module load (per the
Task 27.4 tier loader) so renderers stay code-split.

## Migration from Phase 3

- `src/ui/Board.tsx` continues to render the draughts board directly (Phase 3
  shape). Phase 4 game screens import the registry and call
  `getBoardRenderer(geometry)`.
- `src/ui/CogitateBoard.tsx`, `BoardPreview.tsx`, `BoardPreviewLarge.tsx`
  migrate opportunistically; the renderer slot accepts a `mode` prop so
  preview and replay come for free.
- `ClassifiedGameState` (engine/classified/state.ts) is the generic state
  shape every renderer consumes; Task 27.4 extends it with rule-engine
  metadata.
