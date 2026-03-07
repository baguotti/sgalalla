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

// ── TRAINING PROMPT (Revisiting defeated island) ────────────
export const dialogueTrainingPrompt: DialogueLine[] = [
    { speaker: "Greg", text: "Comrade! The revolution needs more soldiers. Let me drill you.", side: "right" },
];

// ── TRAINING WIN (Player wins training match) ───────────────
export const dialogueTrainingWin: DialogueLine[] = [
    { speaker: "Greg", text: "The people's champion grows stronger! Well fought, comrade!", side: "right" },
];

// ── TRAINING LOSE (Player loses training match) ─────────────
export const dialogueTrainingLose: DialogueLine[] = [
    { speaker: "Greg", text: "The struggle continues! You must train harder for the cause!", side: "right" },
];

// ── CAMPAIGN LOSE (Player loses campaign match) ─────────────
export const dialogueCampaignLose: DialogueLine[] = [
    { speaker: "Greg", text: "Another victory for the people! Will you rise and fight again?", side: "right", animation: "taunt" },
];
