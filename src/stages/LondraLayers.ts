import Phaser from 'phaser';

/**
 * Londra in layers (Studio Lab): a sky gradient drawn by the engine, clouds
 * behind the island, the floating island, and clouds in front of its
 * waterfall. Each element can be moved, resized, faded, reordered (even in
 * front of the fighters) and given its own scroll rate; the clouds drift and
 * repeat. About 21 MB of graphics memory, against 330 MB for the painting.
 *
 * Built by scripts/londra-layers.py from the full-size layers, which share the
 * painting's 9862x8263 canvas; positions here are in canvas pixels.
 */

const DIR = 'assets/stages/londra/layers/';
const ISLAND = 'londra_island';
const CLOUDS = 'londra_clouds';
const SKY = 'londra_sky';

// The canvas is drawn 3840 px wide, centred where the painting was
const CANVAS_WIDTH = 9862;
const CANVAS_HEIGHT = 8263;
const WORLD_PER_PIXEL = 3840 / CANVAS_WIDTH;
const CENTRE_X = 960;
const CENTRE_Y = 690;
/** Scale of the exported textures against the canvas, and the island's empty border in texels (see the script). */
const ISLAND_SCALE = 0.5;
const CLOUD_SCALE = 0.45;
const ISLAND_PADDING = 4;

/** Where the island's visible pixels start on the canvas. */
const ISLAND_AT = { x: 3542, y: 2316 };

export type StageElementId = 'sky' | 'backClouds' | 'island' | 'frontClouds';
/** In the order list: where the platforms and fighters are. Elements after it are drawn in front of them. */
export const STAGE_SLOT = 'stage';
export type StageOrderEntry = StageElementId | typeof STAGE_SLOT;

export const STAGE_ELEMENTS: Record<StageElementId, { label: string; kind: 'sky' | 'clouds' | 'image' }> = {
    sky: { label: 'Sky', kind: 'sky' },
    backClouds: { label: 'Back clouds', kind: 'clouds' },
    island: { label: 'Island', kind: 'image' },
    frontClouds: { label: 'Front clouds', kind: 'clouds' },
};
export const STAGE_ELEMENT_IDS = Object.keys(STAGE_ELEMENTS) as StageElementId[];

export interface ElementStyle {
    /** Offset from the element's place in the painting, in world pixels. */
    x: number;
    y: number;
    /** Size; the sky stretches its gradient. */
    scale: number;
    /** Scroll rate with the camera: 1 moves with the stage, lower looks further away. */
    parallax: number;
    opacity: number;
    /** How strongly lights outline it (not the sky). */
    rim: number;
    /** Clouds only: drift in world pixels per second. */
    drift: number;
    visible: boolean;
}

/** A colour of the sky gradient, at a height on the painting: 0 its top, 1 its bottom. */
export interface SkyStop {
    at: number;
    color: number;
}

export interface LayeredStageStyle {
    /** Back to front, with STAGE_SLOT among them. */
    order: StageOrderEntry[];
    elements: Record<StageElementId, ElementStyle>;
    sky: SkyStop[];
}

const DEFAULT_ELEMENT: ElementStyle = { x: 0, y: 0, scale: 1, parallax: 1, opacity: 1, rim: 0, drift: 0, visible: true };

export function defaultStageStyle(): LayeredStageStyle {
    return {
        order: ['sky', 'backClouds', 'island', 'frontClouds', STAGE_SLOT],
        elements: {
            sky: { ...DEFAULT_ELEMENT, parallax: 0.75 },
            backClouds: { ...DEFAULT_ELEMENT, parallax: 0.8, drift: 7 },
            island: { ...DEFAULT_ELEMENT, parallax: 0.86, rim: 0.5 },
            frontClouds: { ...DEFAULT_ELEMENT, parallax: 0.93, drift: 8 },
        },
        // Measured from the painting's sky
        sky: [
            { at: 0.139, color: 0x63aae1 },
            { at: 0.3, color: 0xb6a8cf },
            { at: 0.342, color: 0xd9b5be },
            { at: 0.448, color: 0xf1d3b6 },
            { at: 0.744, color: 0xf2d5aa },
        ],
    };
}

type CloudPiece = 'cumulus_big' | 'cumulus_low' | 'cumulus_flat' | 'tower' | 'puff';

/** A cloud: piece, canvas position of its top-left, size against the piece as painted, mirrored. */
type Cloud = [piece: CloudPiece, x: number, y: number, scale: number, flip?: boolean];

/** Laid out after the painting: behind the island above its rocks, in front of the waterfall below. */
const BACK_CLOUDS: Cloud[] = [
    ['cumulus_big', 3805, 338, 0.76],
    ['cumulus_low', 5029, 1399, 0.76],
    ['cumulus_flat', 1700, -150, 1.2],
    ['cumulus_big', 6750, -120, 0.7, true],
    ['tower', -700, 100, 0.95],
    ['cumulus_flat', 1300, 1214, 1],
    ['tower', 0, 1866, 1],
    ['cumulus_flat', 3300, 2027, 1],
    ['tower', 5271, 2679, 1],
    ['puff', 6954, 2302, 1],
];
const FRONT_CLOUDS: Cloud[] = [
    ['cumulus_big', 3806, 3835, 0.81],
    ['cumulus_low', 5115, 4970, 0.81],
    ['tower', -500, 3700, 0.95],
    ['cumulus_big', 7500, 4150, 0.6],
    ['cumulus_flat', 1297, 4811, 1],
    ['cumulus_big', 2536, 5570, 1],
    ['cumulus_low', 4155, 6973, 1],
    ['tower', 40, 5424, 1],
    ['cumulus_big', 7100, 5800, 0.75, true],
    ['cumulus_flat', -800, 6664, 1],
];
/** The layout repeats every canvas width, three times across; drifting clouds wrap round. */
const REPEATS = [-1, 0, 1];
const REPEAT_SPAN = REPEATS.length * CANVAS_WIDTH * WORLD_PER_PIXEL;
const WRAP_START = toWorldX(-CANVAS_WIDTH) - REPEAT_SPAN / 6;

/** The sky's gradient texture covers these canvas heights; beyond its first and last colours it's plain. */
const SKY_TOP = -3000;
const SKY_BOTTOM = 11000;
const SKY_WIDTH = 12000;

/** Depths: elements behind the platforms (-10) from here up, those in front of the fighters (10) from 20. */
const BACK_DEPTH = -150;
const FRONT_DEPTH = 20;

export function loadLondraLayers(scene: Phaser.Scene): void {
    if (!scene.textures.exists(ISLAND)) scene.load.image(ISLAND, `${DIR}island.webp`);
    if (!scene.textures.exists(CLOUDS)) scene.load.atlas(CLOUDS, `${DIR}clouds.webp`, `${DIR}clouds.json`);
}

/** Frees the layers' textures, for matches that don't use them. */
export function freeLondraLayers(scene: Phaser.Scene): void {
    for (const key of [ISLAND, CLOUDS, SKY]) {
        if (scene.textures.exists(key)) scene.textures.remove(key);
    }
}

interface PlacedCloud {
    sprite: Phaser.GameObjects.Image;
    /** World position and scale as laid out, before drift and the layer's style. */
    x: number;
    y: number;
    scale: number;
}

export class LondraLayers {
    readonly style: LayeredStageStyle;
    readonly sky: Phaser.GameObjects.Image;
    private readonly island: Phaser.GameObjects.Image;
    private readonly clouds: Record<'backClouds' | 'frontClouds', PlacedCloud[]>;
    private readonly skyTexture: Phaser.Textures.CanvasTexture;
    private readonly depths = new Map<StageElementId, number>();
    private elapsed = 0;

    constructor(scene: Phaser.Scene, style: LayeredStageStyle = defaultStageStyle()) {
        this.style = style;
        this.skyTexture = scene.textures.exists(SKY)
            ? scene.textures.get(SKY) as Phaser.Textures.CanvasTexture
            : scene.textures.createCanvas(SKY, 4, 1024)!;
        this.sky = scene.add.image(CENTRE_X, 0, SKY);
        this.clouds = { backClouds: placeClouds(scene, BACK_CLOUDS), frontClouds: placeClouds(scene, FRONT_CLOUDS) };
        this.island = scene.add.image(0, 0, ISLAND);
        this.redrawSky();
        this.apply();

        scene.events.on('update', this.update, this);
        scene.events.once('shutdown', () => scene.events.off('update', this.update, this));
    }

    /** Every drawn object. */
    get objects(): Phaser.GameObjects.Image[] {
        return STAGE_ELEMENT_IDS.flatMap(id => this.objectsOf(id));
    }

    objectsOf(id: StageElementId): Phaser.GameObjects.Image[] {
        if (id === 'sky') return [this.sky];
        if (id === 'island') return [this.island];
        return this.clouds[id].map(cloud => cloud.sprite);
    }

    depthOf(id: StageElementId): number {
        return this.depths.get(id) ?? BACK_DEPTH;
    }

    /** A point that moves with the element, for dragging it: world position and scroll rates. */
    handleOf(id: StageElementId): { x: number; y: number; scrollX: number; scrollY: number } {
        const s = this.style.elements[id];
        if (id === 'island') return { x: this.island.x, y: this.island.y, scrollX: s.parallax, scrollY: s.parallax };
        if (id === 'sky') return { x: CENTRE_X, y: toWorldY(0) + s.y, scrollX: 0, scrollY: s.parallax };
        return { x: CENTRE_X + s.x, y: CENTRE_Y + s.y, scrollX: s.parallax, scrollY: s.parallax };
    }

    /** Redraws the sky gradient from `style.sky`. */
    redrawSky(): void {
        const { width, height } = this.skyTexture;
        const context = this.skyTexture.context;
        const gradient = context.createLinearGradient(0, 0, 0, height);
        for (const stop of [...this.style.sky].sort((a, b) => a.at - b.at)) {
            const offset = (stop.at * CANVAS_HEIGHT - SKY_TOP) / (SKY_BOTTOM - SKY_TOP);
            gradient.addColorStop(Phaser.Math.Clamp(offset, 0, 1), `#${stop.color.toString(16).padStart(6, '0')}`);
        }
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        this.skyTexture.refresh();
    }

    /** Puts every element where its style says. Every frame, so edits show at once. */
    apply(): void {
        this.assignDepths();
        const { elements } = this.style;

        const sky = elements.sky;
        // Stretched round the painting's middle
        const top = CENTRE_Y + (toWorldY(SKY_TOP) - CENTRE_Y) * sky.scale + sky.y;
        const bottom = CENTRE_Y + (toWorldY(SKY_BOTTOM) - CENTRE_Y) * sky.scale + sky.y;
        this.sky.setOrigin(0.5, 0).setPosition(CENTRE_X, top).setDisplaySize(SKY_WIDTH, bottom - top)
            // Level across, so it only needs to cover the widest view
            .setScrollFactor(0, sky.parallax);
        this.fit(this.sky, 'sky');

        const island = elements.island;
        const width = this.island.width / ISLAND_SCALE;
        const height = this.island.height / ISLAND_SCALE;
        const border = ISLAND_PADDING / ISLAND_SCALE;
        this.island.setPosition(toWorldX(ISLAND_AT.x - border + width / 2) + island.x, toWorldY(ISLAND_AT.y - border + height / 2) + island.y)
            .setScale(island.scale * WORLD_PER_PIXEL / ISLAND_SCALE)
            .setScrollFactor(island.parallax);
        this.fit(this.island, 'island');

        for (const id of ['backClouds', 'frontClouds'] as const) {
            const s = elements[id];
            for (const cloud of this.clouds[id]) {
                const x = WRAP_START + Phaser.Math.Wrap(cloud.x + s.drift * this.elapsed - WRAP_START, 0, REPEAT_SPAN);
                cloud.sprite.setPosition(CENTRE_X + (x - CENTRE_X) * s.scale + s.x, CENTRE_Y + (cloud.y - CENTRE_Y) * s.scale + s.y)
                    .setScale(cloud.scale * s.scale)
                    .setScrollFactor(s.parallax);
                this.fit(cloud.sprite, id);
            }
        }
    }

    private update(_time: number, delta: number): void {
        this.elapsed += delta / 1000;
        this.apply();
    }

    /** Depth, opacity and visibility from the element's style. */
    private fit(object: Phaser.GameObjects.Image, id: StageElementId): void {
        const s = this.style.elements[id];
        const depth = this.depthOf(id);
        if (object.depth !== depth) object.setDepth(depth);
        object.setAlpha(s.opacity).setVisible(s.visible);
    }

    /** Back to front: behind the platforms up to the stage slot, in front of the fighters after it. */
    private assignDepths(): void {
        const stage = this.style.order.indexOf(STAGE_SLOT);
        this.style.order.forEach((entry, i) => {
            if (entry === STAGE_SLOT) return;
            this.depths.set(entry, i < stage ? BACK_DEPTH + 10 * i : FRONT_DEPTH + 5 * (i - stage - 1));
        });
    }
}

function placeClouds(scene: Phaser.Scene, clouds: readonly Cloud[]): PlacedCloud[] {
    const placed: PlacedCloud[] = [];
    for (const repeat of REPEATS) {
        for (const [piece, x, y, scale, flip] of clouds) {
            const sprite = scene.add.image(0, 0, CLOUDS, piece).setOrigin(0).setFlipX(flip === true);
            placed.push({
                sprite,
                x: toWorldX(x + repeat * CANVAS_WIDTH),
                y: toWorldY(y),
                scale: scale * WORLD_PER_PIXEL / CLOUD_SCALE,
            });
        }
    }
    return placed;
}

function toWorldX(canvasX: number): number {
    return CENTRE_X + (canvasX - CANVAS_WIDTH / 2) * WORLD_PER_PIXEL;
}

function toWorldY(canvasY: number): number {
    return CENTRE_Y + (canvasY - CANVAS_HEIGHT / 2) * WORLD_PER_PIXEL;
}
