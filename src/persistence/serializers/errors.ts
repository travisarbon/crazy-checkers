/**
 * Task 27.6 — typed error classes for the serializer framework.
 *
 * Every framework failure mode throws one of these, each carrying a
 * structured property bag so DevTools / test assertions never need to
 * string-parse a message to recover state.
 */

import type { ClassifiedGameId } from '../../engine/classified/ClassifiedRuleSet';
import type { GameStateSerializer, SerializerVersion } from './types';

export interface SerializerMissingErrorDetails {
  readonly gameId: ClassifiedGameId;
  readonly operation: 'serialize' | 'deserialize';
  readonly cause?: unknown;
}

export class SerializerMissingError extends Error {
  public override readonly name = 'SerializerMissingError';
  public readonly gameId: ClassifiedGameId;
  public readonly operation: 'serialize' | 'deserialize';
  public override readonly cause?: unknown;

  constructor(details: SerializerMissingErrorDetails) {
    super(
      `No serializer registered for gameId="${details.gameId}" (operation=${details.operation}).`,
    );
    this.gameId = details.gameId;
    this.operation = details.operation;
    this.cause = details.cause;
  }
}

export interface DuplicateSerializerErrorDetails {
  readonly gameId: ClassifiedGameId;
  readonly existing: GameStateSerializer;
  readonly incoming: GameStateSerializer;
}

export class DuplicateSerializerError extends Error {
  public override readonly name = 'DuplicateSerializerError';
  public readonly gameId: ClassifiedGameId;
  public readonly existing: GameStateSerializer;
  public readonly incoming: GameStateSerializer;

  constructor(details: DuplicateSerializerErrorDetails) {
    super(
      `Duplicate serializer registration for gameId="${details.gameId}" — incoming differs from existing.`,
    );
    this.gameId = details.gameId;
    this.existing = details.existing;
    this.incoming = details.incoming;
  }
}

export interface SerializerIdentityErrorDetails {
  readonly expectedGameId: ClassifiedGameId;
  readonly actualGameId: ClassifiedGameId;
}

export class SerializerIdentityError extends Error {
  public override readonly name = 'SerializerIdentityError';
  public readonly expectedGameId: ClassifiedGameId;
  public readonly actualGameId: ClassifiedGameId;

  constructor(details: SerializerIdentityErrorDetails) {
    super(
      `Serializer identity mismatch: expected gameId="${details.expectedGameId}" but serializer carries gameId="${details.actualGameId}".`,
    );
    this.expectedGameId = details.expectedGameId;
    this.actualGameId = details.actualGameId;
  }
}

export interface MigrationNotImplementedErrorDetails {
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly gameId?: ClassifiedGameId;
}

export class MigrationNotImplementedError extends Error {
  public override readonly name = 'MigrationNotImplementedError';
  public readonly fromVersion: number;
  public readonly toVersion: number;
  public readonly gameId?: ClassifiedGameId;

  constructor(details: MigrationNotImplementedErrorDetails) {
    super(
      `Migration not implemented: ${String(details.fromVersion)} → ${String(details.toVersion)}` +
        (details.gameId ? ` (gameId="${details.gameId}")` : ''),
    );
    this.fromVersion = details.fromVersion;
    this.toVersion = details.toVersion;
    this.gameId = details.gameId;
  }
}

export interface SerializerPieceIdErrorDetails {
  readonly gameId: ClassifiedGameId;
  readonly unknownPieceId: string;
  readonly registeredPieceIds: readonly string[];
}

export class SerializerPieceIdError extends Error {
  public override readonly name = 'SerializerPieceIdError';
  public readonly gameId: ClassifiedGameId;
  public readonly unknownPieceId: string;
  public readonly registeredPieceIds: readonly string[];

  constructor(details: SerializerPieceIdErrorDetails) {
    super(
      `Unknown pieceId="${details.unknownPieceId}" for gameId="${details.gameId}"; ` +
        `registered ids: [${details.registeredPieceIds.join(', ')}].`,
    );
    this.gameId = details.gameId;
    this.unknownPieceId = details.unknownPieceId;
    this.registeredPieceIds = details.registeredPieceIds;
  }
}

export interface SerializerMetaErrorDetails {
  readonly gameId: ClassifiedGameId;
  readonly metaKey: string;
  readonly value: unknown;
}

export class SerializerMetaError extends Error {
  public override readonly name = 'SerializerMetaError';
  public readonly gameId: ClassifiedGameId;
  public readonly metaKey: string;
  public readonly value: unknown;

  constructor(details: SerializerMetaErrorDetails) {
    super(
      `Non-JSON-safe value in meta["${details.metaKey}"] for gameId="${details.gameId}".`,
    );
    this.gameId = details.gameId;
    this.metaKey = details.metaKey;
    this.value = details.value;
  }
}

export interface EnvelopeVersionErrorDetails {
  readonly gameId: ClassifiedGameId;
  readonly envelopeVersion: number;
  readonly registryVersion: SerializerVersion;
}

export class EnvelopeVersionError extends Error {
  public override readonly name = 'EnvelopeVersionError';
  public readonly gameId: ClassifiedGameId;
  public readonly envelopeVersion: number;
  public readonly registryVersion: SerializerVersion;

  constructor(details: EnvelopeVersionErrorDetails) {
    super(
      `Envelope schemaVersion=${String(details.envelopeVersion)} not supported ` +
        `(registry at v${String(details.registryVersion)}) for gameId="${details.gameId}".`,
    );
    this.gameId = details.gameId;
    this.envelopeVersion = details.envelopeVersion;
    this.registryVersion = details.registryVersion;
  }
}
