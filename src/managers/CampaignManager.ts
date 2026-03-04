import { SaveService } from './SaveService';
import type { CampaignSaveData } from './SaveService';

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

    /** The generated ladder for this run — built dynamically in startNewCampaign */
    public ladder: OpponentConfig[] = [];

    private constructor() {
        this.currentData = SaveService.loadCampaign();
        // Rebuild ladder from save if resuming
        if (this.currentData && !this.currentData.completed) {
            if (this.currentData.ladderOrder && this.currentData.ladderOrder.length > 0) {
                this.ladder = this.buildLadderFromOrder(this.currentData.ladderOrder);
            } else {
                // Stale save from old format — clear it so a fresh campaign starts
                this.currentData = null;
                SaveService.clearCampaign();
            }
        }
    }

    public static getInstance(): CampaignManager {
        if (!CampaignManager.instance) {
            CampaignManager.instance = new CampaignManager();
        }
        return CampaignManager.instance;
    }

    /**
     * Start a new campaign run.
     * - Excludes the player's own character from the first N-1 opponents.
     * - Shuffles them randomly.
     * - Places the player's own character as the final boss (mirror match).
     */
    public startNewCampaign(playerCharacter: string): void {
        // Build opponent pool: everyone except the player, then shuffle
        const pool = AVAILABLE_OPPONENTS.filter(c => c !== playerCharacter);
        const shuffled = shuffle(pool);

        // Final boss is always a mirror match (player's own character)
        const ladderOrder = [...shuffled, playerCharacter];

        this.ladder = this.buildLadderFromOrder(ladderOrder);

        this.currentData = {
            currentLevel: 0,
            playerCharacter,
            completed: false,
            ladderOrder, // Persist so we can rebuild on reload
        };
        SaveService.saveCampaign(this.currentData);
    }

    /** Converts a list of character keys into a full OpponentConfig[] ladder */
    private buildLadderFromOrder(order: string[]): OpponentConfig[] {
        return order.map((char, index) => {
            const dialogue = dialogueMap[char];
            const difficulty = DIFFICULTY_TIERS[index] ?? 10;

            return {
                character: char,
                stage: 'stage_1',
                dialogueBefore: dialogue ? dialogue.dialogueBefore : [],
                dialogueMidFight: dialogue ? dialogue.dialogueMidFight : [],
                dialogueAfterWin: dialogue ? dialogue.dialogueAfterWin : [],
                difficulty,
            };
        });
    }

    public hasActiveCampaign(): boolean {
        return this.currentData !== null && !this.currentData.completed;
    }

    public getCurrentOpponent(): OpponentConfig | null {
        if (!this.currentData || this.currentData.completed) return null;
        if (this.currentData.currentLevel >= this.ladder.length) return null;

        return this.ladder[this.currentData.currentLevel];
    }

    public getPlayerCharacter(): string {
        return this.currentData ? this.currentData.playerCharacter : 'fok';
    }

    public advanceLadder(): void {
        if (!this.currentData) return;

        this.currentData.currentLevel++;
        if (this.currentData.currentLevel >= this.ladder.length) {
            this.currentData.completed = true;
        }
        SaveService.saveCampaign(this.currentData);
    }

    public resetCampaign(): void {
        this.currentData = null;
        this.ladder = [];
        SaveService.clearCampaign();
    }
}
