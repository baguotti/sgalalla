export interface CampaignSaveData {
    currentLevel: number;
    playerCharacter: string;
    completed: boolean;
    ladderOrder?: string[]; // Persisted randomized opponent order
}

const SAVE_KEY = 'sgalalla_campaign_save';

export class SaveService {
    public static saveCampaign(data: CampaignSaveData): void {
        try {
            const json = JSON.stringify(data);
            localStorage.setItem(SAVE_KEY, json);
        } catch (e) {
            console.warn('Failed to save campaign data', e);
        }
    }

    public static loadCampaign(): CampaignSaveData | null {
        try {
            const json = localStorage.getItem(SAVE_KEY);
            if (json) {
                return JSON.parse(json) as CampaignSaveData;
            }
        } catch (e) {
            console.warn('Failed to load campaign data', e);
        }
        return null;
    }

    public static clearCampaign(): void {
        try {
            localStorage.removeItem(SAVE_KEY);
        } catch (e) {
            console.warn('Failed to clear campaign data', e);
        }
    }
}
