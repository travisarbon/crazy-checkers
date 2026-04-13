/**
 * Per-event sound mapping for Crazy events.
 *
 * Maps each `CrazyEvent` to an event-specific audio asset. Events are grouped
 * into thematic sound categories (impact, shuffle, magic, freeze, whoosh,
 * shield, special) and share base sounds within each group to keep the asset
 * count manageable.
 *
 * Events without an entry fall back to the generic `SoundEvent.EventTrigger`
 * via `GameScreen`'s activation handler.
 */

import { CrazyEvent } from '../engine/types';

const BASE = import.meta.env.BASE_URL;

export interface EventSound {
  readonly url: string;
  readonly volume: number;
}

const eventSfx = (filename: string, volume = 1.0): EventSound => ({
  url: `${BASE}audio/sfx/events/${filename}`,
  volume,
});

/**
 * Per-event sound mapping. Keys are `CrazyEvent` identifiers; values are
 * `EventSound` descriptors referencing files under
 * `public/audio/sfx/events/`.
 */
export const EVENT_SOUND_MAP: Partial<Record<CrazyEvent, EventSound>> = {
  // Impact group
  [CrazyEvent.LiveGrenade]: eventSfx('impact-explosion.mp3'),
  [CrazyEvent.Landmine]: eventSfx('impact-explosion.mp3', 0.9),
  [CrazyEvent.ChainReaction]: eventSfx('impact-chain.mp3'),
  [CrazyEvent.Backfire]: eventSfx('impact-explosion.mp3', 0.8),
  [CrazyEvent.TimeBomb]: eventSfx('impact-tick.mp3'),

  // Shuffle group
  [CrazyEvent.ChecksMix]: eventSfx('shuffle-rearrange.mp3'),
  [CrazyEvent.SwapMeet]: eventSfx('shuffle-rearrange.mp3', 0.9),
  [CrazyEvent.Stampede]: eventSfx('shuffle-march.mp3'),
  [CrazyEvent.Reinforcements]: eventSfx('shuffle-place.mp3'),

  // Magic group
  [CrazyEvent.FlippedScript]: eventSfx('magic-transform.mp3'),
  [CrazyEvent.Demotion]: eventSfx('magic-transform.mp3', 0.9),
  [CrazyEvent.PromotionParty]: eventSfx('magic-promote.mp3'),
  [CrazyEvent.CrownThief]: eventSfx('magic-steal.mp3'),
  [CrazyEvent.Sacrifice]: eventSfx('magic-promote.mp3', 0.8),

  // Freeze group
  [CrazyEvent.Quicksand]: eventSfx('freeze-ice.mp3'),
  [CrazyEvent.FrozenAssets]: eventSfx('freeze-ice.mp3'),
  [CrazyEvent.RoyalDecree]: eventSfx('freeze-decree.mp3'),
  [CrazyEvent.Sentry]: eventSfx('freeze-pin.mp3'),

  // Whoosh group
  [CrazyEvent.StepBack]: eventSfx('whoosh-move.mp3'),
  [CrazyEvent.GhostWalk]: eventSfx('whoosh-ghost.mp3'),
  [CrazyEvent.Leapfrog]: eventSfx('whoosh-jump.mp3'),
  [CrazyEvent.RushHour]: eventSfx('whoosh-rush.mp3'),
  [CrazyEvent.DoubleTime]: eventSfx('whoosh-move.mp3', 0.9),
  [CrazyEvent.MarchingOrders]: eventSfx('whoosh-march.mp3'),
  [CrazyEvent.ForcedMarch]: eventSfx('whoosh-march.mp3', 0.9),
  [CrazyEvent.Wormhole]: eventSfx('whoosh-warp.mp3'),
  [CrazyEvent.Ricochet]: eventSfx('whoosh-bounce.mp3'),

  // Shield group
  [CrazyEvent.Bodyguard]: eventSfx('shield-protect.mp3'),
  [CrazyEvent.SafeHaven]: eventSfx('shield-protect.mp3', 0.9),

  // Special group
  [CrazyEvent.OppositeDay]: eventSfx('special-reverse.mp3'),
  [CrazyEvent.UpInTheAir]: eventSfx('special-float.mp3'),
  [CrazyEvent.NoTouching]: eventSfx('special-barrier.mp3'),
  [CrazyEvent.KingForADay]: eventSfx('special-crown.mp3'),
  [CrazyEvent.HotPotato]: eventSfx('special-hot.mp3'),
  [CrazyEvent.DealersChoice]: eventSfx('special-card.mp3'),
  [CrazyEvent.TollRoad]: eventSfx('special-toll.mp3'),
  [CrazyEvent.ShrinkingBoard]: eventSfx('special-shrink.mp3'),
  [CrazyEvent.Haunted]: eventSfx('special-ghost.mp3'),
  [CrazyEvent.DoubleTrouble]: eventSfx('special-double.mp3'),
  [CrazyEvent.Conscription]: eventSfx('special-recruit.mp3'),
};

/**
 * Returns the event-specific sound for a CrazyEvent, or null if the event
 * should fall back to the generic EventTrigger SFX.
 */
export function getEventSound(event: CrazyEvent): EventSound | null {
  return EVENT_SOUND_MAP[event] ?? null;
}
