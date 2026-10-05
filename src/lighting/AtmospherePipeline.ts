import Phaser from 'phaser';
import type { Look } from './Look';

/** The look settings the atmosphere pass reads (the fighting game's Look has them all; DERAPATE makes its own). */
export type AtmosphereLook = Pick<Look,
    'bloomThreshold' | 'bloomStrength' | 'bloomSpread' | 'rayLength' | 'rayFade' | 'mist' | 'aberration' | 'tiltShift' | 'tiltFocus'
    | 'tiltBand' | 'exposure' | 'temperature' | 'saturation' | 'contrast' | 'vignette' | 'grain' | 'grainSize' | 'crt' | 'crtLineSize' | 'crtMask'>;

/** What the atmosphere pass draws this frame, in the camera picture's coordinates (0 to 1, y up). */
export interface AtmosphereFrame {
    look: AtmosphereLook;
    sunX: number;
    sunY: number;
    /** How far round the sun the sky gives off rays, in screen heights. */
    sunReach: number;
    rayColor: [number, number, number];
    /** World y at the bottom of the screen, and the world height the screen spans. */
    worldBottom: number;
    worldHeight: number;
}

/** Mist fills in from just under the main platform's top and is thickest well below it (world y). */
const MIST_TOP = 880;
const MIST_FULL = 1500;
const MIST_COLOR = [0.42, 0.38, 0.55];

const PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

/** Bloom levels below the half-size one: 1/4 down to 1/64 of the screen. */
const BLOOM_LEVELS = 5;

// Half size: rgb = what blooms, a = how much sky light starts a ray here
const PREFILTER_SHADER = `
#define SHADER_NAME SGALALLA_ATMOSPHERE_PREFILTER_FS
${PRECISION}
uniform sampler2D uMainSampler;
uniform vec2 uTexel;
uniform float uThreshold;
uniform vec2 uSun;
uniform float uSunReach;
uniform float uAspect;

varying vec2 outTexCoord;

void main ()
{
    // Average of the 4x4 pixels round this one, each weighted down by its brightness
    // (Karis average), so a lone bright pixel can't make the bloom flicker as things move
    vec3 s0 = texture2D(uMainSampler, outTexCoord + uTexel * vec2(-1.0, -1.0)).rgb;
    vec3 s1 = texture2D(uMainSampler, outTexCoord + uTexel * vec2(1.0, -1.0)).rgb;
    vec3 s2 = texture2D(uMainSampler, outTexCoord + uTexel * vec2(-1.0, 1.0)).rgb;
    vec3 s3 = texture2D(uMainSampler, outTexCoord + uTexel * vec2(1.0, 1.0)).rgb;
    float w0 = 1.0 / (1.0 + max(s0.r, max(s0.g, s0.b)));
    float w1 = 1.0 / (1.0 + max(s1.r, max(s1.g, s1.b)));
    float w2 = 1.0 / (1.0 + max(s2.r, max(s2.g, s2.b)));
    float w3 = 1.0 / (1.0 + max(s3.r, max(s3.g, s3.b)));
    vec3 c = (s0 * w0 + s1 * w1 + s2 * w2 + s3 * w3) / (w0 + w1 + w2 + w3);

    float brightness = max(c.r, max(c.g, c.b));

    // Only what's brighter than the threshold blooms, easing in over a soft knee
    float knee = 0.5 * uThreshold + 0.0001;
    float soft = clamp(brightness - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee);
    vec3 bloom = c * (max(soft, brightness - uThreshold) / max(brightness, 0.0001));

    // Bright sky near the sun starts rays; whatever is dark in front of it doesn't
    vec2 fromSun = (outTexCoord - uSun) * vec2(uAspect, 1.0);
    float nearSun = clamp(1.0 - length(fromSun) / uSunReach, 0.0, 1.0);

    gl_FragColor = vec4(bloom, brightness * brightness * nearSun * nearSun);
}
`;

// Halves the picture: 13 samples over the 4x4 source pixels round each one, which
// shrinks without the blockiness of a plain average (as in Call of Duty's bloom)
const DOWNSAMPLE_SHADER = `
#define SHADER_NAME SGALALLA_ATMOSPHERE_DOWNSAMPLE_FS
${PRECISION}
uniform sampler2D uMainSampler;
uniform vec2 uTexel;

varying vec2 outTexCoord;

vec3 at (float x, float y)
{
    return texture2D(uMainSampler, outTexCoord + uTexel * vec2(x, y)).rgb;
}

void main ()
{
    vec3 c = at(0.0, 0.0) * 0.125;
    c += (at(-2.0, 2.0) + at(2.0, 2.0) + at(-2.0, -2.0) + at(2.0, -2.0)) * 0.03125;
    c += (at(0.0, 2.0) + at(-2.0, 0.0) + at(2.0, 0.0) + at(0.0, -2.0)) * 0.0625;
    c += (at(-1.0, 1.0) + at(1.0, 1.0) + at(-1.0, -1.0) + at(1.0, -1.0)) * 0.125;
    gl_FragColor = vec4(c, 1.0);
}
`;

// Doubles a smaller level back up with a 3x3 tent filter and adds this level's own
// light: repeated up the chain, the glow spreads wide and fades out smoothly
const UPSAMPLE_SHADER = `
#define SHADER_NAME SGALALLA_ATMOSPHERE_UPSAMPLE_FS
${PRECISION}
uniform sampler2D uMainSampler;
uniform sampler2D uLevel;
uniform vec2 uTexel;
uniform float uWider;

varying vec2 outTexCoord;

vec3 at (float x, float y)
{
    return texture2D(uMainSampler, outTexCoord + uTexel * vec2(x, y)).rgb;
}

void main ()
{
    vec3 wide = at(0.0, 0.0) * 4.0;
    wide += (at(0.0, 1.0) + at(-1.0, 0.0) + at(1.0, 0.0) + at(0.0, -1.0)) * 2.0;
    wide += at(-1.0, 1.0) + at(1.0, 1.0) + at(-1.0, -1.0) + at(1.0, -1.0);
    gl_FragColor = vec4(texture2D(uLevel, outTexCoord).rgb + wide * (uWider / 16.0), 1.0);
}
`;

// 9-tap gaussian from 5 bilinear samples along uDirection (tilt-shift)
const BLUR_SHADER = `
#define SHADER_NAME SGALALLA_ATMOSPHERE_BLUR_FS
${PRECISION}
uniform sampler2D uMainSampler;
uniform vec2 uDirection;

varying vec2 outTexCoord;

void main ()
{
    vec2 near = uDirection * 1.3846153846;
    vec2 far = uDirection * 3.2307692308;
    vec3 c = texture2D(uMainSampler, outTexCoord).rgb * 0.2270270270;
    c += (texture2D(uMainSampler, outTexCoord + near).rgb + texture2D(uMainSampler, outTexCoord - near).rgb) * 0.3162162162;
    c += (texture2D(uMainSampler, outTexCoord + far).rgb + texture2D(uMainSampler, outTexCoord - far).rgb) * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
}
`;

// Walks from each pixel toward the sun adding up the sky light on the way, so
// anything dark in between leaves a shadow in the rays
const RAYS_SHADER = `
#define SHADER_NAME SGALALLA_ATMOSPHERE_RAYS_FS
${PRECISION}
#define SAMPLES 32

uniform sampler2D uMainSampler;
uniform vec2 uSun;
uniform float uLength;
uniform float uFade;

varying vec2 outTexCoord;

void main ()
{
    vec2 stride = (uSun - outTexCoord) * (uLength / float(SAMPLES));
    vec2 uv = outTexCoord;
    float weight = 1.0;
    float sum = 0.0;

    for (int i = 0; i < SAMPLES; i++)
    {
        uv += stride;
        sum += texture2D(uMainSampler, uv).a * weight;
        weight *= uFade;
    }

    gl_FragColor = vec4(vec3(sum / float(SAMPLES)), 1.0);
}
`;

const COMPOSITE_SHADER = `
#define SHADER_NAME SGALALLA_ATMOSPHERE_COMPOSITE_FS
${PRECISION}
uniform sampler2D uMainSampler;
uniform sampler2D uBloom;
uniform sampler2D uRays;
uniform sampler2D uBlurred;
uniform float uBloomStrength;
uniform vec3 uRayColor;
uniform float uAspect;
uniform vec2 uWorldY;
uniform vec2 uMistRange;
uniform vec4 uMist;
uniform float uAberration;
// amount, height of the sharp band's centre, band width
uniform vec3 uTilt;
uniform float uExposure;
uniform vec3 uWhiteBalance;
uniform float uSaturation;
uniform float uContrast;
uniform float uVignette;
// amount, grain size in pixels, a new random offset each frame
uniform vec3 uGrain;
// strength, scanline spacing in pixels, stripe mask strength
uniform vec3 uCrt;

varying vec2 outTexCoord;

float hash (vec2 p)
{
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main ()
{
    vec2 uv = outTexCoord;
    vec3 c;

    if (uAberration > 0.0)
    {
        // Red and blue pulled apart, more toward the edges
        vec2 shift = (uv - 0.5) * (uAberration * 0.01);
        c = vec3(texture2D(uMainSampler, uv + shift).r, texture2D(uMainSampler, uv).g, texture2D(uMainSampler, uv - shift).b);
    }
    else
    {
        c = texture2D(uMainSampler, uv).rgb;
    }

    if (uTilt.x > 0.0)
    {
        float outside = abs(uv.y - uTilt.y) - uTilt.z * 0.5;
        c = mix(c, texture2D(uBlurred, uv).rgb, uTilt.x * smoothstep(0.0, 0.25, outside));
    }

    // Mist below the stage, by world height so it stays put as the camera moves
    float worldY = uWorldY.x - uWorldY.y * uv.y;
    c = mix(c, uMist.rgb, smoothstep(uMistRange.x, uMistRange.y, worldY) * uMist.a);

    c += texture2D(uBloom, uv).rgb * uBloomStrength;
    c += texture2D(uRays, uv).r * uRayColor;

    c *= uExposure * uWhiteBalance;
    float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(luma), c, uSaturation);
    c = (c - 0.5) * uContrast + 0.5;

    vec2 fromCentre = (uv - 0.5) * vec2(uAspect, 1.0);
    c *= 1.0 - uVignette * dot(fromCentre, fromCentre);

    if (uCrt.x > 0.0)
    {
        // Scanlines by screen row, and columns leaning red, green or blue like a CRT's phosphor stripes
        float scanline = mix(1.0, 0.5 + 0.5 * cos(6.2831853 * gl_FragCoord.y / uCrt.y), 0.6);
        float column = mod(floor(gl_FragCoord.x), 3.0);
        vec3 stripe = column < 1.0 ? vec3(1.0, 0.7, 0.7) : column < 2.0 ? vec3(0.7, 1.0, 0.7) : vec3(0.7, 0.7, 1.0);
        vec3 mask = mix(vec3(1.0), stripe, uCrt.z);
        // Brightened back by what the lines and stripes take away on average
        vec3 crt = c * scanline * mask / (0.7 * mix(1.0, 0.8, uCrt.z));
        c = mix(c, crt, uCrt.x);
    }

    if (uGrain.x > 0.0)
    {
        c += (hash(floor(gl_FragCoord.xy / uGrain.y) + uGrain.z) - 0.5) * uGrain.x;
    }

    // A little noise breaks up banding in the smooth gradients
    c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;

    gl_FragColor = vec4(c, 1.0);
}
`;

/**
 * The main camera's post-processing: bloom on the bright parts, sun rays that
 * fighters and platforms block, mist, and a camera look (grading, vignette,
 * grain, colour fringes, tilt-shift, CRT).
 *
 * Bloom: the bright parts at half size, halved again level by level down to
 * 1/64, then doubled back up, each level adding its own light: a soft glow
 * near bright things and a wide one round them, fading out smoothly. Spread
 * sets how much the wider levels count. Rays and tilt-shift run at a quarter
 * of the size, each only while it's on.
 */
export class AtmospherePipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
    /** Set each frame by Lighting; without it the camera's picture passes through. */
    frame: AtmosphereFrame | null = null;

    constructor(game: Phaser.Game) {
        super({
            game,
            shaders: [
                { name: 'prefilter', fragShader: PREFILTER_SHADER },
                { name: 'blur', fragShader: BLUR_SHADER },
                { name: 'rays', fragShader: RAYS_SHADER },
                { name: 'composite', fragShader: COMPOSITE_SHADER },
                { name: 'downsample', fragShader: DOWNSAMPLE_SHADER },
                { name: 'upsample', fragShader: UPSAMPLE_SHADER },
            ],
            // The camera draws into the first, at full size; then rays, tilt-shift and its work
            // space at a quarter; the bloom's half-size level; its smaller levels going down;
            // and for the way back up, the finished half-size bloom and the sizes in between
            renderTarget: [
                { scale: 1 }, { scale: 0.25 }, { scale: 0.25 }, { scale: 0.25 }, { scale: 0.5 },
                ...bloomScales().map(scale => ({ scale })),
                { scale: 0.5 }, ...bloomScales().slice(0, -1).map(scale => ({ scale })),
            ],
        });
    }

    onDraw(target: Phaser.Renderer.WebGL.RenderTarget): void {
        const frame = this.frame;
        if (!frame) {
            this.bindAndDraw(target);
            return;
        }

        const look = frame.look;
        const [, rayTarget, work, blurred, bright] = this.renderTargets;
        const [prefilter, blur, rays, composite] = this.shaders;
        const aspect = target.width / target.height;

        this.set2f('uTexel', 1 / target.width, 1 / target.height, prefilter);
        this.set1f('uThreshold', look.bloomThreshold, prefilter);
        this.set2f('uSun', frame.sunX, frame.sunY, prefilter);
        this.set1f('uSunReach', frame.sunReach, prefilter);
        this.set1f('uAspect', aspect, prefilter);
        this.bindAndDraw(target, bright, true, true, prefilter);
        const { bloom, strength } = this.bloomChain(bright, look.bloomSpread);

        // The whole picture blurred, for tilt-shift
        if (look.tiltShift > 0) {
            this.set2f('uDirection', 0, 0, blur);
            this.bindAndDraw(target, blurred, true, true, blur);
            this.blurTwice(blurred, work, blurred, 2);
        }

        // No ray colour (no sun, or rays off): the composite adds nothing from the rays' target, so skip the pass
        const [r, g, b] = frame.rayColor;
        if (r > 0 || g > 0 || b > 0) {
            this.set2f('uSun', frame.sunX, frame.sunY, rays);
            this.set1f('uLength', look.rayLength, rays);
            this.set1f('uFade', look.rayFade, rays);
            this.bindAndDraw(bright, rayTarget, true, true, rays);
        }

        const warmth = look.temperature * 0.1;
        this.set1i('uBloom', 1, composite);
        this.set1i('uRays', 2, composite);
        this.set1i('uBlurred', 3, composite);
        this.set1f('uBloomStrength', look.bloomStrength * strength, composite);
        this.set3f('uRayColor', r, g, b, composite);
        this.set1f('uAspect', aspect, composite);
        this.set2f('uWorldY', frame.worldBottom, frame.worldHeight, composite);
        this.set2f('uMistRange', MIST_TOP, MIST_FULL, composite);
        this.set4f('uMist', MIST_COLOR[0], MIST_COLOR[1], MIST_COLOR[2], look.mist, composite);
        this.set1f('uAberration', look.aberration, composite);
        this.set3f('uTilt', look.tiltShift, look.tiltFocus, look.tiltBand, composite);
        this.set1f('uExposure', look.exposure, composite);
        this.set3f('uWhiteBalance', 1 + warmth, 1, 1 - warmth, composite);
        this.set1f('uSaturation', look.saturation, composite);
        this.set1f('uContrast', look.contrast, composite);
        this.set1f('uVignette', look.vignette, composite);
        this.set3f('uGrain', look.grain, look.grainSize, Math.random() * 100, composite);
        this.set3f('uCrt', look.crt, look.crtLineSize, look.crtMask, composite);

        this.bindTexture(bloom.texture, 1);
        this.bindTexture(rayTarget.texture, 2);
        this.bindTexture(blurred.texture, 3);
        this.bindAndDraw(target, undefined, false, false, composite);

        const gl = this.gl;
        for (let unit = 3; unit >= 1; unit--) {
            gl.activeTexture(gl.TEXTURE0 + unit);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
        gl.activeTexture(gl.TEXTURE0);
    }

    /**
     * The bloom: `bright` halved level by level, then each level doubled back up
     * onto the next one out. Returns the result (half size) and what to multiply
     * it by so the Lab's strength means the same at any spread.
     */
    private bloomChain(bright: Phaser.Renderer.WebGL.RenderTarget, spread: number): { bloom: Phaser.Renderer.WebGL.RenderTarget; strength: number } {
        const down = this.renderTargets.slice(5, 5 + BLOOM_LEVELS);
        // up[0] is the finished bloom at half size; up[i + 1] is down[i]'s size
        const up = this.renderTargets.slice(5 + BLOOM_LEVELS, 5 + 2 * BLOOM_LEVELS);
        const downsample = this.shaders[4];
        const upsample = this.shaders[5];
        // How much each wider level counts against the one above it
        const wider = 0.35 + 0.2 * spread;

        let source = bright;
        for (const level of down) {
            this.set2f('uTexel', 1 / source.width, 1 / source.height, downsample);
            this.bindAndDraw(source, level, true, true, downsample);
            source = level;
        }

        // Back up: the smallest level onto the next, and so on up to half size
        this.set1i('uLevel', 1, upsample);
        this.set1f('uWider', wider, upsample);
        let smaller = down[BLOOM_LEVELS - 1];
        for (let i = BLOOM_LEVELS - 2; i >= -1; i--) {
            const level = i >= 0 ? down[i] : bright;
            const into = up[i + 1];
            this.set2f('uTexel', 1 / smaller.width, 1 / smaller.height, upsample);
            this.bindTexture(level.texture, 1);
            this.bindAndDraw(smaller, into, true, true, upsample);
            smaller = into;
        }

        // Every level adds light: divide by what they add up to, so it stays as bright as before
        let total = 0;
        for (let i = 0; i <= BLOOM_LEVELS; i++) total += wider ** i;
        return { bloom: smaller, strength: 1 / total };
    }

    /** Blurs `source` into `into`, across then down, twice; `work` holds the passes in between. */
    private blurTwice(source: Phaser.Renderer.WebGL.RenderTarget, work: Phaser.Renderer.WebGL.RenderTarget,
        into: Phaser.Renderer.WebGL.RenderTarget, spread: number): void {
        const blur = this.shaders[1];
        for (let i = 0; i < 2; i++) {
            this.set2f('uDirection', spread / work.width, 0, blur);
            this.bindAndDraw(i === 0 ? source : into, work, true, true, blur);
            this.set2f('uDirection', 0, spread / work.height, blur);
            this.bindAndDraw(work, into, true, true, blur);
        }
    }
}

/** The bloom's levels below half size: a quarter, an eighth… */
function bloomScales(): number[] {
    return Array.from({ length: BLOOM_LEVELS }, (_, i) => 0.25 / 2 ** i);
}
