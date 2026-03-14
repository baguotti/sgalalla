/**
 *  PE — Opponent 2 Dialogue Script
 *  ────────────────────────────────
 *  Edit the lines below to change what Pe says during the campaign.
 *  See _template.ts for field descriptions.
 */

import type { DialogueLine } from '../../scenes/DialogueScene';

// ── INTRO (Before the fight) ────────────────────────────────
export const dialogueBefore: DialogueLine[] = [
    { speaker: "Pe", text: "Squawk! Intruders will be pecked. This is my territory! No humans allowed! This is my territory! No humans allowed! This is my territory! No humans allowed!", side: "right" },
    { speaker: "Pe", text: "This is my territory! No humans allowed!", side: "right" },
    { speaker: "Pe", text: "Do you hear the wind? It sings of your defeat!", side: "right" },
    { speaker: "Pe", text: "I'll pluck your pride away, piece by piece!", side: "right" },
    { speaker: "Pe", text: "Prepare to meet the fastest beak in the sky!", side: "right" },
];

// ── MID-FIGHT (Opponent reaches 1 life) ─────────────────────
export const dialogueMidFight: DialogueLine[] = [
    { speaker: "Pe", text: "SQUAWK!! You dare hurt me?!", side: "right" },
    { speaker: "Pe", text: "My feathers are ruffled, but my spirit is not!", side: "right" },
    { speaker: "Pe", text: "I'll fly higher than your reach!", side: "right" },
    { speaker: "Pe", text: "You're just a grounded pest!", side: "right" },
    { speaker: "Pe", text: "Taste my fury! SQUAWK!", side: "right" },
];

// ── AFTER WIN (Opponent defeated) ───────────────────────────
export const dialogueAfterWin: DialogueLine[] = [
    { speaker: "Pe", text: "Squawk... defeated...", side: "right", animation: "defeat" },
    { speaker: "Pe", text: "My wings... they feel so heavy...", side: "right", animation: "defeat" },
    { speaker: "Pe", text: "You fight like a storm, little human.", side: "right", animation: "defeat" },
    { speaker: "Pe", text: "Go... leave me to my nest.", side: "right", animation: "defeat" },
    { speaker: "Pe", text: "Next time... I won't be so easy to catch.", side: "right", animation: "defeat" },
];

// ── TRAINING PROMPT (Revisiting defeated island) ────────────
export const dialogueTrainingPrompt: DialogueLine[] = [
    { speaker: "Pe", text: "Squawk! You want another round? I can sharpen your talons!", side: "right" },
];

// ── TRAINING WIN (Player wins training match) ───────────────
export const dialogueTrainingWin: DialogueLine[] = [
    { speaker: "Pe", text: "SQUAWK! You're flying higher every time!", side: "right" },
];

// ── TRAINING LOSE (Player loses training match) ─────────────
export const dialogueTrainingLose: DialogueLine[] = [
    { speaker: "Pe", text: "You need more practice, little human. Try again!", side: "right" },
];

// ── CAMPAIGN LOSE (Player loses campaign match) ─────────────
export const dialogueCampaignLose: DialogueLine[] = [
    { speaker: "Pe", text: "A predictable outcome. Care to attempt the impossible once more?", side: "right" },
];
