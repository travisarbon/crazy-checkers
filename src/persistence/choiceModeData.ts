/**
 * Static data for all 40 Choice mode definitions.
 * Maps CrazyEvent values to Choice mode display metadata.
 *
 * Sourced from Design Document §2.4 and Events and Choice Mode Playbook.
 */

import { CrazyEvent } from '../engine/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TrackId =
  | 'puzzle-mastery'
  | 'chaos-veteran'
  | 'rule-bender'
  | 'lifer'
  | 'world-player';

export interface ChoiceModeDefinition {
  readonly choiceNumber: number;
  readonly event: CrazyEvent | null;
  readonly displayName: string;
  readonly description: string;
  readonly track: TrackId;
  readonly unlockThreshold: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

export const CHOICE_MODE_DATA: readonly ChoiceModeDefinition[] = [
  // Track 1 — Puzzle Mastery (Choice modes 1–8)
  { choiceNumber: 1, event: CrazyEvent.KingForADay, displayName: 'Revolution', description: 'All pawns are permanently promoted to kings', track: 'puzzle-mastery', unlockThreshold: 'Complete 1 challenge' },
  { choiceNumber: 2, event: CrazyEvent.LiveGrenade, displayName: 'Boom Box', description: 'Every capture triggers an explosion destroying adjacent pieces', track: 'puzzle-mastery', unlockThreshold: 'Complete 15 challenges' },
  { choiceNumber: 3, event: CrazyEvent.HotPotato, displayName: 'Imposter', description: 'Every 3 turns, the moving piece switches color', track: 'puzzle-mastery', unlockThreshold: 'Complete 29 challenges' },
  { choiceNumber: 4, event: CrazyEvent.ChecksMix, displayName: 'Blender', description: 'Every 3 turns, all pieces shuffle to random positions', track: 'puzzle-mastery', unlockThreshold: 'Complete 43 challenges' },
  { choiceNumber: 5, event: CrazyEvent.OppositeDay, displayName: 'Mirror World', description: 'Anti-checkers: you win by losing all your pieces', track: 'puzzle-mastery', unlockThreshold: 'Complete 57 challenges' },
  { choiceNumber: 6, event: CrazyEvent.NoTouching, displayName: 'Class Divides', description: 'Pawns cannot capture kings', track: 'puzzle-mastery', unlockThreshold: 'Complete 71 challenges' },
  { choiceNumber: 7, event: CrazyEvent.UpInTheAir, displayName: 'Frequent Flyer', description: 'All pieces gain flying diagonal movement', track: 'puzzle-mastery', unlockThreshold: 'Complete 85 challenges' },
  { choiceNumber: 8, event: null, displayName: 'Extra Crazy', description: 'A random event triggers on every single jump', track: 'puzzle-mastery', unlockThreshold: 'Complete 99 challenges' },

  // Track 2 — Chaos Veteran (Choice modes 9–16)
  { choiceNumber: 9, event: CrazyEvent.StepBack, displayName: 'Moonwalk', description: 'Pawns can always capture backwards but never move backwards', track: 'chaos-veteran', unlockThreshold: 'Win 1 Crazy game vs. Hard CPU' },
  { choiceNumber: 10, event: CrazyEvent.RushHour, displayName: 'Fast Lane', description: 'Pawns can move two squares forward', track: 'chaos-veteran', unlockThreshold: 'Win 3 Crazy games vs. Hard CPU' },
  { choiceNumber: 11, event: CrazyEvent.PromotionParty, displayName: 'Royal Court', description: 'Expanded promotion zone — pawns can promote on either of the two farthest rows', track: 'chaos-veteran', unlockThreshold: 'Win 6 Crazy games vs. Hard CPU' },
  { choiceNumber: 12, event: CrazyEvent.SafeHaven, displayName: 'Sanctuary', description: 'Corner-adjacent squares permanently protect pieces from capture', track: 'chaos-veteran', unlockThreshold: 'Win 10 Crazy games vs. Hard CPU' },
  { choiceNumber: 13, event: CrazyEvent.Demotion, displayName: 'Common Folk', description: 'Promotion is permanently disabled — a pawn-only game', track: 'chaos-veteran', unlockThreshold: 'Win 15 Crazy games vs. Hard CPU' },
  { choiceNumber: 14, event: CrazyEvent.Quicksand, displayName: 'Tar Pit', description: 'Edge squares are permanently sticky — pieces on the edge cannot move', track: 'chaos-veteran', unlockThreshold: 'Win 21 Crazy games vs. Hard CPU' },
  { choiceNumber: 15, event: CrazyEvent.DealersChoice, displayName: 'Non-Aggression Pact', description: 'Captures are never mandatory — players always choose freely', track: 'chaos-veteran', unlockThreshold: 'Win 28 Crazy games vs. Hard CPU' },
  { choiceNumber: 16, event: CrazyEvent.FrozenAssets, displayName: 'Ice Age', description: 'Kings cannot move once promoted — promotion becomes a trap', track: 'chaos-veteran', unlockThreshold: 'Win 36 Crazy games vs. Hard CPU' },

  // Track 3 — Rule Bender (Choice modes 17–24)
  { choiceNumber: 17, event: CrazyEvent.CrownThief, displayName: 'Pickpocket', description: 'Capturing a king steals its crown', track: 'rule-bender', unlockThreshold: 'Win 1 Choice game vs. Hard CPU' },
  { choiceNumber: 18, event: CrazyEvent.Bodyguard, displayName: 'Secret Service', description: 'Kings are protected from capture when adjacent to a friendly pawn', track: 'rule-bender', unlockThreshold: 'Win 4 Choice games vs. Hard CPU' },
  { choiceNumber: 19, event: CrazyEvent.ForcedMarch, displayName: 'Point Man', description: 'The most advanced piece must move if possible', track: 'rule-bender', unlockThreshold: 'Win 8 Choice games vs. Hard CPU' },
  { choiceNumber: 20, event: CrazyEvent.GhostWalk, displayName: 'Phantom Zone', description: 'Pieces can pass through friendly pieces during movement', track: 'rule-bender', unlockThreshold: 'Win 13 Choice games vs. Hard CPU' },
  { choiceNumber: 21, event: CrazyEvent.Leapfrog, displayName: 'Hop, Skip, Jump', description: 'Pieces can jump over friendly pieces', track: 'rule-bender', unlockThreshold: 'Win 19 Choice games vs. Hard CPU' },
  { choiceNumber: 22, event: CrazyEvent.RoyalDecree, displayName: 'Absolute Monarchy', description: 'Only kings can move — pawns are frozen when any king is present', track: 'rule-bender', unlockThreshold: 'Win 26 Choice games vs. Hard CPU' },
  { choiceNumber: 23, event: CrazyEvent.Sentry, displayName: 'Watchtower', description: 'Kings pin adjacent enemy pawns — pinned pawns cannot move', track: 'rule-bender', unlockThreshold: 'Win 34 Choice games vs. Hard CPU' },
  { choiceNumber: 24, event: CrazyEvent.Conscription, displayName: 'Draft Day', description: 'Captured pieces switch sides instead of being removed', track: 'rule-bender', unlockThreshold: 'Win 43 Choice games vs. Hard CPU' },

  // Track 4 — Lifer (Choice modes 25–32)
  { choiceNumber: 25, event: CrazyEvent.Ricochet, displayName: 'Pinball', description: 'Capturing pieces bounce to the next diagonal square after a jump', track: 'lifer', unlockThreshold: 'Play 50 total games' },
  { choiceNumber: 26, event: CrazyEvent.Landmine, displayName: 'Minefield', description: 'Center squares are mined — any piece entering is destroyed', track: 'lifer', unlockThreshold: 'Win 5 games in a row vs. Hard CPU' },
  { choiceNumber: 27, event: CrazyEvent.TollRoad, displayName: 'Eye for an Eye', description: 'Each capture costs your least advanced piece as a toll', track: 'lifer', unlockThreshold: 'Win 10 games as Black vs. Hard CPU' },
  { choiceNumber: 28, event: CrazyEvent.Stampede, displayName: 'Bull Rush', description: 'All pawns instantly advance one square forward', track: 'lifer', unlockThreshold: 'Play 100 total games' },
  { choiceNumber: 29, event: CrazyEvent.Sacrifice, displayName: 'Martyrdom', description: 'When you lose a piece, your most advanced pawn promotes to king', track: 'lifer', unlockThreshold: 'Win a game in 5 different modes' },
  { choiceNumber: 30, event: CrazyEvent.SwapMeet, displayName: 'Switcheroo', description: 'Two opposing pieces (one White, one Black) swap positions', track: 'lifer', unlockThreshold: 'Win 25 games in Pass Around' },
  { choiceNumber: 31, event: CrazyEvent.ChainReaction, displayName: 'Domino Effect', description: 'Captures trigger chain reactions on adjacent pieces', track: 'lifer', unlockThreshold: 'Achieve a 10-game win streak vs. Hard CPU' },
  { choiceNumber: 32, event: CrazyEvent.Backfire, displayName: 'Friendly Fire', description: 'The capturing piece is always removed after making a capture', track: 'lifer', unlockThreshold: 'Play 200 total games' },

  // Track 5 — World Player (Choice modes 33–40)
  { choiceNumber: 33, event: CrazyEvent.TimeBomb, displayName: 'Ticking Clock', description: 'Bomb markers are placed on pieces — marked pieces explode after a countdown', track: 'world-player', unlockThreshold: 'Win 1 Classified game vs. Hard CPU' },
  { choiceNumber: 34, event: CrazyEvent.Reinforcements, displayName: 'Call to Arms', description: 'New pieces appear on the back row', track: 'world-player', unlockThreshold: 'Win 5 Classified games vs. Hard CPU' },
  { choiceNumber: 35, event: CrazyEvent.Haunted, displayName: 'Graveyard', description: 'Captured pieces haunt the square they died on', track: 'world-player', unlockThreshold: 'Win 10 Classified games vs. Hard CPU' },
  { choiceNumber: 36, event: CrazyEvent.DoubleTime, displayName: 'Speed Demon', description: 'Every turn is a double turn — both players get two moves per turn', track: 'world-player', unlockThreshold: 'Win 20 Classified games vs. Hard CPU' },
  { choiceNumber: 37, event: CrazyEvent.Wormhole, displayName: 'Portal', description: 'Pairs of squares become linked teleporters', track: 'world-player', unlockThreshold: 'Win 30 Classified games vs. Hard CPU' },
  { choiceNumber: 38, event: CrazyEvent.FlippedScript, displayName: 'Turned Tables', description: 'Promotion rows are swapped — each player promotes on their own back row', track: 'world-player', unlockThreshold: 'Win 40 Classified games vs. Hard CPU' },
  { choiceNumber: 39, event: CrazyEvent.ShrinkingBoard, displayName: 'Pressure Cooker', description: 'The board shrinks by removing edge squares', track: 'world-player', unlockThreshold: 'Win 50 Classified games vs. Hard CPU' },
  { choiceNumber: 40, event: CrazyEvent.MarchingOrders, displayName: 'Rank and File', description: 'All movement is orthogonal — pieces move up, down, left, and right instead of diagonally', track: 'world-player', unlockThreshold: 'Win all 64 Classified games vs. Hard CPU' },
];
