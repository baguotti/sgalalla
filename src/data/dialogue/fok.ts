/**
 *  FOK — Dialogue Script
 *  ───────────────────────────────────────────────
 *  Edit the lines below to change what Fok says during the campaign.
 *  See _template.ts for field descriptions.
 */

import type { DialogueLine } from '../../scenes/DialogueScene';

// ── INTRO (Before the fight) ────────────────────────────────
export const dialogueBefore: DialogueLine[] = [
    { speaker: "Fok", text: "You made it to the end. Now face your doom.", side: "right", animation: "light_neutral" },
    { speaker: "Fok", text: "I've seen many like you come and go from this throne.", side: "right", animation: "charging" },
    { speaker: "Fok", text: "You think you're special? You're just another challenger.", side: "right", animation: "charging" },
    { speaker: "Fok", text: "The pressure here is more than most can handle.", side: "right", animation: "charging" },
    { speaker: "Fok", text: "Bow before the true king of this realm!", side: "right", animation: "charging" },
];

// ── MID-FIGHT (Opponent reaches 1 life) ─────────────────────
export const dialogueMidFight: DialogueLine[] = [
    { speaker: "Fok", text: "Heh... not bad. But this is where it ends!", side: "right" },
    { speaker: "Fok", text: "You actually managed to push me this far?", side: "right" },
    { speaker: "Fok", text: "The real battle starts when I'm against the wall!", side: "right" },
    { speaker: "Fok", text: "Feel the weight of my crown!", side: "right", animation: "taunt" },
    { speaker: "Fok", text: "I will not be dethroned by a mere wanderer!", side: "right" },
];

// ── AFTER WIN (Opponent defeated) ───────────────────────────
export const dialogueAfterWin: DialogueLine[] = [
    { speaker: "Fok", text: "You... actually did it. The champion falls.", side: "right", animation: "defeat" },
    { speaker: "Fok", text: "The weight... it's finally off my shoulders.", side: "right", animation: "defeat" },
    { speaker: "Fok", text: "Take the crown. It's yours by right of combat.", side: "right", animation: "defeat" },
    { speaker: "Fok", text: "Be a better ruler than I was.", side: "right", animation: "defeat" },
    { speaker: "Fok", text: "It is over. I am the champion no more.", side: "right", animation: "defeat" },
];

// ── TRAINING PROMPT (Revisiting defeated island) ────────────
export const dialogueTrainingPrompt: DialogueLine[] = [
    { speaker: "Fok", text: "The dethroned king still has lessons to teach. Shall we spar?", side: "right" },
];

// ── TRAINING WIN (Player wins training match) ───────────────
export const dialogueTrainingWin: DialogueLine[] = [
    { speaker: "Fok", text: "You defeated me once more. Your reign is well deserved.", side: "right" },
];

// ── TRAINING LOSE (Player loses training match) ─────────────
export const dialogueTrainingLose: DialogueLine[] = [
    { speaker: "Fok", text: "Even a fallen king can still bite. Train harder!", side: "right" },
];

// ── CAMPAIGN LOSE (Player loses campaign match) ─────────────
export const dialogueCampaignLose: DialogueLine[] = [
    { speaker: "Fok", text: "The throne remains mine! Will you dare challenge me again?", side: "right" },
];
