import Phaser from 'phaser';
import { charConfigs, ALL_CHARACTERS, ANIM_FRAME_RATES } from '../config/CharacterConfig';

/**
 * Centralized manager for loading assets and creating animations.
 * extracting this logic from GameScene/OnlineGameScene reduces duplication and file size.
 */
export class AnimationHelpers {
    /**
     * Loads all character texture atlases.
     * @param scene The scene to load assets into.
     */
    public static loadCharacterAssets(scene: Phaser.Scene): void {
        // Load Atlases
        // V4 FOK (if used, online scene referenced it, game scene didn't explicitely but charConfig might)
        // GameScene used: sgu, sga, pe, nock, greg. 
        // OnlineGameScene used: fok_v4, sgu, sga, pe. 
        // We should ensure we load ALL needed characters.

        // FOK: GameScene likely assumes FOK is loaded or uses a different path?
        // Checking GameScene again... it didn't explicitly load 'fok'. 
        // Wait, did I miss it in the file view?
        // GameScene lines 70-78: sgu, sga, pe, nock, greg. 
        // FOK might be loaded elsewhere or I missed it. 
        // However, safest bet is to load what OnlineGameScene loads + what GameScene loads.

        // Actually, let's stick to what GameScene had, plus ensure Fok is handled if needed.
        // OnlineGameScene loaded 'assets/fok_v4/fok_v4.png'.
        // GameScene might have loaded it in a previous block or I just missed it in the view.
        // I will include FOK v4 to be safe as it's the main character.

        scene.load.atlas('fok', 'assets/fok/fok.png', 'assets/fok/fok.json');
        scene.load.atlas('sgu', 'assets/sgu/sgu.png', 'assets/sgu/sgu.json');
        scene.load.atlas('sga', 'assets/sga/sga.png', 'assets/sga/sga.json');
        scene.load.atlas('pe', 'assets/pe/pe.png', 'assets/pe/pe.json');
        scene.load.atlas('nock', 'assets/nock/nock.png', 'assets/nock/nock.json');
        scene.load.atlas('greg', 'assets/greg/greg.png', 'assets/greg/greg.json');

        // Single Standalone Images
        scene.load.image('greg_win_000', 'assets/greg/greg_win_000.png');
    }

    /**
     * Loads common UI assets like the "scrin" images.
     * @param scene The scene to load assets into.
     */
    public static loadCommonAssets(scene: Phaser.Scene): void {
        scene.load.image('platform_corner_right', 'assets/stages/Platform_BH4A_adria.png'); // Re-confirmed path

        // Chest Assets
        scene.load.image('chest_closed', 'assets/items/chest_closed.png');
        scene.load.image('chest_open', 'assets/items/chest_open.png');
        scene.load.image('chest_dynamite', 'assets/items/chest_dynamite_001.png');

        // Scrin Images (Rewards)
        const scrinFiles = [
            'scrin_001.jpg', 'scrin_002.jpg', 'scrin_003.jpg', 'scrin_004.jpg', 'scrin_005.jpg',
            'scrin_006.jpg', 'scrin_007.jpg', 'scrin_008.jpg', 'scrin_009.jpg', 'scrin_0010.jpg',
            'scrin_0011.jpg', 'scrin_0012.jpg', 'scrin_0013.jpg', 'scrin_0014.jpg', 'scrin_0015.jpg',
            'scrin_0016.jpg', 'scrin_0017.jpg', 'scrin_0018.jpg', 'scrin_0019.jpg', 'scrin_0020.jpg',
            'scrin_0021.jpg', 'scrin_0022.jpg', 'scrin_0023.jpg', 'scrin_0024.jpg', 'scrin_0025.jpg',
            'scrin_0026.jpg', 'scrin_0027.jpg', 'scrin_0028.jpg', 'scrin_0029.jpg', 'scrin_0030.jpg',
            'scrin_0031.jpg'
        ];

        scrinFiles.forEach(file => {
            const key = file.replace('.jpg', '').replace('.png', '');
            scene.load.image(key, `assets/scrins/${file}`);
        });

        // Stage Assets
        scene.load.image('adria_bg', 'assets/stages/adria_v2.2_web.webp'); // Restored
        scene.load.image('platform_corner_left', 'assets/stages/Platform_BH4A_adria.png');
        scene.load.image('platform_corner_right', 'assets/stages/Platform_BH4A_adria.png'); // Same asset, flipped code-side

        // Updated Assets (Adria v2)
        scene.load.image('platform_main', 'assets/platform_main.png');
        scene.load.image('platform_side', 'assets/platform_side.png');
        scene.load.image('platform_top', 'assets/platform_top_left.png'); // Will flip for right side

        // Legacy/Unused? (Keeping just in case, or removing if confirmed unused)
    }

    /**
     * Loads UI Audio Assets.
     * @param scene The scene to load assets into.
     */
    public static loadUIAudio(scene: Phaser.Scene): void {
        scene.load.audio('ui_player_found', 'assets/audio/ui/ui_player_found.wav');
        scene.load.audio('ui_change_character', 'assets/audio/ui/ui_change_character.wav');
        scene.load.audio('ui_confirm_character', 'assets/audio/ui/ui_confirm_character.wav');
        scene.load.audio('ui_back', 'assets/audio/ui/ui_back.wav');
        scene.load.audio('ui_player_ready', 'assets/audio/ui/ui_player_ready.wav');
        scene.load.audio('ui_menu_hover', 'assets/audio/ui/ui_menu_hover.wav');
        scene.load.audio('ui_confirm', 'assets/audio/ui/ui_confirm.wav');
        scene.load.audio('ui_move_cursor', 'assets/audio/ui/ui_move_cursor.wav');
        scene.load.audio('ui_match_begin', 'assets/audio/ui/ui_match_begin.wav');

        // Combat SFX
        scene.load.audio('sfx_jump_1', 'assets/audio/sfx/fight_jump_1.wav');
        scene.load.audio('sfx_jump_2', 'assets/audio/sfx/fight_jump_2.wav');
        scene.load.audio('sfx_landing', 'assets/audio/sfx/fight_landing.wav');
        scene.load.audio('sfx_dash', 'assets/audio/sfx/fight_dash.wav');
        scene.load.audio('sfx_run_light_miss', 'assets/audio/sfx/fight_run_light_miss.wav');
        scene.load.audio('sfx_run_light_hit', 'assets/audio/sfx/fight_run_light_hit.wav');
        scene.load.audio('sfx_side_light_miss', 'assets/audio/sfx/fight_side_light_miss.wav');
        scene.load.audio('sfx_side_light_hit', 'assets/audio/sfx/fight_side_light_hit.wav');
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
    }
}
