import { SaveService } from './SaveService';
import type { CampaignSaveData } from './SaveService';

export interface OpponentConfig {
    character: string;
    stage: string;
    dialogueBefore: { speaker: string; text: string; side: 'left' | 'right' }[];
    dialogueMidFight: { speaker: string; text: string; side: 'left' | 'right' }[];
    dialogueAfterWin: { speaker: string; text: string; side: 'left' | 'right' }[];
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
                { speaker: 'Nock', text: 'You think you can pass me? Think again!', side: 'right' },
                { speaker: 'Player', text: 'I am not just passing through. I am here to win.', side: 'left' },
                { speaker: 'Nock', text: 'Win? Against ME? Your confidence is misplaced...', side: 'right' },
                { speaker: 'Nock', text: 'Let see if your skills match your mouth!', side: 'right' }
            ],
            dialogueMidFight: [
                { speaker: 'Nock', text: 'Tch... you are stronger than I expected.', side: 'right' },
                { speaker: 'Player', text: 'Give up now while you still can.', side: 'left' },
                { speaker: 'Nock', text: 'Never! I will show you my true power!', side: 'right' }
            ],
            dialogueAfterWin: [
                { speaker: 'Nock', text: 'Impossible... I lost...', side: 'right' },
                { speaker: 'Player', text: 'That was just the beginning. Who is next?', side: 'left' }
            ],
            difficulty: 3
        },
        {
            character: 'pe',
            stage: 'stage_1',
            dialogueBefore: [
                { speaker: 'Pe', text: 'Squawk! Intruders will be pecked.', side: 'right' }
            ],
            dialogueMidFight: [
                { speaker: 'Pe', text: 'SQUAWK!! You dare hurt me?!', side: 'right' },
                { speaker: 'Player', text: 'Stand down, bird.', side: 'left' }
            ],
            dialogueAfterWin: [
                { speaker: 'Pe', text: 'Squawk... defeated...', side: 'right' },
                { speaker: 'Player', text: 'Onward.', side: 'left' }
            ],
            difficulty: 5
        },
        {
            character: 'sgu',
            stage: 'stage_1',
            dialogueBefore: [
                { speaker: 'Sgu', text: '...', side: 'right' }
            ],
            dialogueMidFight: [
                { speaker: 'Sgu', text: '......!', side: 'right' },
                { speaker: 'Player', text: 'You fight well, even in silence.', side: 'left' }
            ],
            dialogueAfterWin: [
                { speaker: 'Sgu', text: '...', side: 'right' },
                { speaker: 'Player', text: 'I understand. Until next time.', side: 'left' }
            ],
            difficulty: 7
        },
        {
            character: 'sga',
            stage: 'stage_1',
            dialogueBefore: [
                { speaker: 'Sga', text: 'Let me show you my blade.', side: 'right' }
            ],
            dialogueMidFight: [
                { speaker: 'Sga', text: 'You scratch my armor... impressive.', side: 'right' },
                { speaker: 'Player', text: 'Your armor will not save you.', side: 'left' }
            ],
            dialogueAfterWin: [
                { speaker: 'Sga', text: 'My blade... bested. You have earned my respect.', side: 'right' },
                { speaker: 'Player', text: 'Respect earned in battle. Now step aside.', side: 'left' }
            ],
            difficulty: 8
        },
        {
            character: 'fok',
            stage: 'stage_1',
            dialogueBefore: [
                { speaker: 'Fok', text: 'You made it to the end. Now face your doom.', side: 'right' }
            ],
            dialogueMidFight: [
                { speaker: 'Fok', text: 'Heh... not bad. But this is where it ends!', side: 'right' },
                { speaker: 'Player', text: 'I have come too far to lose now!', side: 'left' }
            ],
            dialogueAfterWin: [
                { speaker: 'Fok', text: 'You... actually did it. The champion falls.', side: 'right' },
                { speaker: 'Player', text: 'It is over. I am the champion now.', side: 'left' }
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
