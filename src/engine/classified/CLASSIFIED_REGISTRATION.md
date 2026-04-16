# Classified Registration Guide (Task 27.4)

Normative reference for tier authors (Tasks 28–34) who ship Tier 1–7 Classified games. The call-site surface in this file is the implementation of record for the Classified Integration Master Playbook §2–§3.

---

## 1. The spec in one place

Every Classified game registers with:

```ts
import { registerClassifiedGame } from 'src/engine/classified/registry';
import { asClassifiedGameId, asPieceVocabularyId, asAudioPackId } from 'src/engine/classified/pieceVocabulary';

registerClassifiedGame({
  gameId: asClassifiedGameId('russian-draughts'),
  classifiedNumber: 1,           // 1..64 production; 0/-1 reserved for Tier 0 fixtures
  wave: 1,                       // 1..8 unlock wave
  tier: 1,                       // 1..7 engineering tier
  family: 'Draughts',
  displayName: 'Russian Draughts',
  ruleSet: russianDraughtsRuleSet,
  boardGeometry: russianDraughtsRuleSet.boardGeometry, // must === ruleSet.boardGeometry
  pieceVocabularyId: russianDraughtsRuleSet.pieceVocabulary.id,
  audioPackId: asAudioPackId('default-draughts'),
  codeUnlockKey: 'CLASSIFIED01',  // must exist in src/data/unlockCodes.ts
  narrativeFlavor: {
    wave: 'Wave 1 — Foundations',
    family: 'Draughts',
    connection: 'The ancestor of American Checkers; flying kings and backwards capture.',
  },
});
```

## 2. Capability flags ↔ optional hooks

| Capability flag | Required hook |
|-----------------|---------------|
| `hasPiecesInHand: true` | `getLegalDrops` |
| `hasPlacementPhase: true` | `getPlacementZones` |
| `isAsymmetric: true` | `getRoleLabels` |

Both directions are validated. Presence of an optional hook without its flag is an error; absence of a required hook when the flag is set is an error. The `ConsistentRuleSet<R>` type narrows the spec at compile time; `validateRuleSetConsistency` catches any cast that escapes the type check.

## 3. Conflict policy

| Attribute | Policy |
|-----------|--------|
| `gameId` | Unique; duplicate registrations throw unless `{ replace: true }` is passed (tests / hot reload only). |
| `classifiedNumber` | Unique; **no** replace escape (the 1..64 slot is immutable). |
| `codeUnlockKey` | Unique across the registry. |

The registration pipeline is atomic. If any downstream step (`GameModeRegistry`, Cogitate adapter) throws, the in-memory map entry is rolled back before the original error is re-thrown as `ClassifiedRegistrationError { kind: 'downstream-registration-failed' }`.

## 4. Error taxonomy (`ClassifiedRegistrationError.kind`)

- `invalid-gameId` — must match `/^[a-z][a-z0-9-]*$/`.
- `duplicate-gameId`
- `duplicate-classifiedNumber`
- `duplicate-codeUnlockKey`
- `classifiedNumber-out-of-range`
- `unknown-wave`, `unknown-tier`, `unknown-family`
- `flag-hook-mismatch`
- `boardGeometry-mismatch` — `spec.boardGeometry !== spec.ruleSet.boardGeometry`.
- `pieceVocabulary-mismatch` — `spec.pieceVocabularyId !== spec.ruleSet.pieceVocabulary.id`.
- `unknown-codeUnlockKey`
- `placeholder-mismatch` — `CLASSIFIED_PLACEHOLDER_DATA[classifiedNumber].displayName` does not match `spec.displayName`.
- `downstream-registration-failed`

## 5. Tier lazy loader

`loadClassifiedTier(tierNumber)` dynamically imports `./tier{N}/index.ts` and calls the module's exported `registerTier{N}()` function. Tier index modules are authored per-tier task; the loader is idempotent — repeated calls return the cached promise.

```ts
await loadClassifiedTier(1); // registers every Tier 1 game.
```

## 6. Default Cogitate adapter

When `spec.adapter` is omitted, `createDefaultClassifiedAdapter(entry)` produces a Phase 3-compatible `CogitateGameAdapter` that:
- Returns the Task 27.3 `BoardGeometry` descriptor via `getBoardGeometry()` (synthesised into the Phase 3 `cogitate/types.BoardGeometry` shape).
- Exposes the T7-08 `getOnBoardPalette` / `getHandPalette` accessors.
- Reports `supportsEvaluation() === false` until a per-game `evaluationProvider` is supplied.
- Throws a descriptive error from Phase 3 methods that don't yet map to the Phase 4 rule-set shape (`getBoard`, `serializeBoard`, `getStartingPosition`, `getRuleSet`). Tier tasks override as needed.

## 7. Persistence-key stability

`gameId` values are **persistence keys**. Once a game ships to production its `gameId` may never change — `src/engine/classified/registry.stability.test.ts` locks the canonical Tier 0 ids and doubles as the convention guard for tier authors.

## 8. Worked example — hypothetical Wave 3 / Tier 4 game

```ts
// src/engine/classified/tier4/breakthrough.ts
import { registerClassifiedGame } from '../registry';
import { BreakthroughRuleSet } from './breakthroughRuleSet';

const ruleSet = new BreakthroughRuleSet();

registerClassifiedGame({
  gameId: asClassifiedGameId('breakthrough'),
  classifiedNumber: 37,
  wave: 3,
  tier: 4,
  family: 'Abstract Strategy',
  displayName: 'Breakthrough',
  ruleSet,
  boardGeometry: ruleSet.boardGeometry,
  pieceVocabularyId: ruleSet.pieceVocabulary.id,
  audioPackId: asAudioPackId('abstract-strategy'),
  codeUnlockKey: 'CLASSIFIED37',
  narrativeFlavor: {
    wave: 'Wave 3 — Connection and territory',
    family: 'Abstract Strategy',
    connection: 'Two rows of pawns race to reach the opposite back rank.',
  },
});
```

## 8.a. Serializer auto-registration (Task 27.6)

The `ruleSet.serializer` field is required. `registerClassifiedGame` auto-registers
it under `spec.gameId` via `registerSerializerForSpec` (see
`src/persistence/serializers`). The framework:

- stamps `gameId` onto the serializer if it uses the Task 27.4-era
  `{ version, toJSON, fromJSON }` shape (via `createSerializerFromLegacyShape`);
- throws `SerializerIdentityError` if the serializer's `gameId` disagrees
  with `spec.gameId`;
- fails loud with `SerializerMissingError` on any later deserialize against
  an unregistered `gameId` — there is no silent fallback.

Games without bespoke encoding should register
`createDefaultSerializer({ gameId, vocabularyPieceIds })` — it round-trips
every field of `ClassifiedGameState` (pieces, turn, plyCount, moveHistory,
hands, placementPhase, roles, meta) with canonical ordering so two equivalent
states produce byte-identical JSON. Task 36.2 adds per-tier bespoke
serializers (PDN for Tier 2, FEN for Tier 6, SFEN for Tier 7) on top of this
framework.

## 9. Cross-references

- Classified Integration Master Playbook §2 — the normative interface.
- Classified Integration Master Playbook §3 — normative registration conventions.
- Classified Library Playbook v1.1 — wave / family / `narrativeFlavor` source of truth.
- Phase 4 Handoff Review §5.3 — the Task 27.1 handoff deltas closed by this task (X-04, X-08, T1-03, T3-05, T7-08).
- Phase 4 Tier 1–7 Classified Playbooks §2.1 / §2.3 — per-tier dependency lists that cite `registerClassifiedGame` as the intake.
