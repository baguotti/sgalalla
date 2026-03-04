/**
 * ============================================================
 *  DIALOGUE TEMPLATE — Copy this file and rename it for a new character.
 * ============================================================
 *
 *  Each line of dialogue has the following fields:
 *
 *    speaker    — The name displayed in the dialogue box (e.g. "Nock").
 *    text       — The actual line of dialogue.
 *    side       — "left" for the player side, "right" for the opponent side.
 *    animation  — (OPTIONAL) Which sprite/animation to show for this line.
 *                 If omitted, the character stays on their default icon pose.
 *                 Examples: "idle", "taunt", "hurt", "attack_light_neutral"
 *
 *  There are three dialogue arrays per character:
 *
 *    dialogueBefore    — Played before the fight starts (intro cutscene).
 *    dialogueMidFight  — Played when the opponent reaches 1 life remaining.
 *    dialogueAfterWin  — Played after the player defeats the opponent.
 *
 *  HOW TO ADD A LINE:
 *    Just add a new object { speaker, text, side, animation? } to the array.
 *
 *  HOW TO REMOVE A LINE:
 *    Delete the entire { ... } block (including the trailing comma).
 *
 *  HOW TO REORDER:
 *    Cut and paste the { ... } blocks into the order you want.
 * ============================================================
 */

import type { DialogueLine } from '../../scenes/DialogueScene';

// ── INTRO (Before the fight) ────────────────────────────────
export const dialogueBefore: DialogueLine[] = [
    // { speaker: "Opponent", text: "...", side: "right" },
];

// ── MID-FIGHT (Opponent reaches 1 life) ─────────────────────
export const dialogueMidFight: DialogueLine[] = [
    // { speaker: "Opponent", text: "...", side: "right" },
];

// ── AFTER WIN (Opponent defeated) ───────────────────────────
export const dialogueAfterWin: DialogueLine[] = [
    // { speaker: "Opponent", text: "...", side: "right" },
];
