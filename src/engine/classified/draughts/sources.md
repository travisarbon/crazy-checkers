# Tier 1 Draughts — Rule Source Attestation

**Task 28.2.1 §5 deliverable.** Maps each corrected `DraughtsConfig` field
to the published source that authorises the value. `configSources.test.ts`
parses this file and asserts the runtime config factories agree with the
table below. A rule regression therefore surfaces as a test failure on the
same line a reviewer would consult.

**Last verified:** 2026-04-16 (Task 28.2.1 landing).

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
| frysk | kingOrthogonalCaptureIsLimited | false | https://mindsports.nl/index.php/the-pit/550-frisian-draughts | 2026-04-16 |
| frysk | kingConsecutiveMoveLimit | 3 | https://mindsports.nl/index.php/the-pit/550-frisian-draughts | 2026-04-16 |
| frysk | piecesPerSide | 5 | https://en.wikipedia.org/wiki/Frisian_draughts | 2026-04-16 |
| frisian-draughts | promotionBehavior | end-of-turn | https://en.wikipedia.org/wiki/Frisian_draughts | 2026-04-16 |
| frisian-draughts | kingOrthogonalCaptureIsLimited | false | https://mindsports.nl/index.php/the-pit/550-frisian-draughts | 2026-04-16 |
| frisian-draughts | kingConsecutiveMoveLimit | 3 | https://mindsports.nl/index.php/the-pit/550-frisian-draughts | 2026-04-16 |
| frisian-draughts | maximumCaptureMandatory | true | https://mindsports.nl/index.php/the-pit/550-frisian-draughts | 2026-04-16 |
| malaysian-checkers | promotionBehavior | end-of-turn | https://eightygames.wordpress.com/2014/01/19/dam-haji-malaysian-draughts/ | 2026-04-16 |
| malaysian-checkers | maximumCaptureMandatory | true | https://eightygames.wordpress.com/2014/01/19/dam-haji-malaysian-draughts/ | 2026-04-16 |
| malaysian-checkers | capturedPieceRemovalTiming | end-of-sequence | https://checkers.fandom.com/wiki/Dam_Haji | 2026-04-16 |
| malaysian-checkers | huffingMechanism | self-piece-forfeit | https://eightygames.wordpress.com/2014/01/19/dam-haji-malaysian-draughts/ | 2026-04-16 |
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

---

**End of sources.md.**
