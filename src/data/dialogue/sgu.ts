/**
 *  SGU — Opponent 3 Dialogue Script
 *  ─────────────────────────────────
 *  Edit the lines below to change what Sgu says during the campaign.
 *  See _template.ts for field descriptions.
 */

import type { DialogueLine } from '../../scenes/DialogueScene';

// ── INTRO (Before the fight) ────────────────────────────────
export const dialogueBefore: DialogueLine[] = [
    { speaker: "Sgu", text: "...", side: "right" },
    { speaker: "Sgu", text: "......", side: "right" },
    { speaker: "Sgu", text: "...?", side: "right" },
    { speaker: "Sgu", text: "...........", side: "right" },
    { speaker: "Sgu", text: "Ready.", side: "right" },
];

// ── MID-FIGHT (Opponent reaches 1 life) ─────────────────────
export const dialogueMidFight: DialogueLine[] = [
    { speaker: "Sgu", text: "......!", side: "right" },
    { speaker: "Sgu", text: "...Impressive.", side: "right" },
    { speaker: "Sgu", text: "Focus.", side: "right" },
    { speaker: "Sgu", text: "Not... done.", side: "right" },
    { speaker: "Sgu", text: "Hmph!", side: "right" },
];

// ── AFTER WIN (Opponent defeated) ───────────────────────────
export const dialogueAfterWin: DialogueLine[] = [
    { speaker: "Sgu", text: "...", side: "right" },
    { speaker: "Sgu", text: "..Good fight.", side: "right" },
    { speaker: "Sgu", text: "Victory... is yours.", side: "right" },
    { speaker: "Sgu", text: "Keep... going.", side: "right" },
    { speaker: "Sgu", text: "Farewell.", side: "right" },
];

// ── TRAINING PROMPT (Revisiting defeated island) ────────────
export const dialogueTrainingPrompt: DialogueLine[] = [
    { speaker: "Sgu", text: "...Again? ...Train.", side: "right" },
];

// ── TRAINING WIN (Player wins training match) ───────────────
export const dialogueTrainingWin: DialogueLine[] = [
    { speaker: "Sgu", text: "...Good.", side: "right" },
];

// ── TRAINING LOSE (Player loses training match) ─────────────
export const dialogueTrainingLose: DialogueLine[] = [
    { speaker: "Sgu", text: "...More.", side: "right" },
];
