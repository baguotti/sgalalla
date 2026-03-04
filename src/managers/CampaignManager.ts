import { SaveService } from './SaveService';
import type { CampaignSaveData } from './SaveService';

export interface OpponentConfig {
    character: string;
    stage: string;
    dialogueBefore: { speaker: string; text: string; side: 'left' | 'right' }[];
    difficulty: number; // 1-10 mapped to AI aggressiveness
}

export class CampaignManager {
    private static instance: CampaignManager;
    private currentData: CampaignSaveData | null = null;

    // Hardcoded Ladder logic
    public readonly ladder: OpponentConfig[] = [
        {
            character: 'nock',
            stage: 'stage_1',
            dialogueBefore: [
                { speaker: 'Nock', text: 'You think you can pass me? Think again!', side: 'right' }
            ],
            difficulty: 3
        },
        {
            character: 'pe',
            stage: 'stage_1',
            dialogueBefore: [
                { speaker: 'Pe', text: 'Squawk! Intruders will be pecked.', side: 'right' }
            ],
            difficulty: 5
        },
        {
            character: 'sgu',
            stage: 'stage_1',
            dialogueBefore: [
                { speaker: 'Sgu', text: '...', side: 'right' }
            ],
            difficulty: 7
        },
        {
            character: 'sga',
            stage: 'stage_1',
            dialogueBefore: [
                { speaker: 'Sga', text: 'Let me show you my blade.', side: 'right' }
            ],
            difficulty: 8
        },
        {
            character: 'fok',
            stage: 'stage_1',
            dialogueBefore: [
                { speaker: 'Fok', text: 'You made it to the end. Now face your doom.', side: 'right' }
            ],
            difficulty: 10
        }
    ];

    private constructor() {
        this.currentData = SaveService.loadCampaign();
    }

    public static getInstance(): CampaignManager {
        if (!CampaignManager.instance) {
            CampaignManager.instance = new CampaignManager();
        }
        return CampaignManager.instance;
    }

    public startNewCampaign(playerCharacter: string): void {
        this.currentData = {
            currentLevel: 0,
            playerCharacter,
            completed: false
        };
        SaveService.saveCampaign(this.currentData);
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
        SaveService.clearCampaign();
    }
}
