import Phaser from 'phaser';

/**
 * Each stage's background: the full painting a match draws, and a small
 * preview for menus. The paintings are 9862x8263, about 330 MB of graphics
 * memory each once loaded, so a match loads only its own and menus never
 * load them.
 */
export const STAGES = {
    adria_bg: { label: 'Adria', image: 'assets/stages/adria_v2.2_web.webp', preview: 'assets/stages/previews/adria.webp' },
    bg_la_sala_prove: { label: 'La Sala Prove', image: 'assets/images/bg_la_sala_prove.webp', preview: 'assets/stages/previews/sala_prove.webp' },
    sguzia_bg: { label: 'Sguzia', image: 'assets/stages/sguzia_bg.webp', preview: 'assets/stages/previews/sguzia.webp' },
    londra_bg: { label: 'Londra', image: 'assets/stages/londra_bg.webp', preview: 'assets/stages/previews/londra.webp' },
} as const;

export type StageKey = keyof typeof STAGES;

export const STAGE_KEYS = Object.keys(STAGES) as StageKey[];

export function isStageKey(key: string | undefined): key is StageKey {
    return key !== undefined && key in STAGES;
}

/** The texture key of a stage's menu preview. */
export function previewKey(stage: StageKey): string {
    return `${stage}_preview`;
}

/** Queues `stage`'s background for the scene's loader and frees any other stage's. */
export function loadStageBackground(scene: Phaser.Scene, stage: StageKey): void {
    freeStageBackgrounds(scene, stage);
    if (!scene.textures.exists(stage)) scene.load.image(stage, STAGES[stage].image);
}

/** Frees every stage background but `keep`. */
export function freeStageBackgrounds(scene: Phaser.Scene, keep?: StageKey): void {
    for (const key of STAGE_KEYS) {
        if (key !== keep && scene.textures.exists(key)) scene.textures.remove(key);
    }
}

export function loadStagePreviews(scene: Phaser.Scene): void {
    for (const key of STAGE_KEYS) scene.load.image(previewKey(key), STAGES[key].preview);
}
