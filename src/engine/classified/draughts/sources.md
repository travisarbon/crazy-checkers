# Tier 1 Draughts — Rule Source Attestation

**Task 28.2.1 §5 deliverable.** Maps each corrected `DraughtsConfig` field
to the published source that authorises the value. `configSources.test.ts`
parses this file and asserts the runtime config factories agree with the
table below. A rule regression therefore surfaces as a test failure on the
same line a reviewer would consult.

**Last verified:** 2026-04-25 (Task 28.2.2 huffing/king corrections).

---

## Table

| Game | Rule | Value | Source | Accessed |
|---|---|---|---|---|
| russian-draughts | promotionBehavior | mid-capture | https://en.wikipedia.org/wiki/Russian_draughts | 2026-04-16 |
| russian-draughts | capturedPieceRemovalTiming | end-of-sequence | https://en.wikipedia.org/wiki/Russian_draughts | 2026-04-16 |
| russian-draughts | maximumCaptureMandatory | false | https://en.wikipedia.org/wiki/Russian_draughts | 2026-04-16 |
| russian-draughts | kingType | flying | https://en.wikipedia.org/wiki/Russian_draughts | 2026-04-16 |
| russian-draughts | menCanCaptureKings | true | https://en.wikipedia.org/wiki/Russian_draughts | 2026-04-16 |
| brazilian-draughts | promotionBehavior | end-of-turn | https://en.wikipedia.org/wiki/Brazilian_draughts | 2026-04-16 |
| brazilian-draughts | capturedPieceRemovalTiming | end-of-sequence | https://en.wikipedia.org/wiki/Brazilian_draughts | 2026-04-16 |
| brazilian-draughts | maximumCaptureMandatory | true | https://en.wikipedia.org/wiki/Brazilian_draughts | 2026-04-16 |
| brazilian-draughts | kingType | flying | https://en.wikipedia.org/wiki/Brazilian_draughts | 2026-04-16 |
| italian-draughts | promotionBehavior | standard | https://en.wikipedia.org/wiki/Italian_draughts | 2026-04-16 |
| italian-draughts | menCanCaptureKings | false | https://checkers.fandom.com/wiki/Italian_draughts | 2026-04-16 |
| italian-draughts | capturedPieceRemovalTiming | end-of-sequence | https://en.wikipedia.org/wiki/Italian_draughts | 2026-04-16 |
| italian-draughts | kingType | short | https://en.wikipedia.org/wiki/Italian_draughts | 2026-04-16 |
| italian-draughts | maximumCaptureMandatory | true | https://en.wikipedia.org/wiki/Italian_draughts | 2026-04-16 |
| international-checkers | promotionBehavior | end-of-turn | https://lidraughts.org/variant/international | 2026-04-16 |
| international-checkers | capturedPieceRemovalTiming | end-of-sequence | https://lidraughts.org/variant/international | 2026-04-16 |
| international-checkers | maximumCaptureMandatory | true | https://lidraughts.org/variant/international | 2026-04-16 |
| international-checkers | kingType | flying | https://lidraughts.org/variant/international | 2026-04-16 |
| frysk | promotionBehavior | end-of-turn | https://en.wikipedia.org/wiki/Frisian_draughts | 2026-04-16 |
| frysk | kingOrthogonalCaptureIsLimited | false | https://www.mindsports.nl/index.php/arena/frisian-draughts/718-frisian-draughts-rules | 2026-04-25 |
| frysk | kingConsecutiveMoveLimit | 3 | https://lidraughts.org/variant/frisian | 2026-04-25 |
| frysk | kingType | flying | https://www.frisiandraughts.com/spagina/104/7/rules.html | 2026-04-25 |
| frysk | piecesPerSide | 5 | https://en.wikipedia.org/wiki/Frisian_draughts | 2026-04-16 |
| frisian-draughts | promotionBehavior | end-of-turn | https://en.wikipedia.org/wiki/Frisian_draughts | 2026-04-16 |
| frisian-draughts | kingOrthogonalCaptureIsLimited | false | https://www.mindsports.nl/index.php/arena/frisian-draughts/718-frisian-draughts-rules | 2026-04-25 |
| frisian-draughts | kingConsecutiveMoveLimit | 3 | https://lidraughts.org/variant/frisian | 2026-04-25 |
| frisian-draughts | kingType | flying | https://www.frisiandraughts.com/spagina/104/7/rules.html | 2026-04-25 |
| frisian-draughts | maximumCaptureMandatory | true | https://www.mindsports.nl/index.php/arena/frisian-draughts/718-frisian-draughts-rules | 2026-04-25 |
| malaysian-checkers | promotionBehavior | end-of-turn | https://en.wikipedia.org/wiki/Malaysian/Singaporean_checkers | 2026-04-25 |
| malaysian-checkers | maximumCaptureMandatory | true | https://en.wikipedia.org/wiki/Malaysian/Singaporean_checkers | 2026-04-25 |
| malaysian-checkers | capturedPieceRemovalTiming | end-of-sequence | https://en.wikipedia.org/wiki/Malaysian/Singaporean_checkers | 2026-04-25 |
| malaysian-checkers | huffingMechanism | self-piece-forfeit | https://en.wikipedia.org/wiki/Malaysian/Singaporean_checkers | 2026-04-25 |
| malaysian-checkers | captureObligatory | false | https://en.wikipedia.org/wiki/Malaysian/Singaporean_checkers | 2026-04-25 |
| canadian-draughts | promotionBehavior | end-of-turn | https://en.wikipedia.org/wiki/Canadian_checkers | 2026-04-16 |
| canadian-draughts | capturedPieceRemovalTiming | end-of-sequence | https://en.wikipedia.org/wiki/Canadian_checkers | 2026-04-16 |
| canadian-draughts | maximumCaptureMandatory | true | https://en.wikipedia.org/wiki/Canadian_checkers | 2026-04-16 |
| canadian-draughts | kingType | flying | https://en.wikipedia.org/wiki/Canadian_checkers | 2026-04-16 |
| armenian-draughts | promotionBehavior | mid-capture | https://www.gambiter.com/draughts/Armenian_Checkers.html | 2026-04-16 |
| armenian-draughts | capturedPieceRemovalTiming | immediate | https://www.gambiter.com/draughts/Armenian_Checkers.html | 2026-04-16 |
| armenian-draughts | maximumCaptureMandatory | true | https://checkers.fandom.com/wiki/Armenian_draughts | 2026-04-16 |
| armenian-draughts | kingType | flying | https://www.gambiter.com/draughts/Armenian_Checkers.html | 2026-04-16 |
| turkish-draughts | promotionBehavior | mid-capture | https://en.wikipedia.org/wiki/Turkish_draughts | 2026-04-16 |
| turkish-draughts | capturedPieceRemovalTiming | immediate | https://en.wikipedia.org/wiki/Turkish_draughts | 2026-04-16 |
| turkish-draughts | maximumCaptureMandatory | true | https://en.wikipedia.org/wiki/Turkish_draughts | 2026-04-16 |
| turkish-draughts | kingType | flying | https://en.wikipedia.org/wiki/Turkish_draughts | 2026-04-16 |

---

## Notes

- **Armenian `promotionBehavior: 'mid-capture'`** — three of four consulted
  sources support mid-capture (gambiter.com, checkers.fandom.com,
  Wikipedia's Turkish-family note). ludoteka.com is ambiguous. If a
  federation-authoritative source is later surfaced with conflicting
  language, this row is revisited.
- **Malaysian `huffingMechanism: 'self-piece-forfeit'`** — Task 28.1.2
  landed the `HuffingMechanism` enum upgrade. Malaysian's canonical rule
  across `eightygames.wordpress.com` and `checkers.fandom.com` is
  self-piece-forfeit: the piece that should have captured is removed from
  the board. An alternative `'opponent-chooses'` rule exists in a
  Wikipedia footnote; adopting it would only require flipping this cell.
- **FMJD International rules** — cited via lidraughts.org as an
  accessible public front for the WDF/FMJD rulebook. FMJD Annex 1 PDF
  could not be fetched directly.
- **Task 28.2.2 (2026-04-25) Frisian/Frysk! `capturing-with-king`
  priority** — added to both configs after this rule was confirmed by
  two independent sources:
  - lidraughts.org/variant/frisian: *"If a king and a man can play a
    capture sequence of equal value, it is always forced to play with
    the king."*
  - mindsports.nl: *"If a king and a man can capture an equal value,
    then the king must capture and the man may not."*
  Wikipedia is silent on this specific tiebreaker; the two implementing
  references suffice to land the rule. The priority list now reads
  `['most-pieces', 'kings-weight-1-5', 'capturing-with-king']`.
  `capturePriorityRules` is an array field and is not row-asserted by
  `configSources.test.ts` (the parser handles only scalar values).
- **Task 28.2.2 Malaysian huffing wiring** — Wikipedia
  (en.wikipedia.org/wiki/Malaysian/Singaporean_checkers, 2026-04-25)
  confirms the canonical penalty *"the capturing piece that was required
  to jump should be 'forfeited' and removed from the board"*. The
  engine now invokes `applyHuff` from `applyMoveImpl` whenever a simple
  move was played in a position where at least one of the mover's
  pieces had a legal jump. The eightygames.wordpress.com URL previously
  cited returns 404 as of 2026-04-25; rows that referenced it are
  re-attested to Wikipedia.
- **Task 28.2.2 Frisian king 3-move filter** — clarified by mindsports
  (*"After three times the same king must either proceed with a
  capture or not move at all"*) and lidraughts (*"play more than three
  non-capturing moves in a row with the same king"*). The earlier
  engine filtered ALL moves of a king at the streak limit, including
  captures; this corrected behaviour retains capturing moves so the
  streak can reset legally.
- **Task 28.2.2 Frisian king-move directions (the most-authoritative
  source point).** [frisiandraughts.com](https://www.frisiandraughts.com/spagina/104/7/rules.html)
  Article 9 is the only rule source consulted that explicitly
  distinguishes king *movement* directions (4 diagonal) from king
  *capture* directions (8 — horizontal + vertical + diagonal):
  - *"When making a simple move, a king can only travel along the
    diagonal lines, with a choice of no more than four directions."*
  - *"Capturing with a king can take place in any direction (up to
    eight) along the horizontal, vertical and diagonal lines."*
  Wikipedia, mindsports.nl, and lidraughts.org all gloss the
  distinction. The earlier engine encoded `kingMoveDirections` as 8
  directions, which let kings drift orthogonally on non-capture
  moves — incorrect. The corrected configs use 4 diagonal directions
  for `kingMoveDirections` and retain the 8-direction
  `kingCaptureDirections` set.

---

**End of sources.md.**
