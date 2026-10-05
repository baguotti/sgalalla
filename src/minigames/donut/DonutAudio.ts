import Phaser from 'phaser';
import { AudioManager } from '../../managers/AudioManager';
import { LOOK } from './DonutLook';
import { DONUT, whiteShare, type DonutState } from './DonutSim';

/**
 * DERAPATE's sounds, from Riccardo's recordings (public/assets/audio/derapate):
 *
 * - the engine: the low loop Riccardo liked, its pitch climbing all the way with
 *   the revs, a deep exhaust under it; every fresh stab of the pedal surges it
 *   and most times a rev rips over it (vroom); louder with the pedal down,
 *   bouncing at the top in the green; as the engine nears overheating (MOTORE
 *   CALDO) the straight-pipe crackle comes in, rising in pitch with the heat;
 *   cut when it stalls (the engine winding down and dying, the hiss over it);
 * - the tyres: a screech loop, louder the harder the wheels spin and the further
 *   the balance is out;
 * - one-shots: the nitrous on a white person, a thud and a horn on a blue one,
 *   a screech for the testacoda, quiet exhaust pops and the turbo's blow-off
 *   with the flame, a whoosh on reaching the green;
 * - DERAPATE's own song (Zutomayo_001) in place of the game's music, which
 *   comes back on leaving.
 *
 * The loops and the revs load before DERAPATE starts; the song and the other
 * one-shots in the background once it's running (one not in yet is skipped).
 * Every volume follows the game's Settings and the Lab's.
 */

type Sound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.NoAudioSound;

const PATH = 'assets/audio/derapate/';
/** Needed from the first press: loaded before DERAPATE starts. */
const LOOPS = ['engine_1', 'engine_mid', 'engine_hot', 'screech'] as const;
/** The three revs cut from the revving recording, each starting on its attack. */
const REVS = ['rev_1', 'rev_2', 'rev_3'] as const;
/** Loaded in the background. */
const LATER = ['screech_spin', 'boost', 'green', 'blowoff', 'backfire_2', 'overheat', 'car_down', 'thud', 'horn'] as const;
type DonutSound = typeof LOOPS[number] | typeof REVS[number] | typeof LATER[number];
const SONG = { key: 'derapate_soundtrack', path: 'assets/audio/music/derapate_zutomayo_001.mp3' };
const GAME_MUSIC = 'global_music_loop';
const key = (name: DonutSound) => `donut_${name}`;

/** Load the loops and the revs (in the scene's preload). */
export function preloadDonutSounds(scene: Phaser.Scene): void {
    for (const name of [...LOOPS, ...REVS]) scene.load.audio(key(name), `${PATH}${name}.wav`);
}

export class DonutAudio {
    private readonly scene: Phaser.Scene;
    /** The engine: Riccardo's low loop, pitched with the revs, and a deep exhaust under it that grows with them. */
    private readonly engine: Loop;
    private readonly exhaust: Loop;
    private readonly hot: Loop;
    private readonly screech: Loop;
    private song: Loop | null = null;
    /** The engine dying after overheating (stopped on a restart). */
    private readonly dying: Sound[] = [];
    /** The engine's revs as heard (eased), the surge of a fresh stab (1 just pressed, fading), and how much of it is running (0 stalled). */
    private revs = 0;
    private surge = 0;
    private load = 0;
    private running = 1;
    private squeal = 0;
    private hotLevel = 0;
    /** For the vroom on a stab: the pedal last frame, how long it's been up, and the wait before another rev sound. */
    private lastPedal = 0;
    private liftedFor = 1;
    private revCooldown = 0;
    private destroyed = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.engine = new Loop(scene, key('engine_1'));
        this.exhaust = new Loop(scene, key('engine_mid'));
        this.hot = new Loop(scene, key('engine_hot'));
        this.screech = new Loop(scene, key('screech'));

        // The game's music fades out; the song and the rest of the sounds load in the background, so the game starts at once
        const music = scene.sound.get(GAME_MUSIC);
        if (music?.isPlaying) scene.tweens.add({ targets: music, volume: 0, duration: 600, onComplete: () => music.pause() });
        for (const name of LATER) scene.load.audio(key(name), `${PATH}${name}.wav`);
        if (scene.cache.audio.exists(SONG.key)) {
            this.startSong();
        } else {
            scene.load.audio(SONG.key, SONG.path);
            scene.load.once(`filecomplete-audio-${SONG.key}`, () => this.startSong());
        }
        scene.load.start();
    }

    /** Every frame: the loops follow the car. `dt` in seconds (0 while frozen: everything quiet). */
    update(state: DonutState, dt: number, steer: number): void {
        const sfx = AudioManager.getInstance().getSFXVolume();
        const frozen = dt <= 0;
        const step = Math.max(dt, 0);
        const ease = (from: number, to: number, rate: number) => from + (to - from) * Math.min(1, rate * step);

        // The revs heard: the rev bar (past the top while a burst carries the car faster), bouncing on the limiter in the green
        const share = Math.min(1.4, state.speed / DONUT.SPEED_MAX);
        let target = state.locked ? 1 + 0.035 * Math.sin(state.steps * 0.9) : Math.max(whiteShare(state), share * 0.9);
        if (state.speed > DONUT.SPEED_MAX) target = Math.max(target, share);
        if (state.stalled) target = 0;
        this.revs = ease(this.revs, target, target > this.revs ? 5 : 3);
        const pedal = state.lifted === 0 && state.spinning === 0 && !state.stalled ? 1 : 0;
        this.load = ease(this.load, pedal, pedal ? 12 : 4);
        this.running = ease(this.running, state.stalled ? 0 : 1, state.stalled ? 6 : 1.2);

        // Vroom: a fresh stab of the pedal (after a lift) surges the engine, and most times a rev rips over it
        this.revCooldown = Math.max(0, this.revCooldown - step);
        if (pedal === 1 && this.lastPedal === 0 && this.liftedFor > 0.15) {
            this.surge = 1;
            if (this.revCooldown === 0 && Math.random() < LOOK.REV_CHANCE) {
                // Pitched to the engine's revs
                const rev = REVS[Math.floor(Math.random() * REVS.length)];
                this.play(rev, LOOK.REV_VOLUME, 0, 0.85 + 0.4 * Math.min(1.2, this.revs));
                this.revCooldown = LOOK.REV_GAP;
            }
        }
        this.surge = Math.max(0, this.surge - step / 0.6);
        this.liftedFor = pedal ? 0 : this.liftedFor + step;
        this.lastPedal = pedal;

        // One engine, its pitch climbing all the way with the revs (never dropping to another recording), the surge on top
        const volume = frozen ? 0 : sfx * LOOK.ENGINE_VOLUME * this.running * (0.5 + 0.35 * this.load + 0.3 * this.surge);
        const rate = 0.75 + LOOK.ENGINE_PITCH * this.revs + 0.18 * this.surge * (1 - this.revs * 0.5);
        this.engine.set(volume, Phaser.Math.Clamp(rate, 0.6, 2));
        this.exhaust.set(volume * (0.25 + 0.5 * Math.min(1, this.revs)), Phaser.Math.Clamp(0.85 + 0.3 * this.revs, 0.6, 1.5));

        // MOTORE CALDO: the crackle comes in as the heat passes three quarters, and climbs in pitch towards overheating
        const hot = state.locked ? Phaser.Math.Clamp((state.heat - 0.72) / 0.28, 0, 1) : 0;
        this.hotLevel = ease(this.hotLevel, hot, hot > this.hotLevel ? 12 : 5);
        this.hot.set(frozen ? 0 : sfx * LOOK.HOT_VOLUME * Math.min(1, this.hotLevel * 2.5) * this.running, 0.85 + 0.6 * this.hotLevel);

        // The tyres: spinning under power, the balance out, a testacoda
        const moving = Math.min(1, state.speed / DONUT.SPEED_MAX);
        const spin = state.spinning > 0 ? 1 : 0;
        const grip = moving * (pedal ? 0.35 + 0.45 * state.revs : 0.1) + Math.abs(state.slip) * 0.5 * moving + Math.abs(steer) * 0.15 * moving;
        this.squeal = ease(this.squeal, Math.max(spin, Math.min(1, grip)), 8);
        this.screech.set(frozen ? 0 : sfx * LOOK.SCREECH_VOLUME * this.squeal, 0.9 + 0.2 * moving);

        this.keepSongPlaying();
    }

    /** Reaching the green: a whoosh. */
    lock(): void {
        this.play('green', 1, 0);
    }

    /** A testacoda: the tyres scream. */
    spin(): void {
        this.play('screech_spin', 0.9, 150);
    }

    /** Someone hit: the nitrous for a white one; a thud, then the driver's horn, for a blue one. */
    hit(boost: boolean): void {
        if (boost) {
            this.play('boost', 0.8);
            return;
        }
        this.play('thud', 1);
        this.scene.time.delayedCall(140, () => this.play('horn', 0.45, 150));
    }

    /** Exhaust pops with the flame (and, lifting off, the turbo's blow-off), quietly. */
    backfire(liftOff: boolean): void {
        this.play('backfire_2', LOOK.FLAME_VOLUME, 300);
        if (liftOff) this.play('blowoff', LOOK.FLAME_VOLUME * 0.8, 200);
    }

    /**
     * The engine gives out, all at once: the engine loops cut, the engine winds
     * down and dies (Car_Down) with the overheat's hiss over it, while the car
     * coasts back to the middle. A restart stops them.
     */
    overheat(): void {
        this.stopDying();
        this.running = 0;
        this.surge = 0;
        const volume = AudioManager.getInstance().getSFXVolume() * LOOK.EFFECTS_VOLUME;
        this.addDying('car_down', volume);
        this.addDying('overheat', volume * LOOK.HISS_VOLUME);
    }

    /** A fresh start: no engine dying, the engine running. */
    reset(): void {
        this.stopDying();
        this.running = 1;
    }

    /** Everything stopped, and the game's music back. */
    destroy(): void {
        this.destroyed = true;
        this.stopDying();
        for (const loop of [this.engine, this.exhaust, this.hot, this.screech, this.song]) loop?.destroy();
        this.song = null;
        const music = this.scene.sound.get<Sound>(GAME_MUSIC);
        if (music) {
            music.setVolume(AudioManager.getInstance().getMusicVolume());
            if (music.isPaused) music.resume();
            else if (!music.isPlaying) music.play({ loop: true });
        }
    }

    /**
     * A one-shot at the Lab's effects volume, if it's loaded (playSFX adds the
     * game's SFX volume and `pitchRange` cents of variety; `rate` plays it faster).
     */
    private play(name: DonutSound, volume: number, pitchRange = 200, rate = 1): void {
        const share = volume * LOOK.EFFECTS_VOLUME;
        if (share <= 0 || !this.scene.cache.audio.exists(key(name))) return;
        AudioManager.getInstance().playSFX(key(name), { volume: share, rate, randomPitchRange: pitchRange });
    }

    /** The song comes in over a second, at the Settings' music volume times the Lab's. */
    private startSong(): void {
        if (this.destroyed || this.song) return;
        this.song = new Loop(this.scene, SONG.key);
        this.scene.tweens.add({ targets: this.song.sound, volume: songVolume(), duration: 1200 });
    }

    /**
     * The song follows the volumes (once it has faded in) and keeps playing: if
     * anything stops it while the page is showing (focus, full screen…), it
     * picks up again.
     */
    private keepSongPlaying(): void {
        if (!this.song) return;
        const sound = this.song.sound;
        if (!sound.isPlaying && !document.hidden && !this.scene.sound.locked) {
            if (sound.isPaused) sound.resume();
            else sound.play({ loop: true, volume: songVolume() });
        }
        if (sound.isPlaying && !this.scene.tweens.isTweening(sound)) this.song.set(songVolume(), 1);
    }

    private addDying(name: DonutSound, volume: number): void {
        if (volume <= 0 || !this.scene.cache.audio.exists(key(name))) return;
        const sound = this.scene.sound.add(key(name), { volume });
        sound.play();
        this.dying.push(sound);
    }

    private stopDying(): void {
        for (const sound of this.dying) sound.destroy();
        this.dying.length = 0;
    }
}

function songVolume(): number {
    return AudioManager.getInstance().getMusicVolume() * LOOK.MUSIC_VOLUME;
}

/**
 * A looping sound, and the volume and rate it was last given: only a change
 * (to the thousandth, too fine to hear) goes to the browser's audio, so a
 * steady engine costs nothing.
 */
class Loop {
    readonly sound: Sound;
    private volume = -1;
    private rate = -1;

    constructor(scene: Phaser.Scene, soundKey: string) {
        this.sound = scene.sound.add(soundKey, { loop: true, volume: 0 });
        this.sound.play();
    }

    set(volume: number, rate: number): void {
        const v = Math.round(Math.max(0, volume) * 1000) / 1000;
        const r = Math.round(rate * 1000) / 1000;
        if (v !== this.volume) {
            this.volume = v;
            this.sound.setVolume(v);
        }
        if (r !== this.rate) {
            this.rate = r;
            this.sound.setRate(r);
        }
    }

    destroy(): void {
        this.sound.destroy();
    }
}
