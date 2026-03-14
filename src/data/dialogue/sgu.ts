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
    { speaker: "Sgu", text: "...", side: "right", animation: "defeat" },
    { speaker: "Sgu", text: "..Good fight.", side: "right", animation: "defeat" },
    { speaker: "Sgu", text: "Victory... is yours.", side: "right", animation: "defeat" },
    { speaker: "Sgu", text: "Keep... going.", side: "right", animation: "defeat" },
    { speaker: "Sgu", text: "Farewell.", side: "right", animation: "defeat" },
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

// ── CAMPAIGN LOSE (Player loses campaign match) ─────────────
export const dialogueCampaignLose: DialogueLine[] = [
    { speaker: "Sgu", text: "Not fast enough! But you're getting there. Ready for round two?", side: "right", animation: "taunt" },
];
