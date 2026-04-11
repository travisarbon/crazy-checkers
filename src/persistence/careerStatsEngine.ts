/**
 * Pure computation module for Career mode statistics.
 *
 * Processes GameRecord[] and ChallengeRecord[] into a fully computed
 * CareerSnapshot data structure. No side effects, no DOM access, no
 * React dependency, no direct IndexedDB calls.
 *
 * Primary entry points:
 *   - computeCareerSnapshot(records, challengeRecords?) — full recompute
 *   - updateCareerSnapshot(existing, newRecord, newChallengeRecord?) — O(1) incremental
 *   - loadAndComputeCareerSnapshot() — async adapter that reads from IndexedDB
 */

import type { GameRecord } from './gameHistory';
import type { ChallengeRecord } from './challengeRecords';
import type { ModeCategory, ModeRegistryEntry, TrackId } from './gameModeRegistry';
import {
  resolveGameRecord,
  getClassifiedByWave,
} from './gameModeRegistry';
import { TRACK_1_THRESHOLDS } from './unlockEvaluator';
import { getAllGameRecords } from './gameHistory';
import { getAllChallengeRecords } from './challengeRecords';

// Re-export TrackId for consumers
export type { TrackId } from './gameModeRegistry';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface SummaryStats {
  readonly totalGames: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly winRate: number;
  readonly longestWinStreak: number;
  readonly currentWinStreak: number;
  readonly totalPlayTimeMs: number;
  readonly averageGameLengthPlies: number;
  readonly averagePlayTimeMs: number;
}

export interface PerOpponentStats {
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly winRate: number;
}

export interface PassAroundStats {
  readonly gamesPlayed: number;
  readonly whiteWins: number;
  readonly blackWins: number;
  readonly draws: number;
}

export interface PerOpponentBreakdown {
  readonly vsEasy: PerOpponentStats;
  readonly vsHard: PerOpponentStats;
  readonly passAround: PassAroundStats;
}

export interface ModeStatBlock {
  readonly registryId: string;
  readonly displayName: string;
  readonly category: ModeCategory;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly winRate: number;
  readonly vsEasy: PerOpponentStats;
  readonly vsHard: PerOpponentStats;
  readonly passAround: PassAroundStats;
  readonly averageGameLengthPlies: number;
  readonly totalPlayTimeMs: number;
}

export interface TrackProgress {
  readonly trackId: TrackId;
  readonly trackName: string;
  readonly currentValue: number;
  readonly thresholds: readonly number[];
  readonly completedMilestones: number;
  readonly totalMilestones: number;
  readonly nextThreshold: number | null;
}

export interface Track4MilestoneStatus {
  readonly choiceNumber: number;
  readonly description: string;
  readonly condition: string;
  readonly met: boolean;
  readonly currentValue: number;
  readonly requiredValue: number;
}

export interface ChaosGateProgress {
  readonly challengesCompleted: number;
  readonly choiceModesUnlocked: number;
  readonly classifiedUnlocked: boolean;
  readonly classifiedHardWins: number;
}

export interface ChallengeStats {
  readonly puzzlesCompleted: number;
  readonly averageRating: number;
  readonly bestTimeMs: number | null;
  readonly currentStreak: number;
  readonly totalAttempts: number;
}

export interface WaveStats {
  readonly wave: number;
  readonly waveName: string;
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly hardWins: number;
  readonly totalGamesInWave: number;
}

export interface EventStatEntry {
  readonly eventId: string;
  readonly triggerCount: number;
  readonly gamesWithEvent: number;
  readonly winsWithEvent: number;
  readonly lossesWithEvent: number;
}

export interface CareerSnapshot {
  readonly summary: SummaryStats;
  readonly perOpponent: PerOpponentBreakdown;
  readonly perMode: ReadonlyMap<string, ModeStatBlock>;
  readonly tracks: readonly TrackProgress[];
  readonly track4Milestones: readonly Track4MilestoneStatus[];
  readonly chaosGate: ChaosGateProgress;
  readonly challengeStats: ChallengeStats;
  readonly classifiedWaves: readonly WaveStats[];
  readonly eventStats: ReadonlyMap<string, EventStatEntry>;
}

// ---------------------------------------------------------------------------
// Game classification
// ---------------------------------------------------------------------------

export interface GameClassification {
  readonly registryEntry: ModeRegistryEntry;
  readonly isPassAround: boolean;
  readonly isCpuGame: boolean;
  readonly cpuDifficulty: 'easy' | 'hard' | null;
  readonly humanColor: 'white' | 'black' | null;
  readonly humanWon: boolean;
  readonly humanLost: boolean;
  readonly isDraw: boolean;
  readonly playTimeMs: number;
  readonly gameLengthPlies: number;
}

export function classifyGameRecord(record: GameRecord): GameClassification {
  const registryEntry = resolveGameRecord(record);

  const isPassAround =
    record.playerWhite === 'HUMAN' && record.playerBlack === 'HUMAN';
  const isCpuGame = !isPassAround;

  let cpuDifficulty: 'easy' | 'hard' | null = null;
  if (isCpuGame) {
    const cpuPlayer =
      record.playerWhite === 'HUMAN' ? record.playerBlack : record.playerWhite;
    cpuDifficulty = cpuPlayer === 'CPU_HARD' ? 'hard' : 'easy';
  }

  let humanColor: 'white' | 'black' | null = null;
  if (isCpuGame) {
    humanColor = record.playerWhite === 'HUMAN' ? 'white' : 'black';
  }

  const isDraw = record.result === 'DRAW';
  let humanWon = false;
  let humanLost = false;

  if (isCpuGame && !isDraw) {
    if (humanColor === 'white') {
      humanWon = record.result === 'WHITE_WIN';
      humanLost = record.result === 'BLACK_WIN';
    } else {
      humanWon = record.result === 'BLACK_WIN';
      humanLost = record.result === 'WHITE_WIN';
    }
  }

  const playTimeMs = Math.max(0, record.completedAt - record.startedAt);
  const gameLengthPlies = record.moves.length;

  return {
    registryEntry,
    isPassAround,
    isCpuGame,
    cpuDifficulty,
    humanColor,
    humanWon,
    humanLost,
    isDraw,
    playTimeMs,
    gameLengthPlies,
  };
}

// ---------------------------------------------------------------------------
// Streak computation
// ---------------------------------------------------------------------------

export interface StreakResult {
  readonly longestWinStreak: number;
  readonly currentWinStreak: number;
  readonly longestHardWinStreak: number;
  readonly currentHardWinStreak: number;
}

export function computeStreaks(
  classifications: readonly GameClassification[],
): StreakResult {
  let longestWinStreak = 0;
  let currentWinStreak = 0;
  let longestHardWinStreak = 0;
  let currentHardWinStreak = 0;

  for (const c of classifications) {
    if (c.isPassAround) continue;
    if (c.registryEntry.excludeFromCareer) continue;

    if (c.humanWon) {
      currentWinStreak += 1;
      if (currentWinStreak > longestWinStreak) {
        longestWinStreak = currentWinStreak;
      }
    } else {
      currentWinStreak = 0;
    }

    if (c.cpuDifficulty === 'hard') {
      if (c.humanWon) {
        currentHardWinStreak += 1;
        if (currentHardWinStreak > longestHardWinStreak) {
          longestHardWinStreak = currentHardWinStreak;
        }
      } else {
        currentHardWinStreak = 0;
      }
    }
  }

  return {
    longestWinStreak,
    currentWinStreak,
    longestHardWinStreak,
    currentHardWinStreak,
  };
}

// ---------------------------------------------------------------------------
// Track 4 milestones
// ---------------------------------------------------------------------------

interface Track4Accumulators {
  totalGames: number;
  longestHardWinStreak: number;
  blackHardWins: number;
  distinctModeWins: number;
  passAroundGames: number;
}

interface Track4MilestoneDef {
  readonly choiceNumber: number;
  readonly description: string;
  readonly condition: string;
  readonly requiredValue: number;
  readonly field: keyof Track4Accumulators;
}

const TRACK_4_MILESTONES: readonly Track4MilestoneDef[] = [
  { choiceNumber: 25, description: 'Play 50 total games', condition: 'totalGamesPlayed >= 50', requiredValue: 50, field: 'totalGames' },
  { choiceNumber: 26, description: 'Win 5 games in a row vs. Hard CPU', condition: 'maxHardWinStreak >= 5', requiredValue: 5, field: 'longestHardWinStreak' },
  { choiceNumber: 27, description: 'Win 10 games as Black vs. Hard CPU', condition: 'blackHardWins >= 10', requiredValue: 10, field: 'blackHardWins' },
  { choiceNumber: 28, description: 'Play 100 total games', condition: 'totalGamesPlayed >= 100', requiredValue: 100, field: 'totalGames' },
  { choiceNumber: 29, description: 'Win a game in 5 different modes', condition: 'distinctModeWins >= 5', requiredValue: 5, field: 'distinctModeWins' },
  { choiceNumber: 30, description: 'Win 25 games in Pass Around', condition: 'passAroundGames >= 25', requiredValue: 25, field: 'passAroundGames' },
  { choiceNumber: 31, description: 'Achieve a 10-game win streak vs. Hard CPU', condition: 'maxHardWinStreak >= 10', requiredValue: 10, field: 'longestHardWinStreak' },
  { choiceNumber: 32, description: 'Play 200 total games', condition: 'totalGamesPlayed >= 200', requiredValue: 200, field: 'totalGames' },
];

function evaluateTrack4Milestones(
  accumulators: Track4Accumulators,
): Track4MilestoneStatus[] {
  return TRACK_4_MILESTONES.map((def) => ({
    choiceNumber: def.choiceNumber,
    description: def.description,
    condition: def.condition,
    met: accumulators[def.field] >= def.requiredValue,
    currentValue: accumulators[def.field],
    requiredValue: def.requiredValue,
  }));
}

// ---------------------------------------------------------------------------
// Track progress computation
// ---------------------------------------------------------------------------

const TRACK_2_THRESHOLDS = [1, 3, 6, 10, 15, 21, 28, 36] as const;
const TRACK_3_THRESHOLDS = [1, 4, 8, 13, 19, 26, 34, 43] as const;
const TRACK_5_THRESHOLDS = [1, 5, 10, 20, 30, 40, 50, 64] as const;

function buildTrackProgress(
  trackId: TrackId,
  trackName: string,
  currentValue: number,
  thresholds: readonly number[],
): TrackProgress {
  let completedMilestones = 0;
  for (const t of thresholds) {
    if (currentValue >= t) {
      completedMilestones += 1;
    } else {
      break;
    }
  }

  const nextThreshold =
    completedMilestones < thresholds.length
      ? thresholds[completedMilestones] ?? null
      : null;

  return {
    trackId,
    trackName,
    currentValue,
    thresholds: [...thresholds],
    completedMilestones,
    totalMilestones: thresholds.length,
    nextThreshold,
  };
}

function buildTrack4Progress(
  milestones: readonly Track4MilestoneStatus[],
): TrackProgress {
  const milestoneMet = milestones.filter((m) => m.met).length;
  const track4Thresholds = [1, 2, 3, 4, 5, 6, 7, 8] as const;
  return buildTrackProgress('lifer', 'Lifer', milestoneMet, track4Thresholds);
}

function computeAllTrackProgress(
  classifications: readonly GameClassification[],
  challengesCompleted: number,
  track4Milestones: readonly Track4MilestoneStatus[],
): TrackProgress[] {
  // Track 2: Crazy Hard CPU human wins
  let crazyHardWins = 0;
  for (const c of classifications) {
    if (
      c.registryEntry.category === 'crazy' &&
      c.cpuDifficulty === 'hard' &&
      c.humanWon
    ) {
      crazyHardWins += 1;
    }
  }

  // Track 3: Choice Hard CPU human wins
  let choiceHardWins = 0;
  for (const c of classifications) {
    if (
      c.registryEntry.category === 'choice' &&
      c.cpuDifficulty === 'hard' &&
      c.humanWon
    ) {
      choiceHardWins += 1;
    }
  }

  // Track 5: Distinct Classified games won vs Hard CPU
  const classifiedHardWinIds = new Set<string>();
  for (const c of classifications) {
    if (
      c.registryEntry.category === 'classified' &&
      c.cpuDifficulty === 'hard' &&
      c.humanWon
    ) {
      classifiedHardWinIds.add(c.registryEntry.id);
    }
  }
  const classifiedDistinctHardWins = classifiedHardWinIds.size;

  return [
    buildTrackProgress('puzzle-mastery', 'Puzzle Mastery', challengesCompleted, [...TRACK_1_THRESHOLDS]),
    buildTrackProgress('chaos-veteran', 'Chaos Veteran', crazyHardWins, [...TRACK_2_THRESHOLDS]),
    buildTrackProgress('rule-bender', 'Rule Bender', choiceHardWins, [...TRACK_3_THRESHOLDS]),
    buildTrack4Progress(track4Milestones),
    buildTrackProgress('world-player', 'World Player', classifiedDistinctHardWins, [...TRACK_5_THRESHOLDS]),
  ];
}

// ---------------------------------------------------------------------------
// Event statistics
// ---------------------------------------------------------------------------

interface MutableEventStat {
  eventId: string;
  triggerCount: number;
  gamesWithEvent: number;
  winsWithEvent: number;
  lossesWithEvent: number;
}

function computeEventStats(
  classifications: readonly GameClassification[],
  records: readonly GameRecord[],
): ReadonlyMap<string, EventStatEntry> {
  const eventMap = new Map<string, MutableEventStat>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const classification = classifications[i];
    if (!record || !classification) continue;
    if (!record.eventTriggerLog || record.eventTriggerLog.length === 0) continue;

    const eventsInThisGame = new Set<string>();
    for (const trigger of record.eventTriggerLog) {
      const eventId = trigger.event;
      eventsInThisGame.add(eventId);

      let stat = eventMap.get(eventId);
      if (!stat) {
        stat = {
          eventId,
          triggerCount: 0,
          gamesWithEvent: 0,
          winsWithEvent: 0,
          lossesWithEvent: 0,
        };
      }
      stat.triggerCount += 1;
      eventMap.set(eventId, stat);
    }

    for (const eventId of eventsInThisGame) {
      const stat = eventMap.get(eventId);
      if (!stat) continue;
      stat.gamesWithEvent += 1;
      if (classification.humanWon) {
        stat.winsWithEvent += 1;
      } else if (classification.humanLost) {
        stat.lossesWithEvent += 1;
      }
    }
  }

  return eventMap as ReadonlyMap<string, EventStatEntry>;
}

// ---------------------------------------------------------------------------
// Classified wave stats
// ---------------------------------------------------------------------------

const WAVE_NAMES: readonly string[] = [
  'The Draughts Family',
  'Hunt & Capture',
  'Race & Connection',
  'Territory & Enclosure',
  'Deep Strategy & Unique Systems',
  'The Chess Family',
  'The Shogi Family',
  'The Final Unlocks',
];

function computeClassifiedWaveStats(
  classifications: readonly GameClassification[],
): WaveStats[] {
  const waves: WaveStats[] = Array.from({ length: 8 }, (_, i) => ({
    wave: i + 1,
    waveName: WAVE_NAMES[i] ?? '',
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    hardWins: 0,
    totalGamesInWave: getClassifiedByWave(i + 1).length,
  }));

  for (const c of classifications) {
    if (c.registryEntry.category !== 'classified') continue;
    const waveNum = c.registryEntry.wave;
    if (waveNum === null || waveNum < 1 || waveNum > 8) continue;
    const wave = waves[waveNum - 1];
    if (!wave) continue;

    // Waves are readonly in the return type but mutable during construction
    (wave as { gamesPlayed: number }).gamesPlayed += 1;
    if (c.humanWon) (wave as { wins: number }).wins += 1;
    if (c.humanLost) (wave as { losses: number }).losses += 1;
    if (c.isDraw) (wave as { draws: number }).draws += 1;
    if (c.humanWon && c.cpuDifficulty === 'hard') {
      (wave as { hardWins: number }).hardWins += 1;
    }
  }

  return waves;
}

// ---------------------------------------------------------------------------
// Challenge stats computation
// ---------------------------------------------------------------------------

function computeChallengeStatsFromRecords(
  challengeRecords: readonly ChallengeRecord[],
): ChallengeStats {
  if (challengeRecords.length === 0) {
    return {
      puzzlesCompleted: 0,
      averageRating: 0,
      bestTimeMs: null,
      currentStreak: 0,
      totalAttempts: 0,
    };
  }

  const perPuzzle = new Map<
    number,
    { solved: boolean; bestTimeMs: number | null; bestRating: number }
  >();

  for (const record of challengeRecords) {
    let summary = perPuzzle.get(record.puzzleId);
    if (!summary) {
      summary = { solved: false, bestTimeMs: null, bestRating: 0 };
    }
    if (record.solved) {
      summary.solved = true;
      if (summary.bestTimeMs === null || record.solveTimeMs < summary.bestTimeMs) {
        summary.bestTimeMs = record.solveTimeMs;
      }
      if (record.rating > summary.bestRating) {
        summary.bestRating = record.rating;
      }
    }
    perPuzzle.set(record.puzzleId, summary);
  }

  const solvedPuzzles = [...perPuzzle.values()].filter((s) => s.solved);
  const puzzlesCompleted = solvedPuzzles.length;
  const averageRating =
    puzzlesCompleted > 0
      ? solvedPuzzles.reduce((sum, s) => sum + s.bestRating, 0) / puzzlesCompleted
      : 0;
  const bestTimeMs =
    puzzlesCompleted > 0
      ? Math.min(
          ...solvedPuzzles.map((s) =>
            s.bestTimeMs !== null ? s.bestTimeMs : Infinity,
          ),
        )
      : null;

  // Current streak: consecutive puzzles from #1 solved on first attempt
  const firstAttemptSolved = new Set<number>();
  for (const record of challengeRecords) {
    if (record.attemptNumber === 1 && record.solved) {
      firstAttemptSolved.add(record.puzzleId);
    }
  }
  let currentStreak = 0;
  for (let id = 1; id <= 100; id++) {
    if (firstAttemptSolved.has(id)) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  return {
    puzzlesCompleted,
    averageRating,
    bestTimeMs,
    currentStreak,
    totalAttempts: challengeRecords.length,
  };
}

// ---------------------------------------------------------------------------
// Chaos Gate progress
// ---------------------------------------------------------------------------

function computeChaosGate(
  challengesCompleted: number,
  tracks: readonly TrackProgress[],
  classifiedHardWins: number,
): ChaosGateProgress {
  // Total Choice modes unlocked = sum of completedMilestones across all 5 tracks
  let choiceModesUnlocked = 0;
  for (const track of tracks) {
    choiceModesUnlocked += track.completedMilestones;
  }

  return {
    challengesCompleted,
    choiceModesUnlocked,
    classifiedUnlocked: challengesCompleted >= 100,
    classifiedHardWins,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safePercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return (numerator / denominator) * 100;
}

function withWinRate(acc: {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}): PerOpponentStats {
  return {
    gamesPlayed: acc.gamesPlayed,
    wins: acc.wins,
    losses: acc.losses,
    draws: acc.draws,
    winRate: safePercent(acc.wins, acc.wins + acc.losses),
  };
}

// ---------------------------------------------------------------------------
// Mutable accumulator types for single-pass computation
// ---------------------------------------------------------------------------

interface MutablePerOpponentStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

interface MutablePassAroundStats {
  gamesPlayed: number;
  whiteWins: number;
  blackWins: number;
  draws: number;
}

interface MutableModeStatBlock {
  registryId: string;
  displayName: string;
  category: ModeCategory;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  vsEasy: MutablePerOpponentStats;
  vsHard: MutablePerOpponentStats;
  passAround: MutablePassAroundStats;
  totalPlies: number;
  totalPlayTimeMs: number;
}

function createEmptyMutableModeStat(entry: ModeRegistryEntry): MutableModeStatBlock {
  return {
    registryId: entry.id,
    displayName: entry.displayName,
    category: entry.category,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    vsEasy: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 },
    vsHard: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 },
    passAround: { gamesPlayed: 0, whiteWins: 0, blackWins: 0, draws: 0 },
    totalPlies: 0,
    totalPlayTimeMs: 0,
  };
}

function freezeModeStatBlock(acc: MutableModeStatBlock): ModeStatBlock {
  return {
    registryId: acc.registryId,
    displayName: acc.displayName,
    category: acc.category,
    gamesPlayed: acc.gamesPlayed,
    wins: acc.wins,
    losses: acc.losses,
    draws: acc.draws,
    winRate: safePercent(acc.wins, acc.wins + acc.losses),
    vsEasy: withWinRate(acc.vsEasy),
    vsHard: withWinRate(acc.vsHard),
    passAround: { ...acc.passAround },
    averageGameLengthPlies:
      acc.gamesPlayed > 0 ? acc.totalPlies / acc.gamesPlayed : 0,
    totalPlayTimeMs: acc.totalPlayTimeMs,
  };
}

// ---------------------------------------------------------------------------
// computeCareerSnapshot — Full recompute
// ---------------------------------------------------------------------------

export function computeCareerSnapshot(
  records: readonly GameRecord[],
  challengeRecords?: readonly ChallengeRecord[],
): CareerSnapshot {
  // Step 1: Classify all records
  const classified = records.map((r) => ({
    record: r,
    classification: classifyGameRecord(r),
  }));

  // Step 2: Filter excluded modes
  const eligible = classified.filter(
    ({ classification }) => !classification.registryEntry.excludeFromCareer,
  );

  // Step 3: Sort by completedAt ascending (for streak computation)
  eligible.sort((a, b) => a.record.completedAt - b.record.completedAt);

  // Step 4: Single-pass accumulation
  let totalGames = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalPlayTimeMs = 0;
  let totalPlies = 0;

  const vsEasyAcc: MutablePerOpponentStats = { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
  const vsHardAcc: MutablePerOpponentStats = { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
  const passAroundAcc: MutablePassAroundStats = { gamesPlayed: 0, whiteWins: 0, blackWins: 0, draws: 0 };

  const modeAccumulators = new Map<string, MutableModeStatBlock>();
  const distinctModeWins = new Set<string>();
  let blackHardWins = 0;
  let passAroundGames = 0;

  // Classified Hard wins for Chaos Gate
  const classifiedHardWinIds = new Set<string>();

  for (const { record, classification: c } of eligible) {
    totalGames += 1;
    totalPlayTimeMs += c.playTimeMs;
    totalPlies += c.gameLengthPlies;

    // Per-mode accumulation
    const modeId = c.registryEntry.id;
    let modeStat = modeAccumulators.get(modeId);
    if (!modeStat) {
      modeStat = createEmptyMutableModeStat(c.registryEntry);
    }
    modeStat.gamesPlayed += 1;
    modeStat.totalPlayTimeMs += c.playTimeMs;
    modeStat.totalPlies += c.gameLengthPlies;

    if (c.isPassAround) {
      passAroundAcc.gamesPlayed += 1;
      passAroundGames += 1;
      modeStat.passAround.gamesPlayed += 1;
      if (record.result === 'WHITE_WIN') {
        passAroundAcc.whiteWins += 1;
        modeStat.passAround.whiteWins += 1;
      } else if (record.result === 'BLACK_WIN') {
        passAroundAcc.blackWins += 1;
        modeStat.passAround.blackWins += 1;
      } else {
        passAroundAcc.draws += 1;
        modeStat.passAround.draws += 1;
      }
    } else {
      // vs CPU game
      if (c.humanWon) wins += 1;
      if (c.humanLost) losses += 1;
      if (c.isDraw) draws += 1;

      if (c.humanWon) modeStat.wins += 1;
      if (c.humanLost) modeStat.losses += 1;
      if (c.isDraw) modeStat.draws += 1;

      if (c.cpuDifficulty === 'easy') {
        vsEasyAcc.gamesPlayed += 1;
        if (c.humanWon) vsEasyAcc.wins += 1;
        if (c.humanLost) vsEasyAcc.losses += 1;
        if (c.isDraw) vsEasyAcc.draws += 1;

        modeStat.vsEasy.gamesPlayed += 1;
        if (c.humanWon) modeStat.vsEasy.wins += 1;
        if (c.humanLost) modeStat.vsEasy.losses += 1;
        if (c.isDraw) modeStat.vsEasy.draws += 1;
      } else if (c.cpuDifficulty === 'hard') {
        vsHardAcc.gamesPlayed += 1;
        if (c.humanWon) vsHardAcc.wins += 1;
        if (c.humanLost) vsHardAcc.losses += 1;
        if (c.isDraw) vsHardAcc.draws += 1;

        modeStat.vsHard.gamesPlayed += 1;
        if (c.humanWon) modeStat.vsHard.wins += 1;
        if (c.humanLost) modeStat.vsHard.losses += 1;
        if (c.isDraw) modeStat.vsHard.draws += 1;

        // Track 4 milestone trackers
        if (c.humanWon && c.humanColor === 'black') {
          blackHardWins += 1;
        }

        // Classified Hard wins for Chaos Gate & Track 5
        if (c.humanWon && c.registryEntry.category === 'classified') {
          classifiedHardWinIds.add(c.registryEntry.id);
        }
      }

      if (c.humanWon) {
        distinctModeWins.add(modeId);
      }
    }

    modeAccumulators.set(modeId, modeStat);
  }

  // Step 5: Compute streaks
  const streaks = computeStreaks(eligible.map((e) => e.classification));

  // Step 6: Compute derived metrics
  const summary: SummaryStats = {
    totalGames,
    wins,
    losses,
    draws,
    winRate: safePercent(wins, wins + losses),
    longestWinStreak: streaks.longestWinStreak,
    currentWinStreak: streaks.currentWinStreak,
    totalPlayTimeMs,
    averageGameLengthPlies: totalGames > 0 ? totalPlies / totalGames : 0,
    averagePlayTimeMs: totalGames > 0 ? totalPlayTimeMs / totalGames : 0,
  };

  const perOpponent: PerOpponentBreakdown = {
    vsEasy: withWinRate(vsEasyAcc),
    vsHard: withWinRate(vsHardAcc),
    passAround: { ...passAroundAcc },
  };

  // Step 7: Finalize per-mode stats with win rates
  const perMode = new Map<string, ModeStatBlock>();
  for (const [id, acc] of modeAccumulators) {
    perMode.set(id, freezeModeStatBlock(acc));
  }

  // Step 8: Compute Track 4 milestones
  const track4Acc: Track4Accumulators = {
    totalGames,
    longestHardWinStreak: streaks.longestHardWinStreak,
    blackHardWins,
    distinctModeWins: distinctModeWins.size,
    passAroundGames,
  };
  const track4Milestones = evaluateTrack4Milestones(track4Acc);

  // Step 9: Challenge stats
  const challengeStats = computeChallengeStatsFromRecords(challengeRecords ?? []);

  // Step 10: Track progress for all 5 tracks
  const eligibleClassifications = eligible.map((e) => e.classification);
  const tracks = computeAllTrackProgress(
    eligibleClassifications,
    challengeStats.puzzlesCompleted,
    track4Milestones,
  );

  // Step 11: Chaos gate
  // Count total classified Hard wins (not distinct) for the display counter
  let classifiedHardWinCount = 0;
  for (const c of eligibleClassifications) {
    if (
      c.registryEntry.category === 'classified' &&
      c.cpuDifficulty === 'hard' &&
      c.humanWon
    ) {
      classifiedHardWinCount += 1;
    }
  }
  const chaosGate = computeChaosGate(
    challengeStats.puzzlesCompleted,
    tracks,
    classifiedHardWinCount,
  );

  // Step 12: Event stats
  const eventStats = computeEventStats(
    eligibleClassifications,
    eligible.map((e) => e.record),
  );

  // Step 13: Classified wave stats
  const classifiedWaves = computeClassifiedWaveStats(eligibleClassifications);

  return Object.freeze({
    summary,
    perOpponent,
    perMode: perMode as ReadonlyMap<string, ModeStatBlock>,
    tracks,
    track4Milestones,
    chaosGate,
    challengeStats,
    classifiedWaves,
    eventStats,
  });
}

// ---------------------------------------------------------------------------
// updateCareerSnapshot — Incremental update
// ---------------------------------------------------------------------------

function recomputeAverage(
  oldAvg: number,
  oldCount: number,
  newValue: number,
): number {
  if (oldCount === 0) return newValue;
  return (oldAvg * oldCount + newValue) / (oldCount + 1);
}

function updateOpponentStats(
  existing: PerOpponentStats,
  c: GameClassification,
): PerOpponentStats {
  const newWins = existing.wins + (c.humanWon ? 1 : 0);
  const newLosses = existing.losses + (c.humanLost ? 1 : 0);
  const newDraws = existing.draws + (c.isDraw ? 1 : 0);
  return {
    gamesPlayed: existing.gamesPlayed + 1,
    wins: newWins,
    losses: newLosses,
    draws: newDraws,
    winRate: safePercent(newWins, newWins + newLosses),
  };
}

function updatePassAround(
  existing: PassAroundStats,
  result: string,
): PassAroundStats {
  return {
    gamesPlayed: existing.gamesPlayed + 1,
    whiteWins: existing.whiteWins + (result === 'WHITE_WIN' ? 1 : 0),
    blackWins: existing.blackWins + (result === 'BLACK_WIN' ? 1 : 0),
    draws: existing.draws + (result === 'DRAW' ? 1 : 0),
  };
}

function updateModeStatBlock(
  existing: ModeStatBlock,
  c: GameClassification,
  record: GameRecord,
): ModeStatBlock {
  const newGamesPlayed = existing.gamesPlayed + 1;
  const newTotalPlayTimeMs = existing.totalPlayTimeMs + c.playTimeMs;

  let newWins = existing.wins;
  let newLosses = existing.losses;
  let newDraws = existing.draws;
  let newVsEasy = existing.vsEasy;
  let newVsHard = existing.vsHard;
  let newPassAround = existing.passAround;

  if (c.isPassAround) {
    newPassAround = updatePassAround(existing.passAround, record.result);
  } else {
    if (c.humanWon) newWins += 1;
    if (c.humanLost) newLosses += 1;
    if (c.isDraw) newDraws += 1;

    if (c.cpuDifficulty === 'easy') {
      newVsEasy = updateOpponentStats(existing.vsEasy, c);
    } else if (c.cpuDifficulty === 'hard') {
      newVsHard = updateOpponentStats(existing.vsHard, c);
    }
  }

  return {
    registryId: existing.registryId,
    displayName: existing.displayName,
    category: existing.category,
    gamesPlayed: newGamesPlayed,
    wins: newWins,
    losses: newLosses,
    draws: newDraws,
    winRate: safePercent(newWins, newWins + newLosses),
    vsEasy: newVsEasy,
    vsHard: newVsHard,
    passAround: newPassAround,
    averageGameLengthPlies: recomputeAverage(
      existing.averageGameLengthPlies,
      existing.gamesPlayed,
      c.gameLengthPlies,
    ),
    totalPlayTimeMs: newTotalPlayTimeMs,
  };
}

function updateChallengeStatsIncremental(
  existing: ChallengeStats,
  newRecord: ChallengeRecord,
): ChallengeStats {
  // We cannot accurately update all fields incrementally without the full
  // record set, so we do a best-effort surgical update.
  const newTotalAttempts = existing.totalAttempts + 1;

  if (!newRecord.solved) {
    return { ...existing, totalAttempts: newTotalAttempts };
  }

  // Determine if this is a newly solved puzzle by checking if the current
  // puzzlesCompleted count would change. Since we don't track per-puzzle state
  // in ChallengeStats, we assume each new solved record for a new puzzle ID
  // increments the count. In practice, the Career screen does a full recompute
  // via loadAndComputeCareerSnapshot after game completion, so this incremental
  // path serves as a fast preview.
  let newPuzzlesCompleted = existing.puzzlesCompleted;
  let newAverageRating = existing.averageRating;
  let newBestTimeMs = existing.bestTimeMs;

  // Conservative: assume this might be a newly solved puzzle
  // The full recompute will correct any inaccuracy
  newPuzzlesCompleted += 1;
  newAverageRating =
    newPuzzlesCompleted > 0
      ? (existing.averageRating * existing.puzzlesCompleted + newRecord.rating) /
        newPuzzlesCompleted
      : newRecord.rating;
  if (newBestTimeMs === null || newRecord.solveTimeMs < newBestTimeMs) {
    newBestTimeMs = newRecord.solveTimeMs;
  }

  // Current streak: if this is first attempt on the next consecutive puzzle,
  // extend the streak
  let newCurrentStreak = existing.currentStreak;
  if (
    newRecord.attemptNumber === 1 &&
    newRecord.puzzleId === existing.currentStreak + 1
  ) {
    newCurrentStreak += 1;
  }

  return {
    puzzlesCompleted: newPuzzlesCompleted,
    averageRating: newAverageRating,
    bestTimeMs: newBestTimeMs,
    currentStreak: newCurrentStreak,
    totalAttempts: newTotalAttempts,
  };
}

export function updateCareerSnapshot(
  existing: CareerSnapshot,
  newRecord: GameRecord,
  newChallengeRecord?: ChallengeRecord,
): CareerSnapshot {
  const classification = classifyGameRecord(newRecord);

  // If excluded from career, only update challenge stats if provided
  if (classification.registryEntry.excludeFromCareer) {
    if (newChallengeRecord) {
      return Object.freeze({
        ...existing,
        challengeStats: updateChallengeStatsIncremental(
          existing.challengeStats,
          newChallengeRecord,
        ),
      });
    }
    return existing;
  }

  // --- Update summary ---
  const newTotalGames = existing.summary.totalGames + 1;
  const newTotalPlayTimeMs =
    existing.summary.totalPlayTimeMs + classification.playTimeMs;

  let newWins = existing.summary.wins;
  let newLosses = existing.summary.losses;
  let newDraws = existing.summary.draws;
  let newCurrentWinStreak = existing.summary.currentWinStreak;
  let newLongestWinStreak = existing.summary.longestWinStreak;

  // --- Update per-opponent ---
  let newVsEasy = existing.perOpponent.vsEasy;
  let newVsHard = existing.perOpponent.vsHard;
  let newPassAround = existing.perOpponent.passAround;

  if (classification.isPassAround) {
    newPassAround = updatePassAround(
      existing.perOpponent.passAround,
      newRecord.result,
    );
  } else {
    if (classification.humanWon) newWins += 1;
    if (classification.humanLost) newLosses += 1;
    if (classification.isDraw) newDraws += 1;

    if (classification.cpuDifficulty === 'easy') {
      newVsEasy = updateOpponentStats(existing.perOpponent.vsEasy, classification);
    } else if (classification.cpuDifficulty === 'hard') {
      newVsHard = updateOpponentStats(existing.perOpponent.vsHard, classification);
    }

    // Update streaks for vs-CPU games
    if (classification.humanWon) {
      newCurrentWinStreak = existing.summary.currentWinStreak + 1;
      if (newCurrentWinStreak > existing.summary.longestWinStreak) {
        newLongestWinStreak = newCurrentWinStreak;
      }
    } else {
      newCurrentWinStreak = 0;
    }
  }

  const newSummary: SummaryStats = {
    totalGames: newTotalGames,
    wins: newWins,
    losses: newLosses,
    draws: newDraws,
    winRate: safePercent(newWins, newWins + newLosses),
    longestWinStreak: newLongestWinStreak,
    currentWinStreak: newCurrentWinStreak,
    totalPlayTimeMs: newTotalPlayTimeMs,
    averageGameLengthPlies: recomputeAverage(
      existing.summary.averageGameLengthPlies,
      existing.summary.totalGames,
      classification.gameLengthPlies,
    ),
    averagePlayTimeMs: recomputeAverage(
      existing.summary.averagePlayTimeMs,
      existing.summary.totalGames,
      classification.playTimeMs,
    ),
  };

  const newPerOpponent: PerOpponentBreakdown = {
    vsEasy: newVsEasy,
    vsHard: newVsHard,
    passAround: newPassAround,
  };

  // --- Update per-mode ---
  const newPerMode = new Map(existing.perMode);
  const modeId = classification.registryEntry.id;
  const existingModeStat = newPerMode.get(modeId);
  const defaultModeStat: ModeStatBlock = {
    registryId: classification.registryEntry.id,
    displayName: classification.registryEntry.displayName,
    category: classification.registryEntry.category,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    vsEasy: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, winRate: 0 },
    vsHard: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, winRate: 0 },
    passAround: { gamesPlayed: 0, whiteWins: 0, blackWins: 0, draws: 0 },
    averageGameLengthPlies: 0,
    totalPlayTimeMs: 0,
  };
  newPerMode.set(
    modeId,
    updateModeStatBlock(existingModeStat ?? defaultModeStat, classification, newRecord),
  );

  // --- Update Track 4 milestones ---
  // Recompute Track 4 accumulators from existing data + new record
  // Extract existing milestone values for non-streak milestones
  const existingTrack4 = existing.track4Milestones;
  const existingMilestone27 = existingTrack4[2];
  const existingMilestone29 = existingTrack4[4];
  const existingMilestone30 = existingTrack4[5];

  // For milestones #26 and #31 (streak-based), we use the longestHardWinStreak.
  // The snapshot stores this as milestone[1].currentValue. Since the longest
  // is monotonically non-decreasing, we keep the existing value. The full
  // recompute via loadAndComputeCareerSnapshot will provide exact accuracy.
  const newLongestHardWinStreak = existing.track4Milestones[1]?.currentValue ?? 0;

  // Simple fields that can be incremented
  const newBlackHardWins =
    (existingMilestone27?.currentValue ?? 0) +
    (classification.cpuDifficulty === 'hard' &&
    classification.humanWon &&
    classification.humanColor === 'black' &&
    !classification.isPassAround
      ? 1
      : 0);

  const newPassAroundGames =
    (existingMilestone30?.currentValue ?? 0) +
    (classification.isPassAround ? 1 : 0);

  // Distinct mode wins: need to check if this mode already had a win
  let newDistinctModeWins = existingMilestone29?.currentValue ?? 0;
  if (classification.humanWon && !classification.isPassAround) {
    const modeStatForWinCheck = existing.perMode.get(modeId);
    if (!modeStatForWinCheck || modeStatForWinCheck.wins === 0) {
      newDistinctModeWins += 1;
    }
  }

  const newTrack4Acc: Track4Accumulators = {
    totalGames: newTotalGames,
    longestHardWinStreak: newLongestHardWinStreak,
    blackHardWins: newBlackHardWins,
    distinctModeWins: newDistinctModeWins,
    passAroundGames: newPassAroundGames,
  };
  const newTrack4Milestones = evaluateTrack4Milestones(newTrack4Acc);

  // --- Update challenge stats ---
  const newChallengeStats = newChallengeRecord
    ? updateChallengeStatsIncremental(existing.challengeStats, newChallengeRecord)
    : existing.challengeStats;

  // --- Update tracks ---
  // For tracks 2, 3, 5: increment counters if this game matches
  const existingTracks = existing.tracks;
  const track2 = existingTracks[1];
  const track3 = existingTracks[2];
  const track5 = existingTracks[4];

  let newCrazyHardWins = track2?.currentValue ?? 0;
  if (
    classification.registryEntry.category === 'crazy' &&
    classification.cpuDifficulty === 'hard' &&
    classification.humanWon &&
    !classification.isPassAround
  ) {
    newCrazyHardWins += 1;
  }

  let newChoiceHardWins = track3?.currentValue ?? 0;
  if (
    classification.registryEntry.category === 'choice' &&
    classification.cpuDifficulty === 'hard' &&
    classification.humanWon &&
    !classification.isPassAround
  ) {
    newChoiceHardWins += 1;
  }

  // Track 5: distinct classified hard wins
  // Can only increment if this is a new distinct classified hard win
  let newClassifiedDistinctHardWins = track5?.currentValue ?? 0;
  if (
    classification.registryEntry.category === 'classified' &&
    classification.cpuDifficulty === 'hard' &&
    classification.humanWon &&
    !classification.isPassAround
  ) {
    // Check if this classified game already has a hard win in existing wave stats
    const waveNum = classification.registryEntry.wave;
    if (waveNum !== null) {
      // We don't track per-classified-game wins in the snapshot, so increment
      // optimistically. Full recompute will be accurate.
      newClassifiedDistinctHardWins += 1;
    }
  }

  const newTracks = [
    buildTrackProgress(
      'puzzle-mastery',
      'Puzzle Mastery',
      newChallengeStats.puzzlesCompleted,
      [...TRACK_1_THRESHOLDS],
    ),
    buildTrackProgress('chaos-veteran', 'Chaos Veteran', newCrazyHardWins, [...TRACK_2_THRESHOLDS]),
    buildTrackProgress('rule-bender', 'Rule Bender', newChoiceHardWins, [...TRACK_3_THRESHOLDS]),
    buildTrack4Progress(newTrack4Milestones),
    buildTrackProgress(
      'world-player',
      'World Player',
      newClassifiedDistinctHardWins,
      [...TRACK_5_THRESHOLDS],
    ),
  ];

  // --- Update Chaos Gate ---
  const newClassifiedHardWinCount =
    existing.chaosGate.classifiedHardWins +
    (classification.registryEntry.category === 'classified' &&
    classification.cpuDifficulty === 'hard' &&
    classification.humanWon &&
    !classification.isPassAround
      ? 1
      : 0);
  const newChaosGate = computeChaosGate(
    newChallengeStats.puzzlesCompleted,
    newTracks,
    newClassifiedHardWinCount,
  );

  // --- Update event stats ---
  const newEventStats = new Map(existing.eventStats);
  if (newRecord.eventTriggerLog && newRecord.eventTriggerLog.length > 0) {
    const eventsInThisGame = new Set<string>();
    for (const trigger of newRecord.eventTriggerLog) {
      const eventId = trigger.event;
      eventsInThisGame.add(eventId);

      const stat = newEventStats.get(eventId);
      const mutable: MutableEventStat = stat
        ? { ...stat }
        : {
            eventId,
            triggerCount: 0,
            gamesWithEvent: 0,
            winsWithEvent: 0,
            lossesWithEvent: 0,
          };
      mutable.triggerCount += 1;
      newEventStats.set(eventId, mutable);
    }

    for (const eventId of eventsInThisGame) {
      const stat = newEventStats.get(eventId);
      if (!stat) continue;
      const mutable: MutableEventStat = { ...stat };
      mutable.gamesWithEvent += 1;
      if (classification.humanWon) mutable.winsWithEvent += 1;
      if (classification.humanLost) mutable.lossesWithEvent += 1;
      newEventStats.set(eventId, mutable);
    }
  }

  // --- Update classified wave stats ---
  const newClassifiedWaves = existing.classifiedWaves.map((wave) => {
    if (
      classification.registryEntry.category !== 'classified' ||
      classification.registryEntry.wave !== wave.wave
    ) {
      return wave;
    }
    return {
      ...wave,
      gamesPlayed: wave.gamesPlayed + 1,
      wins: wave.wins + (classification.humanWon ? 1 : 0),
      losses: wave.losses + (classification.humanLost ? 1 : 0),
      draws: wave.draws + (classification.isDraw ? 1 : 0),
      hardWins:
        wave.hardWins +
        (classification.humanWon && classification.cpuDifficulty === 'hard' ? 1 : 0),
    };
  });

  return Object.freeze({
    summary: newSummary,
    perOpponent: newPerOpponent,
    perMode: newPerMode as ReadonlyMap<string, ModeStatBlock>,
    tracks: newTracks,
    track4Milestones: newTrack4Milestones,
    chaosGate: newChaosGate,
    challengeStats: newChallengeStats,
    classifiedWaves: newClassifiedWaves,
    eventStats: newEventStats as ReadonlyMap<string, EventStatEntry>,
  });
}

// ---------------------------------------------------------------------------
// formatPlayTime utility
// ---------------------------------------------------------------------------

export function formatPlayTime(ms: number): string {
  if (ms <= 0) return '0m';

  const totalMinutes = Math.floor(ms / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays > 0) {
    const remainingHours = totalHours % 24;
    return `${String(totalDays)}d ${String(remainingHours)}h`;
  }
  if (totalHours > 0) {
    const remainingMinutes = totalMinutes % 60;
    return `${String(totalHours)}h ${String(remainingMinutes)}m`;
  }
  return `${String(totalMinutes)}m`;
}

// ---------------------------------------------------------------------------
// Data loading adapter (async I/O boundary)
// ---------------------------------------------------------------------------

export async function loadAndComputeCareerSnapshot(): Promise<CareerSnapshot> {
  const [gameRecords, challengeRecords] = await Promise.all([
    getAllGameRecords(),
    getAllChallengeRecords(),
  ]);
  return computeCareerSnapshot(gameRecords, challengeRecords);
}
