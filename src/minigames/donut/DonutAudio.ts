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
 *   with the flame, a whoosh on reaching the green.
 *
 * Every volume follows the game's SFX volume (Settings) and the Lab's.
 */

const PATH = 'assets/audio/derapate/';
export const DONUT_SOUNDS = [
    'engine_1', 'engine_mid', 'engine_hot', 'screech',
    'screech_spin', 'boost', 'green', 'blowoff', 'backfire_2', 'overheat', 'car_down', 'thud', 'horn',
    'rev_1', 'rev_2', 'rev_3',
] as const;
const key = (name: string) => `donut_${name}`;
/** The three revs cut from the revving recording. */
const REVS = ['rev_1', 'rev_2', 'rev_3'] as const;

/** Load them all (in the scene's preload). */
export function preloadDonutSounds(scene: Phaser.Scene): void {
    for (const name of DONUT_SOUNDS) scene.load.audio(key(name), `${PATH}${name}.wav`);
}

export class DonutAudio {
    private readonly scene: Phaser.Scene;
    /** The engine: Riccardo's low loop, pitched with the revs, and a deep exhaust under it that grows with them. */
    private readonly engine: Phaser.Sound.BaseSound;
    private readonly exhaust: Phaser.Sound.BaseSound;
    private readonly hot: Phaser.Sound.BaseSound;
    private readonly screech: Phaser.Sound.BaseSound;
    /** The engine dying after overheating (stopped on a restart). */
    private dying: Phaser.Sound.BaseSound[] = [];
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

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        const loop = (name: string) => {
            const sound = scene.sound.add(key(name), { loop: true, volume: 0 });
            sound.play();
            return sound;
        };
        this.engine = loop('engine_1');
        this.exhaust = loop('engine_mid');
        this.hot = loop('engine_hot');
        this.screech = loop('screech');
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
                // Cut to start on its attack, so the vroom lands on the press; pitched to the engine's revs
                const rev = REVS[Math.floor(Math.random() * REVS.length)];
                const volume = LOOK.REV_VOLUME * LOOK.EFFECTS_VOLUME;
                if (volume > 0) AudioManager.getInstance().playSFX(key(rev), { volume, rate: 0.85 + 0.4 * Math.min(1.2, this.revs) });
                this.revCooldown = LOOK.REV_GAP;
            }
        }
        this.surge = Math.max(0, this.surge - step / 0.6);
        this.liftedFor = pedal ? 0 : this.liftedFor + step;
        this.lastPedal = pedal;

        // One engine, its pitch climbing all the way with the revs (never dropping to another recording), the surge on top
        const volume = frozen ? 0 : sfx * LOOK.ENGINE_VOLUME * this.running * (0.5 + 0.35 * this.load + 0.3 * this.surge);
        const rate = 0.75 + LOOK.ENGINE_PITCH * this.revs + 0.18 * this.surge * (1 - this.revs * 0.5);
        setLoop(this.engine, volume, Phaser.Math.Clamp(rate, 0.6, 2));
        setLoop(this.exhaust, volume * (0.25 + 0.5 * Math.min(1, this.revs)), Phaser.Math.Clamp(0.85 + 0.3 * this.revs, 0.6, 1.5));

        // MOTORE CALDO: the crackle comes in as the heat passes three quarters, and climbs in pitch towards overheating
        const hot = state.locked ? Phaser.Math.Clamp((state.heat - 0.72) / 0.28, 0, 1) : 0;
        this.hotLevel = ease(this.hotLevel, hot, hot > this.hotLevel ? 12 : 5);
        setLoop(this.hot, frozen ? 0 : sfx * LOOK.HOT_VOLUME * Math.min(1, this.hotLevel * 2.5) * this.running, 0.85 + 0.6 * this.hotLevel);

        // The tyres: spinning under power, the balance out, a testacoda
        const moving = Math.min(1, state.speed / DONUT.SPEED_MAX);
        const spin = state.spinning > 0 ? 1 : 0;
        const grip = moving * (pedal ? 0.35 + 0.45 * state.revs : 0.1) + Math.abs(state.slip) * 0.5 * moving + Math.abs(steer) * 0.15 * moving;
        this.squeal = ease(this.squeal, Math.max(spin, Math.min(1, grip)), 8);
        setLoop(this.screech, frozen ? 0 : sfx * LOOK.SCREECH_VOLUME * this.squeal, 0.9 + 0.2 * moving);
    }

    /** A one-shot, at the Lab's effects volume (playSFX adds the game's SFX volume and a little pitch variety). */
    play(name: typeof DONUT_SOUNDS[number], volume = 1, pitchRange = 200): void {
        if (volume * LOOK.EFFECTS_VOLUME <= 0) return;
        AudioManager.getInstance().playSFX(key(name), { volume: volume * LOOK.EFFECTS_VOLUME, randomPitchRange: pitchRange });
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
        const sfx = AudioManager.getInstance().getSFXVolume() * LOOK.EFFECTS_VOLUME;
        if (sfx <= 0) return;
        const down = this.scene.sound.add(key('car_down'), { volume: sfx });
        const hiss = this.scene.sound.add(key('overheat'), { volume: sfx * LOOK.HISS_VOLUME });
        down.play();
        hiss.play();
        this.dying = [down, hiss];
        this.running = 0;
        this.surge = 0;
    }

    /** A fresh start: no engine dying, the engine running. */
    reset(): void {
        this.stopDying();
        this.running = 1;
    }

    private stopDying(): void {
        for (const sound of this.dying) {
            sound.stop();
            sound.destroy();
        }
        this.dying = [];
    }

    destroy(): void {
        this.stopDying();
        for (const sound of [this.engine, this.exhaust, this.hot, this.screech]) {
            sound.stop();
            sound.destroy();
        }
    }
}

function setLoop(sound: Phaser.Sound.BaseSound, volume: number, rate: number): void {
    const s = sound as Phaser.Sound.WebAudioSound;
    if (typeof s.setVolume === 'function') s.setVolume(Math.max(0, volume));
    if (typeof s.setRate === 'function') s.setRate(rate);
}
