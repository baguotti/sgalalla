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
            // If we are in GameScene, we might want lower volume, but AudioManager 
            // generally sets the "Base" volume. 
            // Logic update: The game currently manually tweaks volume for GameScene vs Menu.
            // We should probably respect that ratio or let the Scene handle the specific ducking 
            // relative to this base volume.
            // For now, let's just update it directly, BUT we need to be careful about the GameScene ducking.
            // If we change volume here, it overrides the tween.

            // Simple approach: Update playing instance. Interactions with GameScene ducking 
            // might need the GameScene to query this manager.
            if (music instanceof Phaser.Sound.WebAudioSound || music instanceof Phaser.Sound.HTML5AudioSound) {
                (music as any).setVolume(this.musicVolume);
            }
        }
    }

    public playSFX(key: string, config: Phaser.Types.Sound.SoundConfig = {}): void {
        if (!this.scene) return;

        const finalConfig = {
            ...config,
            volume: (config.volume || 1) * this.sfxVolume
        };

        try {
            this.scene.sound.play(key, finalConfig);
        } catch (e) {
            console.warn(`[AudioManager] SFX key "${key}" not found in cache, skipping.`);
        }
    }
}
