import Phaser from 'phaser';
import type { StageLayoutId } from '../../shared/StageData';

interface StageInfo {
    label: string;
    /** The full painting; null for a stage drawn in layers (stages/LondraLayers.ts). */
    image: string | null;
    preview: string;
    /** Its collision layout (shared/StageData.ts). */
    layout: StageLayoutId;
}

/**
 * Each stage: its background, a small preview for menus, and its layout. The
 * paintings are 9862x8263, about 330 MB of graphics memory each once loaded, so
 * a match loads only its own and menus never load them. Londra Grande is drawn
 * from Londra's layers instead (about 21 MB).
 */
export const STAGES = {
    adria_bg: { label: 'Adria', image: 'assets/stages/adria_v2.2_web.webp', preview: 'assets/stages/previews/adria.webp', layout: 'standard' },
    bg_la_sala_prove: { label: 'La Sala Prove', image: 'assets/images/bg_la_sala_prove.webp', preview: 'assets/stages/previews/sala_prove.webp', layout: 'standard' },
    sguzia_bg: { label: 'Sguzia', image: 'assets/stages/sguzia_bg.webp', preview: 'assets/stages/previews/sguzia.webp', layout: 'standard' },
    londra_bg: { label: 'Londra', image: 'assets/stages/londra_bg.webp', preview: 'assets/stages/previews/londra.webp', layout: 'standard' },
    londra_grande: { label: 'Londra Grande', image: null, preview: 'assets/stages/previews/londra_grande.webp', layout: 'grande' },
} as const satisfies Record<string, StageInfo>;

export type StageKey = keyof typeof STAGES;

/** The stage online matches of this many players are played on. */
export function onlineStage(players: number): StageKey {
    return players >= 3 ? 'londra_grande' : 'adria_bg';
}

export const STAGE_KEYS = Object.keys(STAGES) as StageKey[];

export function isStageKey(key: string | undefined): key is StageKey {
    return key !== undefined && key in STAGES;
}

/** The texture key of a stage's menu preview. */
export function previewKey(stage: StageKey): string {
    return `${stage}_preview`;
}

/** Queues `stage`'s painting for the scene's loader and frees any other stage's. */
export function loadStageBackground(scene: Phaser.Scene, stage: StageKey): void {
    freeStageBackgrounds(scene, stage);
    const image: string | null = STAGES[stage].image;
    if (image && !scene.textures.exists(stage)) scene.load.image(stage, image);
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
