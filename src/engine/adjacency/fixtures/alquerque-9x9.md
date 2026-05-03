# Alquerque 9×9 — Reference Adjacency Fixture (Task 29.3)

This file is the canonical hand-verified reference for the alquerque
adjacency graph used by `AlquerqueAdjacency.ts`. It pins per-node neighbor
sets that the unit suite asserts directly.

## Topology summary

- **81 intersection nodes**, NodeId = `r * 9 + c` for `r, c ∈ [0, 9)`.
- **Orthogonal lines** connect every in-bounds neighbor in the same row or
  column. Always present.
- **Diagonal lines** follow the alternating pattern: a node `(r, c)` has
  diagonal lines iff `(r + c) % 2 === 0`. Parity is preserved across diagonal
  moves, so a diagonal edge always connects two "has-diagonals" nodes.

## ASCII diagram

The 9×9 alquerque grid. `+` = node with diagonals (`(r+c) % 2 == 0`);
`o` = node without diagonals. Horizontal/vertical lines are orthogonal
connections (always present); slashes are diagonal connections (only at `+`
nodes).

```
+ o + o + o + o +     row 0  (NodeIds 0..8)
| X | X | X | X |
o + o + o + o + o     row 1  (NodeIds 9..17)
| X | X | X | X |
+ o + o + o + o +     row 2  (NodeIds 18..26)
| X | X | X | X |
o + o + o + o + o     row 3  (NodeIds 27..35)
| X | X | X | X |
+ o + o + + + o +     row 4  (NodeIds 36..44; center = 40 = +)
| X | X | X | X |
o + o + o + o + o     row 5  (NodeIds 45..53)
| X | X | X | X |
+ o + o + o + o +     row 6  (NodeIds 54..62)
| X | X | X | X |
o + o + o + o + o     row 7  (NodeIds 63..71)
| X | X | X | X |
+ o + o + o + o +     row 8  (NodeIds 72..80)
```

(`X` between two `+` nodes denotes both diagonals are present in that cell.)

## Reference neighbor sets

| NodeId | (r, c)  | Has diagonals | Orthogonal              | Diagonal           |
|--------|---------|---------------|-------------------------|--------------------|
| 0      | (0, 0)  | yes           | [1, 9]                  | [10]               |
| 1      | (0, 1)  | no            | [0, 2, 10]              | []                 |
| 4      | (0, 4)  | yes           | [3, 5, 13]              | [12, 14]           |
| 8      | (0, 8)  | yes           | [7, 17]                 | [16]               |
| 9      | (1, 0)  | no            | [0, 18, 10]             | []                 |
| 10     | (1, 1)  | yes           | [1, 19, 9, 11]          | [0, 2, 18, 20]     |
| 17     | (1, 8)  | no            | [8, 26, 16]             | []                 |
| 21     | (2, 3)  | no            | [12, 30, 20, 22]        | []                 |
| 22     | (2, 4)  | yes           | [13, 31, 21, 23]        | [12, 14, 30, 32]   |
| 36     | (4, 0)  | yes           | [27, 45, 37]            | [28, 46]           |
| 40     | (4, 4)  | yes           | [31, 49, 39, 41]        | [30, 32, 48, 50]   |
| 44     | (4, 8)  | yes           | [35, 53, 43]            | [34, 52]           |
| 72     | (8, 0)  | yes           | [63, 73]                | [64]               |
| 76     | (8, 4)  | yes           | [67, 75, 77]            | [66, 68]           |
| 80     | (8, 8)  | yes           | [71, 79]                | [70]               |

This table is the source of truth for `AlquerqueAdjacency.test.ts`. Adding
or modifying entries requires re-deriving the predicate by hand and pinning
the result here first; the test mirrors the table verbatim.
