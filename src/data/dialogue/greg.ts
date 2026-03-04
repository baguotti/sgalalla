/**
 *  GREG — Opponent Dialogue Script
 *  ───────────────────────────────────────────────
 *  Edit the lines below to change what Greg says during the campaign.
 *  See _template.ts for field descriptions.
 */

import type { DialogueLine } from '../../scenes/DialogueScene';

// ── INTRO (Before the fight) ────────────────────────────────
export const dialogueBefore: DialogueLine[] = [
    { speaker: "Greg", text: "Workers of the world, unite! Against you, specifically.", side: "right", animation: "taunt" },
    { speaker: "Greg", text: "The means of destruction are in my hands now.", side: "right" },
    { speaker: "Greg", text: "History is on my side. You are merely a footnote.", side: "right" },
    { speaker: "Greg", text: "Every revolution needs a martyr. Volunteer?", side: "right" },
    { speaker: "Greg", text: "Let's see if you can withstand the people's fist.", side: "right" },
];

// ── MID-FIGHT (Opponent reaches 1 life) ─────────────────────
export const dialogueMidFight: DialogueLine[] = [
    { speaker: "Greg", text: "Impressive... but the struggle continues!", side: "right" },
    { speaker: "Greg", text: "A setback is not a defeat. Only a redistribution.", side: "right" },
    { speaker: "Greg", text: "You fight well, but ideals are stronger than fists.", side: "right" },
    { speaker: "Greg", text: "The revolution will not be stopped by one fighter!", side: "right", animation: "taunt" },
    { speaker: "Greg", text: "I have nothing to lose but my chains!", side: "right" },
];

// ── AFTER WIN (Opponent defeated) ───────────────────────────
export const dialogueAfterWin: DialogueLine[] = [
    { speaker: "Greg", text: "The dialectic... it has spoken.", side: "right" },
    { speaker: "Greg", text: "Perhaps I was the bourgeoisie all along.", side: "right" },
    { speaker: "Greg", text: "You've earned this victory. Seize it.", side: "right" },
    { speaker: "Greg", text: "The manifesto didn't prepare me for this.", side: "right" },
    { speaker: "Greg", text: "Go forth, comrade. You have proven your worth.", side: "right" },
];
