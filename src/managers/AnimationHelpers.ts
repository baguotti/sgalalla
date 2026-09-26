import Phaser from 'phaser';
import { charConfigs, ALL_CHARACTERS, ANIM_FRAME_RATES } from '../config/CharacterConfig';

/**
 * Centralized manager for loading assets and creating animations.
 */
export class AnimationHelpers {
    /**
     * Loads all character texture atlases.
     * @param scene The scene to load assets into.
     */
    public static loadCharacterAssets(scene: Phaser.Scene): void {
        scene.load.atlas('fok', 'assets/fok/fok.png', 'assets/fok/fok.json');
        scene.load.atlas('sgu', 'assets/sgu/sgu.png', 'assets/sgu/sgu.json');
        scene.load.atlas('sga', 'assets/sga/sga.png', 'assets/sga/sga.json');
        scene.load.atlas('pe', 'assets/pe/pe.png', 'assets/pe/pe.json');
        scene.load.atlas('nock', 'assets/nock/nock.png', 'assets/nock/nock.json');
        scene.load.atlas('greg', 'assets/greg/greg.png', 'assets/greg/greg.json');

        // Single Standalone Images
        scene.load.image('greg_win_000', 'assets/greg/greg_win_000.png');

        // Taunt Atlas (all characters)
        scene.load.atlas('taunts', 'assets/taunts/taunts.png', 'assets/taunts/taunts.json');

        // Defeat Atlas (all characters)
        scene.load.atlas('defeat', 'assets/ui/defeat/defeat.png', 'assets/ui/defeat/defeat.json');
    }

    /** The stage platforms' textures. The stage backgrounds load per match (StageBackgrounds). */
    public static loadCommonAssets(scene: Phaser.Scene): void {
        scene.load.image('platform_main', 'assets/platform_main.png');
        scene.load.image('platform_side', 'assets/platform_side.png');
        scene.load.image('platform_top', 'assets/platform_top_left.png');
        scene.load.image('platform_londra_main', 'assets/stages/londra/platform_londra_main.webp');
        scene.load.image('platform_londra_side', 'assets/stages/londra/platform_londra_side.webp');
        scene.load.image('platform_londra_top', 'assets/stages/londra/platform_londra_top.webp');
        scene.load.image('platform_sguzia_main', 'assets/stages/sguzia/platform_sguzia_main.webp');
        scene.load.image('platform_sguzia_side', 'assets/stages/sguzia/platform_sguzia_side.webp');
        scene.load.image('platform_sguzia_top', 'assets/stages/sguzia/platform_sguzia_top.webp');
    }

    /**
     * Loads UI Audio Assets.
     * @param scene The scene to load assets into.
     */
    public static loadUIAudio(scene: Phaser.Scene): void {
        // --- UI ---
        scene.load.audio('ui_player_found', 'assets/audio/sfx/ui/ui_player_found.wav');
        scene.load.audio('ui_change_character', 'assets/audio/sfx/ui/ui_change_character.wav');
        // No sound of its own yet: the character change sound
        scene.load.audio('ui_confirm_character', 'assets/audio/sfx/ui/ui_change_character.wav');
        scene.load.audio('ui_back', 'assets/audio/sfx/ui/ui_back.wav');
        scene.load.audio('ui_player_ready', 'assets/audio/ui/ui_player_ready.wav');
        scene.load.audio('ui_menu_hover', 'assets/audio/sfx/ui/ui_menu_hover.wav');
        scene.load.audio('ui_confirm', 'assets/audio/sfx/ui/ui_confirm.wav');
        scene.load.audio('ui_move_cursor', 'assets/audio/sfx/ui/ui_move_cursor.wav');
        scene.load.audio('ui_match_begin', 'assets/audio/sfx/ui/ui_match_begin.wav');
        scene.load.audio('sfx_ui_press_start', 'assets/audio/sfx/ui/ui_press_start.wav');

        // --- Fight / Action ---
        scene.load.audio('sfx_jump_1', 'assets/audio/sfx/fight/fight_jump_1.wav');
        scene.load.audio('sfx_jump_2', 'assets/audio/sfx/fight/fight_jump_2.wav');
        scene.load.audio('sfx_landing', 'assets/audio/sfx/fight/fight_landing.wav');
        scene.load.audio('sfx_dash', 'assets/audio/sfx/fight/fight_dash.wav');
        scene.load.audio('sfx_run_light_miss', 'assets/audio/sfx/fight/fight_run_light_miss.wav');
        scene.load.audio('sfx_run_light_hit', 'assets/audio/sfx/fight/fight_run_light_hit.wav');
        scene.load.audio('sfx_side_light_miss', 'assets/audio/sfx/fight/fight_side_light_miss.wav');
        scene.load.audio('sfx_side_light_hit', 'assets/audio/sfx/fight/fight_side_light_hit.wav');
        scene.load.audio('sfx_death', 'assets/audio/sfx/fight/fight_death.wav');
        scene.load.audio('sfx_death_crowd_1', 'assets/audio/sfx/fight/fight_death_crowd_1.wav');
        scene.load.audio('sfx_death_crowd_2', 'assets/audio/sfx/fight/fight_death_crowd_2.wav');
        scene.load.audio('sfx_knockout', 'assets/audio/sfx/fight/fight_knockout.wav');
        scene.load.audio('sfx_fight_charge', 'assets/audio/sfx/fight/fight_charge.aac');

        // --- Sigs ---
        scene.load.audio('sfx_sigs_hurt', 'assets/audio/sfx/fight/sigs_hurt.wav');
        scene.load.audio('sfx_nock_sig', 'assets/audio/sfx/sigs/nock_sig.wav');
        scene.load.audio('sfx_sga_sig', 'assets/audio/sfx/sigs/sga_sig.wav');
        scene.load.audio('sfx_fok_sig', 'assets/audio/sfx/sigs/fok_sig.wav');
        scene.load.audio('sfx_greg_sig', 'assets/audio/sfx_greg_sig.wav');
        scene.load.audio('sfx_sgu_sig', 'assets/audio/sfx_sgu_sig.wav');
        scene.load.audio('sfx_pe_sig', 'assets/audio/sfx_pe_sig.wav');
        scene.load.audio('sfx_pe_charge', 'assets/audio/sfx_pe_charge.mp3');

        // --- Misc: the ground pound's thud when it hits nothing ---
        scene.load.audio('sfx_chest_drop', 'assets/audio/sfx/misc/chest_drop.wav');
    }

    /**
     * Creates all character animations based on CharacterConfig.
     * @param scene The scene to create animations in.
     */
    public static createAnimations(scene: Phaser.Scene): void {
        ALL_CHARACTERS.forEach(char => {
            const config = charConfigs[char];
            if (!config) return;

            Object.entries(config).forEach(([animName, animData]) => {
                const animKey = `${char}_${animName}`;
                if (scene.anims.exists(animKey)) return;

                let frames;
                if (animData.count === 1 && animData.suffix) {
                    frames = scene.anims.generateFrameNames(char, {
                        prefix: animData.prefix,
                        start: parseInt(animData.suffix),
                        end: parseInt(animData.suffix),
                        zeroPad: 3
                    });
                } else {
                    frames = scene.anims.generateFrameNames(char, {
                        prefix: animData.prefix,
                        start: 0,
                        end: animData.count - 1,
                        zeroPad: 3
                    });
                }

                scene.anims.create({
                    key: animKey,
                    frames: frames,
                    frameRate: animName === 'run' ? ANIM_FRAME_RATES.RUN : ANIM_FRAME_RATES.DEFAULT,
                    repeat: animData.loop ? -1 : 0
                });
            });

            // Special cases / Extra mappings to ensure all keys exist
            const ensureAnim = (key: string, frameName: string, frameIndex: number = 0) => {
                if (!scene.anims.exists(key)) {
                    // Fix: If using 'fok_' fallback frames, look in 'fok' atlas, otherwise use character atlas
                    const textureKey = frameName.startsWith('fok_') ? 'fok' : char;

                    scene.anims.create({
                        key: key,
                        frames: scene.anims.generateFrameNames(textureKey, { prefix: frameName, start: frameIndex, end: frameIndex, zeroPad: 3 }),
                        frameRate: 10,
                        repeat: 0
                    });
                }
            };

            ensureAnim(`${char}_attack_light_0`, 'fok_side_light_', 0);
            ensureAnim(`${char}_attack_light_1`, 'fok_side_light_', 0);
            ensureAnim(`${char}_dodge`, 'fok_dodge_', 0);
            ensureAnim(`${char}_jump_start`, 'fok_jump_', 0);

            // COMPATIBILITY ALIASING for 'fok'
            // Alias new specific keys to existing legacy ones
            const createAlias = (newSuffix: string, existingSuffix: string) => {
                const newKey = `${char}_${newSuffix}`;
                const existingKey = `${char}_${existingSuffix}`;
                if (!scene.anims.exists(newKey) && scene.anims.exists(existingKey)) {
                    const existingAnim = scene.anims.get(existingKey);
                    const frames = existingAnim.frames.map(f => ({ key: f.textureKey, frame: f.textureFrame }));
                    scene.anims.create({
                        key: newKey,
                        frames: frames,
                        frameRate: 10,
                        repeat: 0
                    });
                }
            };

            createAlias('attack_light_neutral', 'attack_light');
            createAlias('attack_light_up', 'attack_up');
            createAlias('attack_light_down', 'attack_down');
            createAlias('attack_light_side', 'attack_side');
            createAlias('attack_light_side_air', 'attack_side');

            createAlias('attack_heavy_neutral', 'attack_heavy');
            createAlias('attack_heavy_up', 'attack_up');
            createAlias('attack_heavy_side', 'attack_side');
            createAlias('attack_heavy_down', 'attack_down');

            createAlias('spot_dodge', 'slide');
            createAlias('dash', 'slide'); // Use slide for dash too (legacy fallback)
        });

        // Manual Animation: Fok Side Sig Ghost (from standalone images)
        if (!scene.anims.exists('fok_side_sig_ghost')) {
            scene.anims.create({
                key: 'fok_side_sig_ghost',
                frames: [
                    { key: 'fok_ghost_0' },
                    { key: 'fok_ghost_1' }
                ],
                frameRate: 10,
                repeat: -1
            });
        }

        // Manual Animation: Greg Win (from standalone image)
        if (!scene.anims.exists('greg_win')) {
            scene.anims.create({
                key: 'greg_win',
                frames: [{ key: 'greg_win_000' }],
                frameRate: 10,
                repeat: 0
            });
        }

        // ─── Taunt Animations (from taunt atlas) ───
        const tauntDefs: { char: string; prefix: string; count: number; frameRate?: number }[] = [
            { char: 'fok', prefix: 'fok_taunt_1_', count: 8, frameRate: 12 },
            { char: 'sgu', prefix: 'sgu_taunt_uwu_', count: 2, frameRate: 4 },
            { char: 'sga', prefix: 'sga_taunt_yoga_', count: 2, frameRate: 2 }, // Slowed down from 4 to 2
            { char: 'pe', prefix: 'pe_taunt_sailor_', count: 2, frameRate: 4 },
            { char: 'nock', prefix: 'nock_taunt_horse_', count: 2, frameRate: 4 },
            { char: 'greg', prefix: 'greg_taunt_marx_', count: 2, frameRate: 4 },
        ];

        for (const def of tauntDefs) {
            const animKey = `${def.char}_taunt`;
            if (!scene.anims.exists(animKey)) {
                const frames = scene.anims.generateFrameNames('taunts', {
                    prefix: def.prefix,
                    start: 0,
                    end: def.count - 1,
                    zeroPad: 3
                });
                scene.anims.create({
                    key: animKey,
                    frames: frames,
                    frameRate: def.frameRate || 4,
                    repeat: -1
                });
            }
        }

        // ─── Defeat Animations (from defeat atlas) ───
        const defeatDefs: { char: string }[] = [
            { char: 'fok' }, { char: 'sgu' }, { char: 'sga' }, { char: 'pe' }, { char: 'nock' }, { char: 'greg' }
        ];

        for (const def of defeatDefs) {
            const animKey = `${def.char}_defeat`;
            if (!scene.anims.exists(animKey)) {
                const frames = scene.anims.generateFrameNames('defeat', {
                    prefix: `${def.char}_defeat_`,
                    start: 0,
                    end: 1,
                    zeroPad: 3
                });
                scene.anims.create({
                    key: animKey,
                    frames: frames,
                    frameRate: 2, // Slow loop, hold each frame a touch
                    repeat: -1
                });
            }
        }
    }
}
