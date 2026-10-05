import Phaser from 'phaser';

/** Lights a lit object takes into account at most. */
export const MAX_LIGHTS = 8;

const VERTEX_SHADER = `
#define SHADER_NAME SGALALLA_LIT_VS

precision mediump float;

uniform mat4 uProjectionMatrix;

attribute vec2 inPosition;
attribute vec2 inTexCoord;
attribute float inTintEffect;
attribute vec4 inTint;

varying vec2 outTexCoord;
varying float outTintEffect;
varying vec4 outTint;
varying vec2 outScreen;

void main ()
{
    gl_Position = uProjectionMatrix * vec4(inPosition, 1.0, 1.0);

    outTexCoord = inTexCoord;
    outTint = inTint;
    outTintEffect = inTintEffect;
    outScreen = inPosition;
}
`;

// Phaser's single-texture sprite shader, then lighting: ambient, plus each
// light's fill fading with distance, plus a rim where the silhouette's edge
// faces a light. The edge is found from the texture's alpha, no normal maps.
// A light behind the object doesn't light its face: it outlines the whole
// silhouette instead, brightest nearest the light. The distance can be
// measured with the screen's axes scaled (an isometric ground: a light's pool
// is an ellipse on screen), the rim can face a point offset from the light
// (a lamp's head above the pool it lights), and a light can shine in a cone
// (a headlight).
const FRAGMENT_SHADER = `
#define SHADER_NAME SGALALLA_LIT_FS
#extension GL_OES_standard_derivatives : enable

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

#define MAX_LIGHTS ${MAX_LIGHTS}

uniform sampler2D uMainSampler;
uniform vec3 uAmbient;
// Per light: screen x, y and radius in pixels, rim strength
uniform vec4 uLightPosition[MAX_LIGHTS];
// Per light: colour times intensity, fill strength
uniform vec4 uLightColor[MAX_LIGHTS];
uniform float uLightCount;
uniform float uRimWidth;
uniform vec2 uTexelSize;
// 1 while the object stands on the floor, which hides the bottom edge (the soles) from the lights
uniform float uFloorContact;
// This object's rim strength, and 1 for each light behind it
uniform float uObjectRim;
uniform float uBehind[MAX_LIGHTS];
// Screen axes scaled before measuring a light's distance (1, 1: plain screen distance)
uniform vec2 uFalloffScale;
// Per light: where its rim light comes from, offset from its position in screen pixels (0, 0: the light itself)
uniform vec2 uRimOffset[MAX_LIGHTS];
// Per light: a cone it shines in, the way it points (in the scaled distance's axes) and the cosines of the
// angles where it starts to fade and where it's gone; no direction (0, 0): it shines all round
uniform vec4 uLightCone[MAX_LIGHTS];

varying vec2 outTexCoord;
varying float outTintEffect;
varying vec4 outTint;
varying vec2 outScreen;

void main ()
{
    // Texture coordinates per screen pixel rightward and downward, whichever way the sprite is flipped or scaled
    vec2 texPerPixelX = dFdx(outTexCoord);
    vec2 texPerPixelY = dFdy(outTexCoord) * sign(dFdy(outScreen.y));

    vec4 texture = texture2D(uMainSampler, outTexCoord);
    vec4 texel = vec4(outTint.bgr * outTint.a, outTint.a);
    vec4 color = texture * texel;

    if (outTintEffect == 1.0)
    {
        color.rgb = mix(texture.rgb, outTint.bgr * outTint.a, texture.a);
    }
    else if (outTintEffect == 2.0)
    {
        color = texel;
    }

    vec3 light = uAmbient;
    vec3 rim = vec3(0.0);

    for (int i = 0; i < MAX_LIGHTS; i++)
    {
        if (float(i) >= uLightCount) break;

        vec4 position = uLightPosition[i];
        vec2 toLight = position.xy - outScreen;
        float dist = length(toLight * uFalloffScale);
        float falloff = clamp(1.0 - dist / position.z, 0.0, 1.0);
        falloff *= falloff;

        vec4 cone = uLightCone[i];
        if (cone.x != 0.0 || cone.y != 0.0)
        {
            vec2 away = -toLight * uFalloffScale;
            falloff *= smoothstep(cone.w, cone.z, dot(away, cone.xy) / max(length(away), 0.0001));
        }

        float behind = uBehind[i];
        light += uLightColor[i].rgb * (falloff * uLightColor[i].a * (1.0 - behind));

        if (uRimWidth > 0.0 && position.w > 0.0 && falloff > 0.0 && uObjectRim > 0.0)
        {
            float covered;
            if (behind > 0.5)
            {
                // Backlit: any edge within the rim width, whichever way it faces
                vec2 across = vec2(uRimWidth * uTexelSize.x, 0.0);
                vec2 down = vec2(0.0, uRimWidth * uTexelSize.y);
                covered = min(min(texture2D(uMainSampler, outTexCoord + across).a, texture2D(uMainSampler, outTexCoord - across).a),
                    min(texture2D(uMainSampler, outTexCoord + down).a, texture2D(uMainSampler, outTexCoord - down).a));
            }
            else
            {
                // Look toward the light, in texels: where the silhouette ends within the rim width, this pixel is on a lit edge
                vec2 toRim = toLight + uRimOffset[i];
                vec2 towardLight = (texPerPixelX * toRim.x + texPerPixelY * toRim.y) / uTexelSize;
                vec2 stride = towardLight * (uRimWidth / max(length(towardLight), 0.0001)) * uTexelSize;
                covered = 0.5 * (texture2D(uMainSampler, outTexCoord + stride * 0.5).a + texture2D(uMainSampler, outTexCoord + stride).a);
            }
            rim += uLightColor[i].rgb * (falloff * position.w * uObjectRim * (1.0 - covered));
        }
    }

    if (uFloorContact > 0.0)
    {
        // No rim within the rim width of a bottom edge: nothing lights the soles through the floor
        vec2 downTexels = texPerPixelY / uTexelSize;
        vec2 down = downTexels * (max(uRimWidth, 1.0) / max(length(downTexels), 0.0001)) * uTexelSize;
        rim *= 1.0 - uFloorContact * (1.0 - texture2D(uMainSampler, outTexCoord + down).a);
    }

    // Colours are premultiplied by alpha
    gl_FragColor = vec4(color.rgb * light + rim * color.a, color.a);
}
`;

/**
 * Draws sprites and images lit by the scene's lights (see Lighting). One
 * instance per group of objects that share an ambient level and rim setting.
 */
export class LitPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
    private readonly floorContact = new WeakMap<Phaser.GameObjects.GameObject, number>();
    private readonly objectRim = new WeakMap<Phaser.GameObjects.GameObject, number>();
    private readonly behind = new WeakMap<Phaser.GameObjects.GameObject, number>();
    private readonly behindFlags = new Float32Array(MAX_LIGHTS);
    private textureWidth = 0;
    private textureHeight = 0;
    private boundFloorContact = 0;
    private boundRim = 1;
    private boundBehind = 0;

    constructor(game: Phaser.Game) {
        super({ game, vertShader: VERTEX_SHADER, fragShader: FRAGMENT_SHADER });
    }

    onBoot(): void {
        this.set2f('uFalloffScale', 1, 1);
    }

    onPreRender(): void {
        this.set1f('uObjectRim', this.boundRim);
        this.set1fv('uBehind', this.behindFlags);
    }

    /** 1 while `object` stands on the floor, 0 in the air. */
    setFloorContact(object: Phaser.GameObjects.GameObject, amount: number): void {
        this.floorContact.set(object, amount);
    }

    /** How strongly lights outline `object`: 1 unless set. */
    setObjectRim(object: Phaser.GameObjects.GameObject, rim: number): void {
        this.objectRim.set(object, rim);
    }

    /** Which lights are behind `object`, one bit per light in the order setLights got them. */
    setBehind(object: Phaser.GameObjects.GameObject, mask: number): void {
        this.behind.set(object, mask);
    }

    /** Called for every object drawn with this pipeline: the rim needs its texture's size, floor contact, strength and lights behind. */
    onBind(gameObject?: Phaser.GameObjects.GameObject): void {
        const source = (gameObject as Phaser.GameObjects.Image | undefined)?.frame?.source;
        if (!gameObject || !source) return;
        const floorContact = this.floorContact.get(gameObject) ?? 0;
        const rim = this.objectRim.get(gameObject) ?? 1;
        const behind = this.behind.get(gameObject) ?? 0;
        const sizeChanged = source.width !== this.textureWidth || source.height !== this.textureHeight;
        if (!sizeChanged && floorContact === this.boundFloorContact && rim === this.boundRim && behind === this.boundBehind) return;

        // Objects already batched are drawn with the values they were batched for
        this.flush();
        if (sizeChanged) {
            this.textureWidth = source.width;
            this.textureHeight = source.height;
            this.set2f('uTexelSize', 1 / source.width, 1 / source.height);
        }
        if (floorContact !== this.boundFloorContact) {
            this.boundFloorContact = floorContact;
            this.set1f('uFloorContact', floorContact);
        }
        if (rim !== this.boundRim) {
            this.boundRim = rim;
            this.set1f('uObjectRim', rim);
        }
        if (behind !== this.boundBehind) {
            this.boundBehind = behind;
            for (let i = 0; i < MAX_LIGHTS; i++) this.behindFlags[i] = (behind >> i) & 1;
            this.set1fv('uBehind', this.behindFlags);
        }
    }

    /** The screen's axes scaled before measuring how far a pixel is from a light (an isometric ground); 1, 1 unless set. */
    setFalloffScale(x: number, y: number): void {
        this.set2f('uFalloffScale', x, y);
    }

    /**
     * Lights in screen space, 4 floats each: x, y, radius, rim strength and
     * red, green, blue, fill strength. The rim width is in texels, at most 4
     * (the empty padding round each frame in an atlas); 0 turns the rim off.
     * `rimOffsets` (2 floats a light, screen pixels) moves where each light's
     * rim comes from; without them, from the light itself. `cones` (4 floats
     * a light: the way it points, normalised in the falloff's scaled axes, and
     * the cosines of its inner and outer angles) make lights shine in a cone;
     * a light with no direction shines all round.
     */
    setLights(ambient: ArrayLike<number>, count: number, positions: Float32Array, colors: Float32Array, rimWidth: number,
        rimOffsets?: Float32Array, cones?: Float32Array): void {
        this.set3f('uAmbient', ambient[0], ambient[1], ambient[2]);
        this.set1f('uLightCount', count);
        this.set4fv('uLightPosition', positions);
        this.set4fv('uLightColor', colors);
        this.set1f('uRimWidth', Math.min(rimWidth, 4));
        if (rimOffsets) this.set2fv('uRimOffset', rimOffsets);
        if (cones) this.set4fv('uLightCone', cones);
    }
}
