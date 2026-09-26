import Phaser from 'phaser';
import type { Lighting } from '../Lighting';

/**
 * The Studio Lab's frame statistics, drawn on the canvas in the debug panel's
 * style, top left, beside the FPS panel when that's shown.
 */

const PANEL_Y = 8;
const GAP = 8;
const PADDING = 10;
const LINE_HEIGHT = 18;
const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = { fontSize: '12px', fontFamily: '"Pixeloid Sans"', color: '#e0e0e0' };
const GOOD = '#8bef8b';
const WARN = '#f0c040';
const BAD = '#ef5350';
const LABEL = '#9e9e9e';
/** A 60 Hz frame's budget; the GPU gets a share of it before the frame is at risk. */
const FRAME_BUDGET_MS = 1000 / 60;

/** Frame rate and timings, drawing work and memory; refreshed four times a second. */
export class LabStats {
    private readonly scene: Phaser.Scene;
    private readonly lighting: Lighting;
    private readonly timing: FrameTiming;
    private readonly panel: Phaser.GameObjects.Graphics;
    private readonly labels: Phaser.GameObjects.Text[] = [];
    private readonly values: Phaser.GameObjects.Text[] = [];
    private readonly refresh: Phaser.Time.TimerEvent;
    private readonly leftOf: () => number;
    private textureMb = 0;
    private updates = 0;

    /** `leftOf` gives the right edge of whatever sits to the left (the FPS panel), 0 for none. */
    constructor(scene: Phaser.Scene, lighting: Lighting, hideFrom: Phaser.Cameras.Scene2D.Camera, leftOf: () => number) {
        this.scene = scene;
        this.lighting = lighting;
        this.leftOf = leftOf;
        this.timing = new FrameTiming(scene.game);
        this.panel = scene.add.graphics().setDepth(999).setScrollFactor(0);
        const rows = ['LAB', 'FPS', 'FRAME', 'CPU', 'GPU', 'DRAWS', 'OBJECTS', 'LIGHTS', 'VRAM'];
        rows.forEach((label, i) => {
            this.labels.push(scene.add.text(0, PANEL_Y + PADDING + i * LINE_HEIGHT, label, { ...TEXT_STYLE, color: LABEL }).setDepth(1000).setScrollFactor(0));
            this.values.push(scene.add.text(0, PANEL_Y + PADDING + i * LINE_HEIGHT, '', TEXT_STYLE).setDepth(1000).setScrollFactor(0));
        });
        hideFrom.ignore([this.panel, ...this.labels, ...this.values]);
        this.refresh = scene.time.addEvent({ delay: 250, loop: true, callback: () => this.update() });
        this.update();
    }

    setVisible(visible: boolean): void {
        this.panel.setVisible(visible);
        for (const text of [...this.labels, ...this.values]) text.setVisible(visible);
    }

    destroy(): void {
        this.refresh.remove();
        this.timing.destroy();
        this.panel.destroy();
        for (const text of [...this.labels, ...this.values]) text.destroy();
    }

    private update(): void {
        const t = this.timing.sample();
        const lighting = this.lighting;
        // Textures change rarely: once a second is plenty
        if (this.updates++ % 4 === 0) this.textureMb = textureMegabytes(this.scene);
        const children = this.scene.children.list;
        const shown = children.filter(child => (child as Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject).visible !== false).length;

        const lines: [string, string][] = [
            [lighting.isEnabled ? 'LIGHTS ON' : 'LIGHTS OFF', lighting.isEnabled ? GOOD : WARN],
            [`${t.fps.toFixed(0)}  low ${t.lowFps.toFixed(0)}`, t.lowFps >= 55 ? GOOD : t.lowFps >= 30 ? WARN : BAD],
            [`${t.frameMs.toFixed(1)} ms  max ${t.maxFrameMs.toFixed(1)}`, t.maxFrameMs <= FRAME_BUDGET_MS * 1.5 ? GOOD : WARN],
            [`${t.cpuMs.toFixed(2)} ms draw`, t.cpuMs < 3 ? GOOD : t.cpuMs < 6 ? WARN : BAD],
            t.gpuMs === null ? ['not timed here', LABEL]
                : [`${t.gpuMs.toFixed(2)} ms`, t.gpuMs < FRAME_BUDGET_MS * 0.4 ? GOOD : t.gpuMs < FRAME_BUDGET_MS * 0.7 ? WARN : BAD],
            [`${t.drawCalls} calls  ${t.triangles} tris`, t.drawCalls < 80 ? GOOD : t.drawCalls < 200 ? WARN : BAD],
            [`${shown} shown  ${children.length} total  ${lighting.litCount} lit`, '#e0e0e0'],
            [`${lighting.stageLights.length} stage  ${lighting.flashCount} flashes`, '#e0e0e0'],
            [`${this.textureMb.toFixed(0)} MB textures`, this.textureMb < 300 ? GOOD : this.textureMb < 600 ? WARN : BAD],
        ];

        const x = (this.leftOf() || 0) + GAP;
        const labelWidth = Math.max(...this.labels.map(label => label.width));
        let width = 0;
        lines.forEach(([text, color], i) => {
            this.labels[i].setX(x + PADDING);
            this.values[i].setX(x + PADDING + labelWidth + 10).setText(text).setColor(color);
            width = Math.max(width, labelWidth + 10 + this.values[i].width);
        });
        const height = lines.length * LINE_HEIGHT + PADDING * 2 - (LINE_HEIGHT - this.values[0].height);
        this.panel.clear()
            .fillStyle(0x0a0a0a, 0.7).fillRoundedRect(x, PANEL_Y, width + PADDING * 2, height, 6)
            .lineStyle(1, 0x333333, 0.5).strokeRoundedRect(x, PANEL_Y, width + PADDING * 2, height, 6);
    }
}

/** What every loaded texture takes in graphics memory, roughly: 4 bytes a pixel. */
function textureMegabytes(scene: Phaser.Scene): number {
    let bytes = 0;
    for (const key of scene.textures.getTextureKeys()) {
        for (const source of scene.textures.get(key).source) bytes += source.width * source.height * 4;
    }
    return bytes / (1024 * 1024);
}

interface TimingSample {
    fps: number;
    /** Frame rate of the slowest frame in the last second. */
    lowFps: number;
    frameMs: number;
    maxFrameMs: number;
    cpuMs: number;
    /** Null where the browser can't time the GPU. */
    gpuMs: number | null;
    drawCalls: number;
    triangles: number;
}

/** Per-frame timings and WebGL draw calls, gathered round the renderer's frame. */
class FrameTiming {
    private readonly game: Phaser.Game;
    private readonly renderer: Phaser.Renderer.WebGL.WebGLRenderer;
    private readonly gpu: GpuTimer | null;
    private readonly gl: WebGLRenderingContext;
    private readonly drawArrays: WebGLRenderingContext['drawArrays'];
    private readonly drawElements: WebGLRenderingContext['drawElements'];
    private renderStart = 0;
    private lastFrame = 0;
    private cpuMs = 0;
    private frameMs = FRAME_BUDGET_MS;
    /** Frame lengths over the last second, newest last. */
    private readonly recent: number[] = [];
    private calls = 0;
    private vertices = 0;
    private lastCalls = 0;
    private lastVertices = 0;

    constructor(game: Phaser.Game) {
        this.game = game;
        this.renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
        this.gl = this.renderer.gl;
        this.gpu = GpuTimer.create(this.gl);

        // Counting draw calls: the lab alone wraps them, and puts them back when it closes
        const gl = this.gl;
        this.drawArrays = gl.drawArrays;
        this.drawElements = gl.drawElements;
        const timing = this;
        gl.drawArrays = function (mode, first, count) {
            timing.calls++;
            timing.vertices += count;
            timing.drawArrays.call(gl, mode, first, count);
        };
        gl.drawElements = function (mode, count, type, offset) {
            timing.calls++;
            timing.vertices += count;
            timing.drawElements.call(gl, mode, count, type, offset);
        };

        this.renderer.on(Phaser.Renderer.Events.PRE_RENDER, this.onPreRender, this);
        this.renderer.on(Phaser.Renderer.Events.POST_RENDER, this.onPostRender, this);
    }

    sample(): TimingSample {
        const maxFrameMs = this.recent.length > 0 ? Math.max(...this.recent) : this.frameMs;
        return {
            fps: this.game.loop.actualFps,
            lowFps: 1000 / Math.max(maxFrameMs, 1),
            frameMs: this.frameMs,
            maxFrameMs,
            cpuMs: this.cpuMs,
            gpuMs: this.gpu ? this.gpu.ms : null,
            drawCalls: this.lastCalls,
            triangles: Math.round(this.lastVertices / 3),
        };
    }

    destroy(): void {
        this.gl.drawArrays = this.drawArrays;
        this.gl.drawElements = this.drawElements;
        this.renderer.off(Phaser.Renderer.Events.PRE_RENDER, this.onPreRender, this);
        this.renderer.off(Phaser.Renderer.Events.POST_RENDER, this.onPostRender, this);
        this.gpu?.destroy();
    }

    private onPreRender(): void {
        const now = performance.now();
        if (this.lastFrame > 0) {
            const length = now - this.lastFrame;
            this.frameMs += (length - this.frameMs) * 0.1;
            this.recent.push(length);
            if (this.recent.length > 60) this.recent.shift();
        }
        this.lastFrame = now;
        this.renderStart = now;
        this.calls = 0;
        this.vertices = 0;
        this.gpu?.begin();
    }

    private onPostRender(): void {
        this.gpu?.end();
        this.cpuMs += (performance.now() - this.renderStart - this.cpuMs) * 0.1;
        this.lastCalls = this.calls;
        this.lastVertices = this.vertices;
    }
}

/** The WebGL 1 timer query extension, where the browser offers it. */
interface TimerQueryExtension {
    TIME_ELAPSED_EXT: number;
    QUERY_RESULT_EXT: number;
    QUERY_RESULT_AVAILABLE_EXT: number;
    GPU_DISJOINT_EXT: number;
    createQueryEXT(): object;
    deleteQueryEXT(query: object): void;
    beginQueryEXT(target: number, query: object): void;
    endQueryEXT(target: number): void;
    getQueryObjectEXT(query: object, pname: number): number | boolean;
}

/** GPU time per frame, averaged. Results arrive a few frames late. */
class GpuTimer {
    ms = 0;
    private readonly gl: WebGLRenderingContext;
    private readonly ext: TimerQueryExtension;
    private active: object | null = null;
    private readonly pending: object[] = [];

    static create(gl: WebGLRenderingContext): GpuTimer | null {
        const ext = gl.getExtension('EXT_disjoint_timer_query') as TimerQueryExtension | null;
        return ext ? new GpuTimer(gl, ext) : null;
    }

    private constructor(gl: WebGLRenderingContext, ext: TimerQueryExtension) {
        this.gl = gl;
        this.ext = ext;
    }

    begin(): void {
        if (this.active) return;
        // A query whose result never comes (the tab was hidden, say) mustn't stop the timing
        if (this.pending.length > 4) this.ext.deleteQueryEXT(this.pending.shift()!);
        this.active = this.ext.createQueryEXT();
        this.ext.beginQueryEXT(this.ext.TIME_ELAPSED_EXT, this.active);
    }

    end(): void {
        if (!this.active) return;
        this.ext.endQueryEXT(this.ext.TIME_ELAPSED_EXT);
        this.pending.push(this.active);
        this.active = null;

        while (this.pending.length > 0) {
            const query = this.pending[0];
            if (!this.ext.getQueryObjectEXT(query, this.ext.QUERY_RESULT_AVAILABLE_EXT)) break;
            if (!this.gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
                const ms = Number(this.ext.getQueryObjectEXT(query, this.ext.QUERY_RESULT_EXT)) / 1e6;
                this.ms += (ms - this.ms) * 0.1;
            }
            this.ext.deleteQueryEXT(query);
            this.pending.shift();
        }
    }

    destroy(): void {
        if (this.active) {
            this.ext.endQueryEXT(this.ext.TIME_ELAPSED_EXT);
            this.pending.push(this.active);
            this.active = null;
        }
        for (const query of this.pending) this.ext.deleteQueryEXT(query);
        this.pending.length = 0;
    }
}
