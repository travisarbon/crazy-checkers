/**
 * Centralized event content data for all 40 Crazy Checkers events.
 * Consumed by CrazyScreen, ChaosScreen, ChoiceDetailScreen, and EventReferencePanel.
 *
 * Note: Per-event diagrams were removed after initial implementation because
 * hand-crafted board positions did not effectively illustrate event mechanics
 * at small sizes. Strategic position diagrams (Classic mode piece movement,
 * Classified game positions) are retained in their respective screens.
 */

import { CrazyEvent } from '../engine/types';
import { EVENT_DISPLAY_NAMES, EVENT_FLAVOR_TEXT, EVENT_DURATIONS } from '../engine/events';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EventDataEntry {
  readonly eventType: CrazyEvent;
  readonly eventNumber: number;
  readonly name: string;
  readonly flavorText: string;
  readonly durationText: string;
  readonly durationPlies: number;
  readonly tier: 1 | 2 | 3;
  readonly mechanicalEffect: string;
  readonly choiceModeName: string;
  readonly choiceModeDescription: string;
  readonly stackingNotes: readonly string[];
}

// ---------------------------------------------------------------------------
// Duration text helper
// ---------------------------------------------------------------------------

function durationText(plies: number): string {
  if (plies === 0) return 'Instant';
  if (plies === -1) return 'Condition-based';
  if (plies === 2) return '1 round (2 plies)';
  if (plies === 4) return '2 rounds (4 plies)';
  if (plies === 16) return '8 rounds (16 plies)';
  return `${String(plies)} plies`;
}

// ---------------------------------------------------------------------------
// Event data entries
// ---------------------------------------------------------------------------

function entry(
  eventNumber: number,
  eventType: CrazyEvent,
  tier: 1 | 2 | 3,
  mechanicalEffect: string,
  choiceModeName: string,
  choiceModeDescription: string,
  stackingNotes: readonly string[],
): EventDataEntry {
  return {
    eventType,
    eventNumber,
    name: EVENT_DISPLAY_NAMES[eventType],
    flavorText: EVENT_FLAVOR_TEXT[eventType],
    durationText: durationText(EVENT_DURATIONS[eventType]),
    durationPlies: EVENT_DURATIONS[eventType],
    tier,
    mechanicalEffect,
    choiceModeName,
    choiceModeDescription,
    stackingNotes,
  };
}

export const EVENT_DATA: readonly EventDataEntry[] = [
  // Event 1 — King for a Day
  entry(1, CrazyEvent.KingForADay, 2,
    'All pawns on the board temporarily become kings for 1 round. They gain full diagonal movement and capture in all four directions. After the round ends, surviving temporary kings revert to pawns.',
    'Revolution',
    'All pawns are permanently promoted to kings. The game becomes an all-king endgame from the moment the event fires.',
    ['Nullifies No Touching (no pawns exist during the event)', 'Combines with Up in the Air for full flying king movement', 'Redundant with Promotion Party (already kings)'],
  ),
  // Event 2 — Live Grenade
  entry(2, CrazyEvent.LiveGrenade, 2,
    'The next capture by any player triggers an explosion that destroys all pieces adjacent to the landing square. The capturing piece survives. Lasts until the next capture occurs.',
    'Boom Box',
    'Every capture triggers an explosion destroying adjacent pieces. Permanent explosive captures change the entire strategic landscape.',
    ['Destruction takes precedence over Conscription for adjacent pieces', 'Flying captures (Up in the Air) still trigger the grenade', 'Blocked captures (No Touching) delay detonation'],
  ),
  // Event 3 — Hot Potato
  entry(3, CrazyEvent.HotPotato, 2,
    'After a piece moves, it switches to the opponent\'s color. The piece retains its type (pawn or king). Lasts for 1 round. Strategic movement becomes critical as every move strengthens the opponent.',
    'Imposter',
    'Every piece that moves permanently switches color. The game becomes about forcing the opponent to move while preserving your own pieces.',
    ['Double switch with Conscription returns piece to original color', 'Piece destruction (Live Grenade) takes precedence over color switch'],
  ),
  // Event 4 — Checks Mix
  entry(4, CrazyEvent.ChecksMix, 2,
    'All pieces on the board are instantly shuffled to random valid dark squares. Piece colors and types are preserved. No pawns land on their own promotion row. No mandatory captures result from the shuffle.',
    'Blender',
    'Pieces shuffle to random positions every 3 turns. Continuous board disruption makes long-term planning impossible.',
    ['Shuffle applies to kinged board during King for a Day', 'Live Grenade remains armed after shuffle', 'Hot Potato applies on shuffled positions'],
  ),
  // Event 5 — Opposite Day
  entry(5, CrazyEvent.OppositeDay, 2,
    'The win condition is inverted for 8 rounds. Instead of trying to capture all opponent pieces, you now lose if you capture all of them. Anti-checkers rules apply — try to lose your pieces or get blocked.',
    'Mirror World',
    'Win condition is permanently inverted. The entire game is played as anti-checkers from the start.',
    ['Newer instance takes precedence if stacked', 'Independent of all other movement/capture events'],
  ),
  // Event 6 — Up in the Air
  entry(6, CrazyEvent.UpInTheAir, 3,
    'All pieces gain flying movement for 1 round. Pieces can move any number of squares along a diagonal (like a bishop in chess), not just one square. Captures still require jumping over an adjacent piece.',
    'Frequent Flyer',
    'All pieces permanently have flying diagonal movement. Massive increase in mobility transforms the game into a long-range tactical battle.',
    ['Combines with Step-Back for backward flying captures', 'Combines with King for a Day for full flying king powers on all pieces'],
  ),
  // Event 7 — No Touching!
  entry(7, CrazyEvent.NoTouching, 1,
    'Pawns cannot capture kings for 1 round. Kings remain capturable by other kings. This protects crowned pieces from pawn attacks, making king safety paramount.',
    'Class Divides',
    'Pawns can never capture kings. Permanent class hierarchy makes king creation even more critical.',
    ['Nullified during King for a Day (no pawns exist)', 'Nullifies Crown Thief (pawns can\'t interact with kings)', 'Partially redundant with Bodyguard'],
  ),
  // Event 8 — Step-Back
  entry(8, CrazyEvent.StepBack, 1,
    'Pawns gain the ability to capture backward diagonally for 2 rounds. Pawns still cannot move backward without capturing. Forward and backward captures can be mixed in a single multi-jump chain.',
    'Moonwalk',
    'Pawns can permanently capture in all four diagonal directions, though they still only move forward without a capture.',
    ['Nullified during King for a Day (all pieces already kings)', 'Combines with Up in the Air for backward flying captures'],
  ),
  // Event 9 — Flipped Script
  entry(9, CrazyEvent.FlippedScript, 3,
    'Promotion rows swap permanently. White promotes on row 7 (own back row) instead of row 0, and Black promotes on row 0. This inverts the strategic direction of pawn advancement.',
    'Turned Tables',
    'Promotion rows are permanently swapped from the start of the game. Retreat becomes advancement.',
    ['Shuffled pieces auto-promote if landing on new promotion row', 'Backward movement becomes strategically powerful'],
  ),
  // Event 10 — Marching Orders
  entry(10, CrazyEvent.MarchingOrders, 3,
    'All pieces move orthogonally (horizontally and vertically) instead of diagonally, permanently. The entire game grid changes to use all 64 squares instead of just the 32 dark squares.',
    'Rank and File',
    'Permanent orthogonal movement from game start. Completely transforms the spatial dynamics of the game.',
    ['Flying + orthogonal movement is possible with Up in the Air', 'Changes the full playing grid to 64 squares'],
  ),
  // Event 11 — Dealer's Choice
  entry(11, CrazyEvent.DealersChoice, 1,
    'Each player receives one opportunity to skip a mandatory capture. When a jump is available but you don\'t want to take it, you can invoke your skip to make a simple move instead. Once both skips are used, the event ends.',
    'Non-Aggression Pact',
    'Players can always choose to skip mandatory captures. Mandatory capture rule is effectively removed.',
    ['Allows strategic avoidance of Live Grenade detonation', 'Works independently of all other events'],
  ),
  // Event 12 — Bodyguard
  entry(12, CrazyEvent.Bodyguard, 1,
    'Kings that are diagonally adjacent to at least one friendly pawn cannot be captured for 2 rounds. The pawns act as bodyguards, protecting their king from enemy jumps.',
    'Secret Service',
    'Kings adjacent to friendly pawns are permanently protected from capture. Guard formations become the core strategy.',
    ['All captures blocked when King for a Day is active (all pieces are kings with adjacent allies)', 'Partially redundant with No Touching'],
  ),
  // Event 13 — Quicksand
  entry(13, CrazyEvent.Quicksand, 1,
    'Edge squares become sticky for 8 rounds. Pieces that land on edge squares during the event become stuck and cannot move until the event expires. Pieces already on edges when the event fires are exempt.',
    'Tar Pit',
    'Edge squares are permanently sticky. Any piece landing on an edge is permanently immobilized.',
    ['Exempt pieces already on edges can leave freely', 'Works independently of most other events'],
  ),
  // Event 14 — Conscription
  entry(14, CrazyEvent.Conscription, 2,
    'Captured pieces switch sides instead of being removed from the board for 2 rounds. When you jump an opponent\'s piece, it changes to your color and remains on its square. Multi-jumps convert each jumped piece.',
    'Draft Day',
    'All captured pieces permanently switch sides. Captures become recruiting, fundamentally changing material dynamics.',
    ['Live Grenade destruction takes precedence for adjacent pieces', 'Double switch with Hot Potato returns piece to original color'],
  ),
  // Event 15 — Ghost Walk
  entry(15, CrazyEvent.GhostWalk, 2,
    'Pieces can pass through friendly pieces during simple moves (non-capturing moves) for 1 round. You can move to a square occupied by a friendly piece and continue through it. Captures still require jumping over enemies.',
    'Phantom Zone',
    'Pieces can permanently pass through allies. Friendly blocking no longer constrains movement.',
    ['Combines with Up in the Air for diagonal ghosting through allies', 'Does not affect captures — jumping mechanics unchanged'],
  ),
  // Event 16 — Landmine
  entry(16, CrazyEvent.Landmine, 2,
    'The center 4 squares (14, 15, 18, 19) become mined for 2 rounds. Any piece that lands on a mined square is immediately destroyed. Pieces already on those squares when the event fires are safe.',
    'Minefield',
    'Center squares are permanently mined. The board center becomes a permanent danger zone.',
    ['Pieces already on center are safe when event fires', 'Shuffled pieces landing on mines are destroyed', 'Dangerous in combination with Wormhole portals'],
  ),
  // Event 17 — Leapfrog
  entry(17, CrazyEvent.Leapfrog, 2,
    'Pieces can jump over friendly pieces as a non-capturing move for 1 round. The jumped friendly piece remains on the board. This allows chaining through your own pieces for extra distance.',
    'Hop, Skip, Jump',
    'Permanent friendly-piece jumping. Pieces can always leap over allies for positioning.',
    ['Partially redundant with Ghost Walk for simple moves but allows jump chains', 'Does not remove jumped friendly pieces'],
  ),
  // Event 18 — Frozen Assets
  entry(18, CrazyEvent.FrozenAssets, 1,
    'All kings are frozen and cannot move for 2 rounds. Only pawns can be moved. Kings remain on the board but are immobilized. If a player has only kings, they are stuck.',
    'Ice Age',
    'Kings are permanently frozen. Only pawns can ever move, making promotion a liability.',
    ['Directly contradicts Royal Decree — both active simultaneously cancel each other out', 'Frozen kings still project Sentry zones'],
  ),
  // Event 19 — Double Time
  entry(19, CrazyEvent.DoubleTime, 2,
    'Each player takes 2 consecutive moves per turn for 1 round. After making your first move, you immediately make a second move before passing to your opponent. Both moves follow standard rules.',
    'Speed Demon',
    'Players permanently take 2 moves per turn. Double the actions dramatically accelerates the game.',
    ['Complex interaction with Hot Potato — color switch happens after each move', 'Two captures can trigger two separate events'],
  ),
  // Event 20 — Safe Haven
  entry(20, CrazyEvent.SafeHaven, 1,
    'Four near-corner squares (6, 8, 25, 27) become safe zones for 2 rounds. Pieces on these squares cannot be captured. They can still move normally but are invulnerable while on safe squares.',
    'Sanctuary',
    'Safe haven squares permanently protect pieces from capture. Controlling these squares becomes a key objective.',
    ['Independent of most other events', 'Pieces can still be moved off safe squares voluntarily'],
  ),
  // Event 21 — Chain Reaction
  entry(21, CrazyEvent.ChainReaction, 2,
    'The next capture triggers a chain reaction that recursively removes all adjacent same-color pieces of the captured piece. The cascade continues outward until no more adjacent same-color pieces remain.',
    'Domino Effect',
    'Every capture triggers a chain reaction. Clustering same-color pieces becomes extremely dangerous.',
    ['Chain reaction resolves first, then Live Grenade explosion', 'Conscription converts pieces before chain reaction check'],
  ),
  // Event 22 — Promotion Party
  entry(22, CrazyEvent.PromotionParty, 1,
    'The promotion zone expands for 2 rounds. White can promote on rows 0 and 1 (top two rows), Black on rows 6 and 7 (bottom two rows). Reaching the expanded zone immediately promotes pawns to kings.',
    'Royal Court',
    'Expanded promotion zones are permanent. Pawns promote one row earlier, making king creation faster.',
    ['Redundant during King for a Day (all pieces already kings)', 'Works with Flipped Script\'s swapped promotion rows'],
  ),
  // Event 23 — Reinforcements
  entry(23, CrazyEvent.Reinforcements, 2,
    'Each player instantly receives up to 2 new pawns placed on empty squares of their back row. If the back row is full, fewer pawns are placed. This is an instant event — pieces appear immediately.',
    'Call to Arms',
    'Players receive reinforcement pawns every few turns permanently. Continuous troop replenishment prevents material depletion.',
    ['Pawns auto-promote if placed on Flipped Script back row', 'New pawns appear instantly and can be moved next turn'],
  ),
  // Event 24 — Wormhole
  entry(24, CrazyEvent.Wormhole, 2,
    'Four pairs of wormhole portals appear on the board for 2 rounds. When a piece lands on a wormhole entrance, it instantly teleports to the paired exit square. Portals reshuffle every 10 turns.',
    'Portal',
    'Wormhole portals are permanently active, enabling instant teleportation across the board.',
    ['Dangerous in combination with Landmine — teleporting onto a mine destroys the piece', 'Works with Hot Potato — color switches after teleportation'],
  ),
  // Event 25 — Demotion
  entry(25, CrazyEvent.Demotion, 1,
    'All kings on the board are instantly demoted to pawns. This is a permanent, instant event — the demotion cannot be reversed. Any king that was created before or during this event becomes a pawn.',
    'Common Folk',
    'All kings are immediately and permanently demoted. The game resets to an all-pawn state.',
    ['Newest event wins vs King for a Day — Demotion after KfaD reverts all pieces', 'Undoes Crown Thief promotions'],
  ),
  // Event 26 — Time Bomb
  entry(26, CrazyEvent.TimeBomb, 2,
    'A random piece receives a 3-ply countdown timer. When the timer reaches zero, the piece explodes, destroying itself and all adjacent pieces. The bomb is visible to both players via a visual indicator.',
    'Ticking Clock',
    'Bombs are continuously placed on random pieces. Constant explosive threat forces defensive positioning.',
    ['Bomb transfers to captured piece under Conscription', 'Explosion radius matches Live Grenade adjacency pattern'],
  ),
  // Event 27 — Forced March
  entry(27, CrazyEvent.ForcedMarch, 1,
    'You must move your most advanced piece (closest to the opponent\'s side) when possible for 2 rounds. If that piece has no legal moves, the constraint passes to the next most-advanced piece.',
    'Point Man',
    'Players must always move their most advanced piece. The frontline piece is permanently committed to leading the charge.',
    ['Constraint passes to next piece if most-advanced is stuck (Quicksand, Frozen Assets)', 'Works independently of capture-related events'],
  ),
  // Event 28 — Ricochet
  entry(28, CrazyEvent.Ricochet, 2,
    'After capturing, the capturing piece bounces 1 additional square in the direction of travel. If the bounce square is occupied or off-board, the piece stays at the capture landing. Lasts 1 round.',
    'Pinball',
    'All captures permanently cause a ricochet bounce. Pieces always slide one extra square after jumping.',
    ['Bounce can trigger Wormhole teleportation', 'Bounce can land on Landmine (piece destroyed)', 'Bounce onto promotion row promotes the piece'],
  ),
  // Event 29 — Crown Thief
  entry(29, CrazyEvent.CrownThief, 2,
    'When a pawn captures a king, the pawn is immediately promoted to a king regardless of its position on the board. The thief steals the crown. Lasts 2 rounds.',
    'Pickpocket',
    'Pawns permanently steal crowns from captured kings. Every king capture results in instant promotion.',
    ['Nullified by No Touching (pawns can\'t capture kings)', 'No theft during King for a Day (no pawns to steal with)'],
  ),
  // Event 30 — Stampede
  entry(30, CrazyEvent.Stampede, 2,
    'All pawns instantly advance 1 square forward in their movement direction. Pawns that reach the back row are promoted. Pawns blocked by other pieces do not move. Instant event, fires every 3 turns in Choice mode.',
    'Bull Rush',
    'Periodic stampedes advance all pawns forward. Continuous forward pressure prevents stalemates.',
    ['Frozen kings are unaffected (they\'re kings, not pawns)', 'Pawns pushed into enemy territory create immediate tactical pressure'],
  ),
  // Event 31 — Toll Road
  entry(31, CrazyEvent.TollRoad, 2,
    'Each capture costs the capturing player their least-advanced piece (closest to their own side). The toll piece is removed from the board. If you have only one piece, the toll is waived. Lasts 2 rounds.',
    'Eye for an Eye',
    'Every capture permanently costs a piece. Material exchange is always 1-for-2, requiring careful calculation.',
    ['Strategic synergy with Dealer\'s Choice — skip a capture to avoid paying the toll', 'Toll piece is the least-advanced, preserving forward progress'],
  ),
  // Event 32 — Swap Meet
  entry(32, CrazyEvent.SwapMeet, 2,
    'Two random pairs of opposing pieces swap positions instantly. A White piece trades squares with a Black piece. Swapped pieces retain their type. Instant event, fires every 4 turns in Choice mode.',
    'Switcheroo',
    'Random piece swaps occur every 4 turns permanently. Constant position disruption prevents stable formations.',
    ['Swapped pieces do not auto-promote', 'Time Bomb timer transfers with swapped piece'],
  ),
  // Event 33 — Royal Decree
  entry(33, CrazyEvent.RoyalDecree, 1,
    'Only kings can move when at least one king is present on your side for 2 rounds. Pawns are frozen while you have kings. If all your kings are captured, pawns can move again.',
    'Absolute Monarchy',
    'Only kings can ever move when present. Pawns are permanently subordinate to royalty.',
    ['Directly contradicts Frozen Assets — both active simultaneously cancel each other out', 'Forces king-focused strategy'],
  ),
  // Event 34 — Backfire
  entry(34, CrazyEvent.Backfire, 2,
    'Pieces can capture their own friendly pieces for 1 round. Jumping over a friendly piece removes it just like an enemy capture. Mandatory capture applies to all jumps including friendly ones.',
    'Friendly Fire',
    'Pieces can permanently capture allies. Friendly fire adds a dangerous new dimension to every jump.',
    ['Friendly captures trigger Conscription (captured allies switch sides — effectively removed)', 'Mandatory capture includes friendly jumps'],
  ),
  // Event 35 — Sentry
  entry(35, CrazyEvent.Sentry, 1,
    'Kings project zones of control that pin adjacent enemy pawns for 2 rounds. Enemy pawns diagonally adjacent to your king cannot move. Kings are unaffected by enemy sentry zones.',
    'Watchtower',
    'Kings permanently project pinning zones. Adjacent enemy pawns are always frozen by nearby kings.',
    ['Frozen kings (Frozen Assets) still project sentry zones', 'Nullified during King for a Day (all pieces are kings, no pawns to pin)'],
  ),
  // Event 36 — Rush Hour
  entry(36, CrazyEvent.RushHour, 1,
    'Pawns can move two squares forward diagonally in a single move for 1 round. This is a non-capturing extended move — the intermediate square must be empty. Provides rapid pawn advancement.',
    'Fast Lane',
    'Pawns permanently have the option to double-step forward. Faster pawn advancement accelerates the game.',
    ['Redundant with Up in the Air (flying already allows unlimited range)', 'Faster pawn advancement increases promotion speed'],
  ),
  // Event 37 — Haunted
  entry(37, CrazyEvent.Haunted, 3,
    'The first 3 captured pieces become ghost obstacles on their capture squares. Ghosts block movement (no piece can land on or pass through a ghost square) but expire after 6 plies each.',
    'Graveyard',
    'All captured pieces permanently become ghosts. The board gradually fills with impassable obstacles.',
    ['Conscription conflicts — converted pieces don\'t become ghosts', 'Ghost squares expire independently after 6 plies each'],
  ),
  // Event 38 — Sacrifice
  entry(38, CrazyEvent.Sacrifice, 2,
    'Each time an opponent captures one of your pieces, your most-advanced pawn is promoted to a king for 2 rounds. Multi-jump chains trigger multiple promotions. Losing material becomes strategically valuable.',
    'Martyrdom',
    'Every piece loss permanently triggers a promotion. Sacrifice becomes a deliberate strategy for king creation.',
    ['Multi-jumps trigger multiple promotions (one per captured piece)', 'No promotion if no pawns remain'],
  ),
  // Event 39 — Shrinking Board
  entry(39, CrazyEvent.ShrinkingBoard, 3,
    'The board permanently contracts inward every 4 plies. First the outermost ring of squares is removed, then the next ring, and so on. Pieces on removed squares are destroyed. Forces central combat.',
    'Pressure Cooker',
    'The board continuously shrinks from the edges. An ever-decreasing playing area forces increasingly desperate confrontations.',
    ['Removes squares permanently, can destroy pieces', 'Forces all surviving pieces toward the center', 'Combines devastatingly with Landmine (center is both shrinking target and mine zone)'],
  ),
  // Event 40 — Double Trouble
  entry(40, CrazyEvent.DoubleTrouble, 1,
    'Meta-event: when drawn, re-rolls twice and activates 2 different events simultaneously. Double Trouble itself is never added to the active events list. It cannot trigger itself on re-rolls.',
    'Extra Crazy',
    'In Chaos mode, Double Trouble fires on every capture. Every single jump triggers two random events, creating exponential chaos.',
    ['Cannot trigger itself on re-rolls', 'Never appears as an active event — resolves instantly into two other events'],
  ),
];

// ---------------------------------------------------------------------------
// Lookup map for O(1) access
// ---------------------------------------------------------------------------

export const EVENT_DATA_MAP: ReadonlyMap<CrazyEvent, EventDataEntry> = new Map(
  EVENT_DATA.map((e) => [e.eventType, e]),
);
