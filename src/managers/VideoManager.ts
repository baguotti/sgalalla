import '../style.css';

const CRT_KEY = 'video_crt_intensity';
const FS_KEY = 'video_fullscreen';

/** 0 = off, 1 = basso, 2 = medio, 3 = alto */
export type CrtIntensity = 0 | 1 | 2 | 3;

const INTENSITY_CLASS: Record<Exclude<CrtIntensity, 0>, string> = {
    1: 'crt-basso',
    2: 'crt-medio',
    3: 'crt-alto',
};

export class VideoManager {
    private static instance: VideoManager;
    private crtIntensity: CrtIntensity = 0;
    private overlayElement: HTMLDivElement | null = null;

    /** Saved fullscreen preference (persists across sessions). */
    private fullscreen: boolean = false;

    private constructor() {
        this.load();
    }

    public static getInstance(): VideoManager {
        if (!VideoManager.instance) {
            VideoManager.instance = new VideoManager();
        }
        return VideoManager.instance;
    }

    // ─── Persistence ───

    private load(): void {
        // CRT
        const savedCrt = localStorage.getItem(CRT_KEY);
        const parsed = Number(savedCrt);
        if (parsed >= 0 && parsed <= 3) {
            this.crtIntensity = parsed as CrtIntensity;
        }

        // Fullscreen
        const savedFs = localStorage.getItem(FS_KEY);
        if (savedFs !== null) {
            this.fullscreen = savedFs === '1';
        }
    }

    private save(): void {
        localStorage.setItem(CRT_KEY, String(this.crtIntensity));
        localStorage.setItem(FS_KEY, this.fullscreen ? '1' : '0');
    }

    // ─── CRT ───

    /** Call once on game boot — creates the single overlay and applies saved state. */
    public applySettings(): void {
        if (!this.overlayElement) {
            this.overlayElement = document.createElement('div');
            this.overlayElement.classList.add('crt-overlay');
            document.body.appendChild(this.overlayElement);
        }

        // Reset
        this.overlayElement.className = 'crt-overlay';

        if (this.crtIntensity > 0) {
            const cls = INTENSITY_CLASS[this.crtIntensity as 1 | 2 | 3];
            this.overlayElement.classList.add('active', cls);
        }
    }

    public getCrtIntensity(): CrtIntensity {
        return this.crtIntensity;
    }

    public isCrtEnabled(): boolean {
        return this.crtIntensity > 0;
    }

    public setCrtIntensity(intensity: CrtIntensity): void {
        this.crtIntensity = intensity;
        this.save();
        this.applySettings();
    }

    /** Cycle: 0 → 1 → 0 */
    public cycleCrt(): void {
        this.setCrtIntensity(this.crtIntensity === 0 ? 1 : 0);
    }

    // ─── Fullscreen ───

    /** True when running inside Electron. */
    public isDesktop(): boolean {
        return typeof window !== 'undefined' && !!window.electronAPI;
    }

    public getFullscreen(): boolean {
        return this.fullscreen;
    }

    /**
     * Toggle fullscreen on/off.
     * - Desktop (Electron): uses native BrowserWindow via IPC.
     * - Web: uses the Phaser Scale Manager (requires a user gesture).
     */
    public async toggleFullscreen(scene: Phaser.Scene): Promise<void> {
        if (this.isDesktop()) {
            const next = !this.fullscreen;
            await window.electronAPI!.setFullscreen(next);
            this.fullscreen = next;
        } else {
            if (scene.scale.isFullscreen) {
                scene.scale.stopFullscreen();
                this.fullscreen = false;
            } else {
                scene.scale.startFullscreen();
                this.fullscreen = true;
            }
        }
        this.save();
    }

    /**
     * On boot, restore the saved fullscreen state (Electron only).
     * Browsers block programmatic fullscreen without a user gesture, so web is a no-op.
     */
    public async syncFullscreenState(): Promise<void> {
        if (this.isDesktop() && this.fullscreen) {
            await window.electronAPI!.setFullscreen(true);
        }
    }
}
