import '../style.css';

const STORAGE_KEY = 'video_crt_intensity';

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

    private constructor() {
        this.load();
    }

    public static getInstance(): VideoManager {
        if (!VideoManager.instance) {
            VideoManager.instance = new VideoManager();
        }
        return VideoManager.instance;
    }

    private load(): void {
        const saved = localStorage.getItem(STORAGE_KEY);
        const parsed = Number(saved);
        if (parsed >= 0 && parsed <= 3) {
            this.crtIntensity = parsed as CrtIntensity;
        }
    }

    private save(): void {
        localStorage.setItem(STORAGE_KEY, String(this.crtIntensity));
    }

    /** Call once on game boot — creates the single overlay and applies saved state */
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

    /** Cycle: 0 → 1 → 2 → 3 → 0 */
    public cycleCrt(): void {
        this.setCrtIntensity(((this.crtIntensity + 1) % 4) as CrtIntensity);
    }
}
