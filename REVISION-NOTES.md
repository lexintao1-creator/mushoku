# Local rebuild / 2026-10-05

The default entry now opens the Rudeus-led 2D rebuild. The earlier prototype notes below describe the archived prototype, not the current rebuild's available story or features.

- Charge retains the ordinary water ball until the blue arrays appear at 1.8 seconds. Arrays complete before the cone forms; full charge is reached at 12 seconds and never fires automatically.
- Wind uses animated, depth-separated procedural streamlines rather than the rejected wind atlases. The outer orbit is larger, fainter and slower than the inner orbit, with offset phases; full charge retains circulation alongside the rearward field. Its reverse circulation is a magical visual rule, not a claim of computational fluid dynamics.
- Airborne arrays reveal in staff-to-cone order: red, blue, gold. Each actual first reveal triggers one separate original resonance sound. Ground-array and water-cone colors are unchanged.
- Array reveal audio retains the earlier deep resonance at the player's request; the experimental hybrid and A/C listening candidates are not included.
- Continuous original wind synthesis begins only when the water cone forms at six seconds, replacing the short charge/hold audio loops. Full charge sustains until release or cancellation; existing release and impact sounds are retained.
- Directional cast/release sheets, a circular upper-left minimap, a vertical skill column, both touch pads, and asset-backed loading/interface presentation are integrated.
- Rendering work and diagnostics are bounded; pause cancels charge and wind, and viewport resizing re-centers the camera on the player.
- Automated and desktop/mobile-size browser checks do not establish real-phone frame rate, subjective audio quality, commercial polish, or a complete adaptation of the novels.

# Archived RPG revision / 2026-10-01

This is a fan-game prototype with an original traveler protagonist. It is not an official game, a reconstruction of the novels' chronology, or a complete adaptation of either series.

## Return by Death

- Death automatically restores a world-owned checkpoint. No activation button, checkpoint picker, charges, or cooldown.
- World state, supplies, defeated enemies, and quests return to that checkpoint. Language and accessibility preferences do not rewind.
- The protagonist's recollections live outside that timeline. NPCs do not retain previous-loop memories; their dialogue responds to current pallor and distress.
- Attempting to disclose the power interrupts speech with a heart-grip presentation. This prototype does not model every consequence or exception from Re:Zero.
- A caravan courier can die to a stone-blade ambush. Remembering that event unlocks a concrete warning in the next loop, keeping the courier at camp. It does not resurrect an already-dead courier in the same loop.
- Automatic anchors currently exist at arrival, the forest commission, and the red-rock camp. These authored anchors are an implementation of involuntary return points, not a claim about the canonical cause of checkpoint selection.
- Reloading during the death transition restores the live anchor, not an HP-zero save.

## Combat and presentation

- Water and stone projectiles have separate silhouettes, launch delay, trails and impact animation. Taking a hit or moving too far interrupts the basic spell's incantation.
- Water applies a short wet state. Freezing a wet enemy adds damage and a longer interruption. Numeric timings and this combo are game adaptations, not quoted canon mechanics.
- A sword-specialist's primary action is a close-range step slash, not a magic projectile. Three-hit melee sequences, evasion, attack warnings, recovery windows, knockback, medicine and loot are implemented.
- Forest navigation was remapped for a newly generated, quieter forest scene. Bridge and ruins remain connected; environmental obstacles block movement. This is still a painted-map prototype with authored collision corridors, not a fully tiled or destructible world.
- Generated character art, stone guardian art, illustrated skill icons, and layered spell graphics replace several placeholder presentations. NPCs still lack complete directional walking animation. Village art has not received the same full remake as the forest.
- Chinese and Japanese dialogue/UI are available. Sound is synthesized and remains much simpler than a finished game's audio production.

## Reference boundaries

Mushoku Tensei reference: author-published [magic textbook chapter](https://ncode.syosetu.com/n9669bk/4/) and [swordsmanship/magic chapter](https://ncode.syosetu.com/n9669bk/6/), plus the [official anime character site](https://mushokutensei.jp/character/). Training, incantation, elemental control and distinct sword approaches inform the design. The prototype does not yet implement the full three sword schools, seven proficiency ranks, incantation-free mastery, or the complete original cast and story.

Return-by-Death reference: [official Re:Zero story introduction](https://re-zero.com/story/) and [official anime first-season story](https://re-zero-anime.jp/tv/story/tv1r.html). The Mushoku crossover, concern dialogue, courier incident, and checkpoint placement are original fan-game material.

Visual reference only: [World of Anterra](https://www.anterrarpg.com/) and [Dimraeth](https://dimraeth.com/). Their art is not bundled. Newly generated art includes the forest, demon continent, NPC cast, guardian, and skill atlas. Existing user-supplied title art remains in use; public distribution rights for franchise material have not been established by these changes.

## Verification

Local isolated Edge/Playwright checks cover held-key movement, fountain collision, all three areas' interaction reachability, chapter progression, pause/cooldown behavior, map and inventory, Japanese switching, save/reload, mobile control overlap, projectile cooldown, wet/freeze damage, interrupted casting, death rollback, concern dialogue, disclosure taboo, the courier knowledge branch, and reload during death. These are functional checks, not a claim that the game has achieved commercial-game polish. Screenshots were inspected at desktop and mobile sizes.
