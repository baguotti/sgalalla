/**
 *  NOCK — Opponent 1 Dialogue Script
 *  ──────────────────────────────────
 *  Edit the lines below to change what Nock says during the campaign.
 *  See _template.ts for field descriptions.
 */

import type { DialogueLine } from '../../scenes/DialogueScene';

// ── INTRO (Before the fight) ────────────────────────────────
export const dialogueBefore: DialogueLine[] = [
    { speaker: "Nock", text: "You think you can pass me? Think again!", side: "right" },
    { speaker: "Nock", text: "Many have tried to cross this threshold, and all have failed.", side: "right", animation: "taunt" },
    { speaker: "Nock", text: "Win? Against ME? Your confidence is misplaced...", side: "right" },
    { speaker: "Nock", text: "I've been watching your progress. It ends here.", side: "right" },
    { speaker: "Nock", text: "Let see if your skills match your mouth!", side: "right" },
];

// ── MID-FIGHT (Opponent reaches 1 life) ─────────────────────
export const dialogueMidFight: DialogueLine[] = [
    { speaker: "Nock", text: "Tch... you are stronger than I expected.", side: "right" },
    { speaker: "Nock", text: "But strength alone won't be enough to floor me.", side: "right" },
    { speaker: "Nock", text: "I was merely testing your resolve until now.", side: "right" },
    { speaker: "Nock", text: "Now, witness the true speed of a champion!", side: "right" },
    { speaker: "Nock", text: "Never! I will show you my true power!", side: "right" },
];

// ── AFTER WIN (Opponent defeated) ───────────────────────────
export const dialogueAfterWin: DialogueLine[] = [
    { speaker: "Nock", text: "Impossible... I lost...", side: "right" },
    { speaker: "Nock", text: "How could someone like you break my defense?", side: "right" },
    { speaker: "Nock", text: "Go on then... the others won't be as lenient as I was.", side: "right" },
    { speaker: "Nock", text: "Take my respect, for what it's worth.", side: "right" },
    { speaker: "Nock", text: "The real challenge lies ahead.", side: "right" },
];

// ── TRAINING PROMPT (Revisiting defeated island) ────────────
export const dialogueTrainingPrompt: DialogueLine[] = [
    { speaker: "Nock", text: "Back again? I can train you for the challenges ahead.", side: "right" },
];

// ── TRAINING WIN (Player wins training match) ───────────────
export const dialogueTrainingWin: DialogueLine[] = [
    { speaker: "Nock", text: "Well done! You're getting sharper every time.", side: "right" },
];

// ── TRAINING LOSE (Player loses training match) ─────────────
export const dialogueTrainingLose: DialogueLine[] = [
    { speaker: "Nock", text: "You should train more. Don't give up!", side: "right" },
];
