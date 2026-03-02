import '../style.css';

const STORAGE_KEY = 'video_crt_intensity';

/** 0 = off, 1 = basso, 2 = medio, 3 = alto */
export type CrtIntensity = 0 | 1 | 2 | 3;

const INTENSITY_CLASS: Record<CrtIntensity, string> = {
    0: '',
    1: 'crt-basso',
    2: 'crt-medio',
    3: 'crt-alto',
};

export class VideoManager {
    private static instance: VideoManager;
    private crtIntensity: CrtIntensity = 0;
    private overlayElement: HTMLDivElement | null = null;  // scanlines
    private glowElement: HTMLDivElement | null = null;     // screen-blend highlight glow
    private svgFilter: SVGSVGElement | null = null;

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

    /** Generate a barrel-distortion displacement map via Canvas API */
    private generateBarrelMapDataUrl(): string {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.createImageData(size, size);
        const strength = 0.18; // subtle barrel

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Normalized coords: -1 to +1
                const nx = (x / (size - 1)) * 2 - 1;
                const ny = (y / (size - 1)) * 2 - 1;
                const r = Math.sqrt(nx * nx + ny * ny);
                // Barrel displacement: pixels pulled outward from center
                const dx = nx * r * strength;
                const dy = ny * r * strength;
                // Encode: 128 = no displacement
                const ri = Math.round(Math.max(0, Math.min(255, (dx + 1) * 0.5 * 255)));
                const gi = Math.round(Math.max(0, Math.min(255, (dy + 1) * 0.5 * 255)));
                const idx = (y * size + x) * 4;
                imageData.data[idx] = ri;
                imageData.data[idx + 1] = gi;
                imageData.data[idx + 2] = 0;
                imageData.data[idx + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    }

    /** Inject SVG filter for barrel/fisheye distortion */
    private injectBarrelFilter(): void {
        if (this.svgFilter) return; // already injected

        const mapUrl = this.generateBarrelMapDataUrl();
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
        svg.id = 'crt-svg-filters';
        svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden;');
        svg.innerHTML = `
            <defs>
                <filter id="crt-barrel" x="-5%" y="-5%" width="110%" height="110%"
                        color-interpolation-filters="sRGB">
                    <feImage href="${mapUrl}" preserveAspectRatio="none" result="map"/>
                    <feDisplacementMap in="SourceGraphic" in2="map"
                        scale="14"
                        xChannelSelector="R" yChannelSelector="G"/>
                </filter>
            </defs>`;
        document.body.appendChild(svg);
        this.svgFilter = svg;
    }

    private removeBarrelFilter(): void {
        if (this.svgFilter) {
            this.svgFilter.remove();
            this.svgFilter = null;
        }
        // Remove inline filter from canvas
        const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
        if (canvas) canvas.style.filter = '';
    }

    /** Call once on game boot — creates DOM elements and applies saved state */
    public applySettings(): void {
        // Create scanlines overlay
        if (!this.overlayElement) {
            this.overlayElement = document.createElement('div');
            this.overlayElement.classList.add('crt-overlay');
            document.body.appendChild(this.overlayElement);
        }

        // Create glow overlay (screen blend)
        if (!this.glowElement) {
            this.glowElement = document.createElement('div');
            this.glowElement.classList.add('crt-glow');
            document.body.appendChild(this.glowElement);
        }

        const cls = INTENSITY_CLASS[this.crtIntensity];

        // Reset both elements
        this.overlayElement.className = 'crt-overlay';
        this.glowElement.className = 'crt-glow';
        document.body.classList.remove('crt-alto');

        if (this.crtIntensity > 0 && cls) {
            this.overlayElement.classList.add('active', cls);
            this.glowElement.classList.add('active', cls);

            if (this.crtIntensity === 3) {
                document.body.classList.add('crt-alto');
                this.injectBarrelFilter();
                const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
                if (canvas) canvas.style.filter = 'url(#crt-barrel)';
            } else {
                this.removeBarrelFilter();
            }
        } else {
            this.removeBarrelFilter();
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
