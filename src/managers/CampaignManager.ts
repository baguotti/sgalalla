import { SaveService } from './SaveService';
import type { CampaignSaveData } from './SaveService';

import { CHARACTER_STAGES } from '../data/CampaignIslandData';

import * as nockDialogue from '../data/dialogue/nock';
import * as peDialogue from '../data/dialogue/pe';
import * as sguDialogue from '../data/dialogue/sgu';
import * as sgaDialogue from '../data/dialogue/sga';
import * as fokDialogue from '../data/dialogue/fok';
import * as gregDialogue from '../data/dialogue/greg';

export interface OpponentConfig {
    character: string;
    stage: string;
    dialogueBefore: { speaker: string; text: string; side: 'left' | 'right' }[];
    dialogueMidFight: { speaker: string; text: string; side: 'left' | 'right' }[];
    dialogueAfterWin: { speaker: string; text: string; side: 'left' | 'right' }[];
    dialogueTrainingPrompt: { speaker: string; text: string; side: 'left' | 'right' }[];
    dialogueTrainingWin: { speaker: string; text: string; side: 'left' | 'right' }[];
    dialogueTrainingLose: { speaker: string; text: string; side: 'left' | 'right' }[];
    dialogueCampaignLose: { speaker: string; text: string; side: 'left' | 'right' }[];
    difficulty: number; // 1-10 mapped to AI aggressiveness
}

/** Maps character keys to their dialogue modules */
const dialogueMap: Record<string, typeof fokDialogue> = {
    nock: nockDialogue,
    pe: peDialogue,
    sgu: sguDialogue,
    sga: sgaDialogue,
    fok: fokDialogue,
    greg: gregDialogue,
};

/** Characters that have full dialogue scripts and can appear as opponents */
const AVAILABLE_OPPONENTS = ['nock', 'pe', 'sgu', 'sga', 'fok', 'greg'];

/** Difficulty tiers assigned in order (easiest → hardest, final boss is always 10) */
const DIFFICULTY_TIERS = [2, 4, 5, 7, 8, 10];

/** Fisher-Yates shuffle */
function shuffle<T>(array: T[]): T[] {
    const a = [...array];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export class CampaignManager {
    private static instance: CampaignManager;
    private currentData: CampaignSaveData | null = null;
    private activeSlotIndex: number = 0;
    private sessionStartTime: number = 0; // Tracks when the current play session began

    /** The generated ladder for this run — built dynamically */
    public ladder: OpponentConfig[] = [];

    private constructor() {
        // No auto-load on construction anymore — we wait for explicit slot selection
    }

    public static getInstance(): CampaignManager {
        if (!CampaignManager.instance) {
            CampaignManager.instance = new CampaignManager();
        }
        return CampaignManager.instance;
    }

    /**
     * Load an existing save slot and resume the campaign.
     */
    public loadCampaignFromSlot(slotIndex: number): boolean {
        this.activeSlotIndex = slotIndex;
        const data = SaveService.loadSlot(slotIndex);
        if (!data) {
            this.currentData = null;
            this.ladder = [];
            return false;
        }

        this.currentData = data;
        if (data.ladderOrder && data.ladderOrder.length > 0) {
            this.ladder = this.buildLadderFromOrder(data.ladderOrder);
        } else {
            // Stale save — clear in-memory state only, never auto-delete the slot
            this.currentData = null;
            return false;
        }

        this.sessionStartTime = Date.now();
        return true;
    }

    /**
     * Start a new campaign run in a specific slot.
     */
    public startNewCampaign(playerCharacter: string, slotIndex: number = 0): void {
        this.activeSlotIndex = slotIndex;

        // Build opponent pool: everyone except the player, then shuffle
        const pool = AVAILABLE_OPPONENTS.filter(c => c !== playerCharacter);
        const shuffled = shuffle(pool);

        // Final boss is always a mirror match (player's own character)
        const ladderOrder = [...shuffled, playerCharacter];

        this.ladder = this.buildLadderFromOrder(ladderOrder);

        this.currentData = {
            slotIndex,
            currentLevel: 0,
            playerCharacter,
            completed: false,
            ladderOrder,
            startedAt: Date.now(),
            playTimeMs: 0,
        };
        this.sessionStartTime = Date.now();
        SaveService.saveSlot(slotIndex, this.currentData);
    }

    /**
     * Idempotent guard used by scenes before reading campaign state.
     * - If a campaign is active for a different character, resets it and starts fresh.
     * - If no campaign is active, starts a new one.
     * - If a campaign is already active for the correct character, does nothing.
     */
    public ensureActive(playerCharacter: string, slotIndex: number): void {
        if (this.hasActiveCampaign() && this.getPlayerCharacter() !== playerCharacter) {
            this.resetCampaign();
        }
        if (!this.hasActiveCampaign()) {
            this.startNewCampaign(playerCharacter, slotIndex);
        }
    }

    /** Converts a list of character keys into a full OpponentConfig[] ladder */
    private buildLadderFromOrder(order: string[]): OpponentConfig[] {
        return order.map((char, index) => {
            const dialogue = dialogueMap[char];
            const difficulty = DIFFICULTY_TIERS[index] ?? 10;

            return {
                character: char,
                stage: CHARACTER_STAGES[char] ?? 'adria_bg',
                dialogueBefore: dialogue ? dialogue.dialogueBefore : [],
                dialogueMidFight: dialogue ? dialogue.dialogueMidFight : [],
                dialogueAfterWin: dialogue ? dialogue.dialogueAfterWin : [],
                dialogueTrainingPrompt: dialogue?.dialogueTrainingPrompt ?? [],
                dialogueTrainingWin: dialogue?.dialogueTrainingWin ?? [],
                dialogueTrainingLose: dialogue?.dialogueTrainingLose ?? [],
                dialogueCampaignLose: dialogue?.dialogueCampaignLose ?? [],
                difficulty,
            };
        });
    }

    public hasActiveCampaign(): boolean {
        return this.currentData !== null;
    }

    public getCurrentLevel(): number {
        return this.currentData?.currentLevel ?? 0;
    }

    public getCurrentOpponent(): OpponentConfig | null {
        if (!this.currentData) return null;
        if (this.currentData.currentLevel >= this.ladder.length) return null;

        return this.ladder[this.currentData.currentLevel];
    }

    public getPlayerCharacter(): string {
        return this.currentData ? this.currentData.playerCharacter : 'fok';
    }

    public getActiveSlotIndex(): number {
        return this.activeSlotIndex;
    }

    public advanceLadder(): void {
        if (!this.currentData) return;

        this.currentData.currentLevel++;
        if (this.currentData.currentLevel >= this.ladder.length) {
            this.currentData.currentLevel = this.ladder.length;
        }
        this.updatePlayTime();
        SaveService.saveSlot(this.activeSlotIndex, this.currentData);
    }

    /** Call this when leaving the campaign to persist accumulated play time. */
    public savePlayTime(): void {
        if (!this.currentData) return;
        this.updatePlayTime();
        SaveService.saveSlot(this.activeSlotIndex, this.currentData);
    }

    private updatePlayTime(): void {
        if (!this.currentData || this.sessionStartTime === 0) return;
        const elapsed = Date.now() - this.sessionStartTime;
        this.currentData.playTimeMs += elapsed;
        this.sessionStartTime = Date.now(); // Reset session timer
    }

    public resetCampaign(): void {
        // Only clears in-memory state — NEVER auto-deletes the save file.
        // The user must explicitly choose "ELIMINA" in the menu to delete.
        this.currentData = null;
        this.ladder = [];
        this.sessionStartTime = 0;
    }
}
