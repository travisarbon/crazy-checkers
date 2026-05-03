# BoardGeometry — Authoring Rules & Stable Key Registry

Task 27.2 promotes `BoardGeometry` into a first-class engine-layer descriptor
module used by Phase 4 renderers, rule engines, notation adapters, AI search,
Cogitate, serializers, and persistence.

## Geometry kind union (normative)

| `BoardGeometryKind`     | Indexing                                 | Example games                                                   |
|-------------------------|------------------------------------------|-----------------------------------------------------------------|
| `square`                | `squares` or `intersections`             | Draughts (dark-mask), Go, Gomoku, Tak, Shogi                    |
| `rectangle`             | `squares`, `intersections`, or `pits`    | Fanorona 9×5, Xiangqi 9×10, Oware 2×6                           |
| `hex-rhombus`           | `intersections` (axial q,r)              | Hex 11×11                                                       |
| `hex-triangular`        | `intersections` (axial)                  | Havannah size 5/6/8                                             |
| `ring`                  | `points`                                 | Nine Men's Morris, Morabaraba                                   |
| `cross`                 | `points`                                 | Fox and Geese                                                   |
| `arc-track`             | `squares` + arc nodes                    | Surakarta                                                       |
| `dot-grid`              | `dots` + derived edges/boxes             | Dots and Boxes                                                  |
| `mancala-pit`           | `pits` with sowing order                 | Oware, Bao                                                      |
| `terrain-overlay`       | decorator over a base geometry           | Arimaa traps, Halma camps                                        |
| `alquerque`             | `intersections` with alternating-diagonal lines | Zamma 9×9, Bagh-Chal 5×5 (Tier 9 expansion)                  |
| `irregular-registered`  | bespoke adjacency registered by a caller | Camelot, Trax (Phase 4 expansion)                                |

## Stable serialized-key conventions

Persistence (Task 27.6) keys off `BoardGeometry.serializedKey`. Renaming a
shipped key is a breaking change — use the schema-migration hook instead.

| Factory                               | Key                                                |
|---------------------------------------|----------------------------------------------------|
| `squareGeometry({ size, indexing, playableMask? })` | `square-{size}x{size}[-inter][-dark]`              |
| `rectangleGeometry({ width, height, indexing })`    | `rectangle-{w}x{h}-{indexing}`                     |
| `hexRhombusGeometry(size)`            | `hex-rhombus-{size}`                               |
| `hexTriangularGeometry(size)`         | `hex-triangular-{size}`                            |
| `ringGeometry('nmm' \| 'morabaraba')` | `ring-nmm` / `ring-morabaraba`                     |
| `crossGeometry('fox-and-geese')`      | `cross-fox-and-geese`                              |
| `arcTrackGeometry('surakarta')`       | `arc-track-surakarta`                              |
| `dotGridGeometry({ boxesAcross, boxesDown })`       | `dot-grid-{a}x{d}`                                 |
| `mancalaPitGeometry('oware-2x6' \| 'bao-4x8')`      | `mancala-oware-2x6` / `mancala-bao-4x8`            |
| `withTerrainOverlay(base, overlays, overlayKey)`    | `overlay-{baseKey}+{overlayKey}`                   |
| `alquerqueGeometry({ size, diagonalPattern? })`     | `alquerque-{size}x{size}[-full-diag]`              |
| `irregularGeometry({ serializedKey })`              | `irregular-{serializedKey}`                        |

## Authoring rules (expansion tiers)

1. **Add to the union.** Prefer reusing an existing kind via factory
   parameters over introducing a new `BoardGeometryKind`.
2. **Precompute adjacency.** Neighbor tables are built once at descriptor
   construction and returned as readonly arrays; the AI search hot path
   relies on O(1) neighbor lookups.
3. **Hand-verify ≥20 reference nodes** per new geometry: corners, edges,
   centers, and topological edge cases (arc entries, ring spoke endpoints,
   hex corners, dot-grid box corners).
4. **Coordinate labelers must round-trip.** For every node,
   `parseNotation(notationOf(n)) === n` and `parseNotation(displayOf(n)) === n`.
5. **ARIA clarity.** `ariaOf(n)` follows the pattern `"${family} ${alias}"`
   for screen-reader readability.
6. **No UI imports.** Descriptor implementations may not import React, CSS,
   or anything from `src/ui/`. A dependency-probe test enforces this.
7. **Serialized key is forever.** Never rename an already-shipped key.

## Compatibility shim

`boardGeometry.cogitateShim.ts` exports `toCogitateGeometry` and
`fromCogitateGeometry` for Phase 3 callers that still consume the legacy
`cogitate/types.ts` struct. Only `kind: 'square'` geometries project
losslessly onto the Cogitate struct; anything else throws
`NotCogitateCompatibleError`.

## Direction kinds

| Kind                  | Used by                                    |
|-----------------------|--------------------------------------------|
| `orthogonal`          | square, rectangle, cross, arc-track, dots  |
| `diagonal`            | square, rectangle, cross (Geese variant)   |
| `queen-line`          | square, rectangle (flying kings, chess)    |
| `hex`                 | hex-rhombus, hex-triangular                |
| `ring-around`         | ring                                        |
| `ring-spoke`          | ring                                        |
| `cross-arm`           | cross (arm centerline)                      |
| `arc-loop`            | arc-track                                   |
| `pit-chain`           | mancala-pit                                 |
| `dot-edge`            | dot-grid (dot → incident edges)             |
| `box-neighbor`        | dot-grid (box → bounding edges)             |
