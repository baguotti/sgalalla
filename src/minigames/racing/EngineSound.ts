import Phaser from 'phaser';
import { AudioManager } from '../../managers/AudioManager';

/**
 * A made-up engine and the wind, until real recordings replace them: two
 * detuned oscillators through a low-pass filter whose pitch climbs through
 * five gears and drops at each change, plus filtered noise that grows with
 * speed. Needs Web Audio; silent without it.
 */

const GEARS = 5;
/** Engine pitch at the bottom and top of each gear (Hz). */
const LOW_HZ = 55;
const HIGH_HZ = 150;

export class EngineSound {
    private readonly context: AudioContext | null;
    private readonly nodes: AudioNode[] = [];
    private low: OscillatorNode | null = null;
    private high: OscillatorNode | null = null;
    private filter: BiquadFilterNode | null = null;
    private engineGain: GainNode | null = null;
    private windGain: GainNode | null = null;
    private windFilter: BiquadFilterNode | null = null;

    constructor(scene: Phaser.Scene) {
        const manager = scene.sound as Phaser.Sound.WebAudioSoundManager;
        this.context = 'context' in manager ? manager.context : null;
        const context = this.context;
        if (!context) return;
        const out = (manager as unknown as { destination?: AudioNode }).destination ?? context.destination;
        const volume = AudioManager.getInstance().getSFXVolume();

        this.low = context.createOscillator();
        this.low.type = 'sawtooth';
        this.high = context.createOscillator();
        this.high.type = 'square';
        this.high.detune.value = 8;
        this.filter = context.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.Q.value = 4;
        this.engineGain = context.createGain();
        this.engineGain.gain.value = 0;
        const highMix = context.createGain();
        highMix.gain.value = 0.35;
        this.low.connect(this.filter);
        this.high.connect(highMix).connect(this.filter);
        this.filter.connect(this.engineGain);

        // Wind: a second of white noise, looping, through a band-pass
        const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
        const data = noise.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const wind = context.createBufferSource();
        wind.buffer = noise;
        wind.loop = true;
        this.windFilter = context.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.Q.value = 0.7;
        this.windGain = context.createGain();
        this.windGain.gain.value = 0;
        wind.connect(this.windFilter).connect(this.windGain);

        const master = context.createGain();
        master.gain.value = 0.5 * volume;
        this.engineGain.connect(master);
        this.windGain.connect(master);
        master.connect(out);

        this.low.start();
        this.high.start();
        wind.start();
        this.nodes.push(this.low, this.high, highMix, this.filter, this.engineGain, wind, this.windFilter, this.windGain, master);
    }

    /** `speed` 0 to 1 of top speed, `throttle` 0 to 1, `offRoad` rumbles. */
    update(speed: number, throttle: number, offRoad: boolean): void {
        const context = this.context;
        if (!context || !this.low || !this.high || !this.filter || !this.engineGain || !this.windGain || !this.windFilter) return;
        const now = context.currentTime;
        // Which gear, and how far through it: the pitch climbs, then drops at the change
        const gearSpan = 1 / GEARS;
        const gear = Math.min(GEARS - 1, Math.floor(speed / gearSpan));
        const through = (speed - gear * gearSpan) / gearSpan;
        const pitch = LOW_HZ + (HIGH_HZ - LOW_HZ) * (0.25 + 0.75 * through) + gear * 12;
        const idle = speed < 0.02 ? 42 : pitch;
        this.low.frequency.setTargetAtTime(idle, now, 0.05);
        this.high.frequency.setTargetAtTime(idle * 2, now, 0.05);
        this.filter.frequency.setTargetAtTime(300 + 1400 * throttle + 900 * speed, now, 0.08);
        this.engineGain.gain.setTargetAtTime(0.1 + 0.12 * throttle + 0.05 * speed, now, 0.08);
        this.windGain.gain.setTargetAtTime(0.25 * speed * speed + (offRoad && speed > 0.05 ? 0.2 : 0), now, 0.1);
        this.windFilter.frequency.setTargetAtTime(offRoad ? 250 : 500 + 2500 * speed, now, 0.1);
    }

    destroy(): void {
        for (const node of this.nodes) {
            if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) node.stop();
            node.disconnect();
        }
        this.nodes.length = 0;
    }
}
