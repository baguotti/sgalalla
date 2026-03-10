import Phaser from 'phaser';

export class AudioManager {
    private static instance: AudioManager;
    private musicVolume: number = 0.8;
    private sfxVolume: number = 1.0;
    private scene: Phaser.Scene | null = null;

    private constructor() { }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    private lastPitches: Map<string, number> = new Map();

    public init(scene: Phaser.Scene): void {
        this.scene = scene;
        this.loadSettings();

        // Apply initial music volume if music is already playing
        this.applyMusicVolume();
    }

    private loadSettings(): void {
        const savedMusic = localStorage.getItem('sgalalla_music_volume');
        const savedSFX = localStorage.getItem('sgalalla_sfx_volume');

        if (savedMusic !== null) {
            this.musicVolume = parseFloat(savedMusic);
        }
        if (savedSFX !== null) {
            this.sfxVolume = parseFloat(savedSFX);
        }
    }

    public getMusicVolume(): number {
        return this.musicVolume;
    }

    public getSFXVolume(): number {
        return this.sfxVolume;
    }

    public setMusicVolume(volume: number): void {
        this.musicVolume = Phaser.Math.Clamp(volume, 0, 1);
        localStorage.setItem('sgalalla_music_volume', this.musicVolume.toString());
        this.applyMusicVolume();
    }

    public setSFXVolume(volume: number): void {
        this.sfxVolume = Phaser.Math.Clamp(volume, 0, 1);
        localStorage.setItem('sgalalla_sfx_volume', this.sfxVolume.toString());
    }

    private applyMusicVolume(): void {
        if (!this.scene) return;

        // Update global music loop if it exists
        const music = this.scene.sound.get('global_music_loop');
        if (music && music.isPlaying) {
            // Simple approach: Update playing instance. Interactions with GameScene ducking 
            // might need the GameScene to query this manager.
            if (music instanceof Phaser.Sound.WebAudioSound || music instanceof Phaser.Sound.HTML5AudioSound) {
                (music as any).setVolume(this.musicVolume);
            }
        }
    }

    public playSFX(key: string, config: Phaser.Types.Sound.SoundConfig & { randomPitchRange?: number } = {}): void {
        if (!this.scene) return;

        let detune = config.detune || 0;
        
        // Add random pitch (detune) if requested to avoid repetitive sounds
        // e.g., randomPitchRange: 600 = ±300 detune cents (3 semitones)
        if (config.randomPitchRange) {
            const halfRange = config.randomPitchRange / 2;
            const lastDetune = this.lastPitches.get(key);
            
            let newDetune: number;
            let attempts = 0;
            
            // Loop until we find a different pitch than the one played previously for this key
            // (Max 10 attempts to avoid infinite loop if range is tiny/zero)
            do {
                newDetune = Phaser.Math.Between(-halfRange, halfRange);
                attempts++;
            } while (newDetune === lastDetune && attempts < 10);
            
            detune += newDetune;
            this.lastPitches.set(key, newDetune);
        }

        const finalConfig: Phaser.Types.Sound.SoundConfig = {
            ...config,
            detune,
            volume: (config.volume || 1) * this.sfxVolume
        };

        try {
            this.scene.sound.play(key, finalConfig);
        } catch (e) {
            console.warn(`[AudioManager] SFX key "${key}" not found in cache, skipping.`);
        }
    }
}
