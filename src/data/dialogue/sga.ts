/**
 *  SGA — Opponent 4 Dialogue Script
 *  ─────────────────────────────────
 *  Edit the lines below to change what Sga says during the campaign.
 *  See _template.ts for field descriptions.
 */

import type { DialogueLine } from '../../scenes/DialogueScene';

// ── INTRO (Before the fight) ────────────────────────────────
export const dialogueBefore: DialogueLine[] = [
    { speaker: "Sga", text: "Let me show you my blade.", side: "right" },
    { speaker: "Sga", text: "Steel is my only companion in this arena.", side: "right" },
    { speaker: "Sga", text: "You look like a worthy adversary.", side: "right" },
    { speaker: "Sga", text: "I hope your defense is as sharp as your eyes.", side: "right" },
    { speaker: "Sga", text: "Let the dance of blades begin!", side: "right" },
];

// ── MID-FIGHT (Opponent reaches 1 life) ─────────────────────
export const dialogueMidFight: DialogueLine[] = [
    { speaker: "Sga", text: "You scratch my armor... impressive.", side: "right" },
    { speaker: "Sga", text: "Pain is just another teacher on the battlefield.", side: "right" },
    { speaker: "Sga", text: "Your technique is unrefined, yet effective.", side: "right" },
    { speaker: "Sga", text: "I must focus my spirit to match your pace.", side: "right" },
    { speaker: "Sga", text: "Now, I fight with everything I have!", side: "right" },
];

// ── AFTER WIN (Opponent defeated) ───────────────────────────
export const dialogueAfterWin: DialogueLine[] = [
    { speaker: "Sga", text: "My blade... bested. You have earned my respect.", side: "right" },
    { speaker: "Sga", text: "I have much to reflect on after this encounter.", side: "right" },
    { speaker: "Sga", text: "Carry my strength with you to the final challenge.", side: "right" },
    { speaker: "Sga", text: "The champion waits... do not falter now.", side: "right" },
    { speaker: "Sga", text: "Honor in victory, warrior.", side: "right" },
];
