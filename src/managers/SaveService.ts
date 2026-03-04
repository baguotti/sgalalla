export interface CampaignSaveData {
    slotIndex: number;
    currentLevel: number;
    playerCharacter: string;
    completed: boolean;
    ladderOrder?: string[];
    startedAt: number;   // Date.now() when campaign was created
    playTimeMs: number;  // Accumulated play time in milliseconds
}

const SLOTS_KEY = 'sgalalla_campaign_slots';
const OLD_SAVE_KEY = 'sgalalla_campaign_save'; // Legacy single-key

export class SaveService {
    /**
     * Load all 3 save slots. Returns a fixed-length array of 3 elements (null = empty).
     */
    public static loadAllSlots(): (CampaignSaveData | null)[] {
        try {
            const json = localStorage.getItem(SLOTS_KEY);
            if (json) {
                const parsed = JSON.parse(json) as (CampaignSaveData | null)[];
                // Ensure exactly 3 slots
                while (parsed.length < 3) parsed.push(null);
                return parsed.slice(0, 3);
            }
        } catch (e) {
            console.warn('Failed to load campaign slots', e);
        }

        // Migrate old single-key save into slot 0 if it exists
        const migrated = SaveService.migrateOldSave();
        if (migrated) return migrated;

        return [null, null, null];
    }

    /**
     * Save data into a specific slot (0-2).
     */
    public static saveSlot(index: number, data: CampaignSaveData): void {
        try {
            const slots = SaveService.loadAllSlots();
            data.slotIndex = index;
            slots[index] = data;
            localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
        } catch (e) {
            console.warn('Failed to save campaign slot', e);
        }
    }

    /**
     * Delete a specific slot.
     */
    public static deleteSlot(index: number): void {
        try {
            const slots = SaveService.loadAllSlots();
            slots[index] = null;
            localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
        } catch (e) {
            console.warn('Failed to delete campaign slot', e);
        }
    }

    /**
     * Load a specific slot (convenience).
     */
    public static loadSlot(index: number): CampaignSaveData | null {
        return SaveService.loadAllSlots()[index] ?? null;
    }

    /**
     * Migrate old single-key save into slot 0, then remove old key.
     */
    private static migrateOldSave(): (CampaignSaveData | null)[] | null {
        try {
            const oldJson = localStorage.getItem(OLD_SAVE_KEY);
            if (oldJson) {
                const oldData = JSON.parse(oldJson);
                const migrated: CampaignSaveData = {
                    slotIndex: 0,
                    currentLevel: oldData.currentLevel ?? 0,
                    playerCharacter: oldData.playerCharacter ?? 'fok',
                    completed: oldData.completed ?? false,
                    ladderOrder: oldData.ladderOrder,
                    startedAt: Date.now(),
                    playTimeMs: 0,
                };
                const slots: (CampaignSaveData | null)[] = [migrated, null, null];
                localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
                localStorage.removeItem(OLD_SAVE_KEY);
                return slots;
            }
        } catch (e) {
            console.warn('Failed to migrate old save', e);
        }
        return null;
    }

    // ─── Legacy compat (used by CampaignManager until fully migrated) ───

    /** @deprecated Use saveSlot instead */
    public static saveCampaign(data: CampaignSaveData): void {
        SaveService.saveSlot(data.slotIndex ?? 0, data);
    }

    /** @deprecated Use loadSlot instead */
    public static loadCampaign(): CampaignSaveData | null {
        return SaveService.loadSlot(0);
    }

    /** @deprecated Use deleteSlot instead */
    public static clearCampaign(): void {
        SaveService.deleteSlot(0);
    }
}
