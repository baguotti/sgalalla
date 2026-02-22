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

        // FX
        scene.load.image('fx_explosion', 'assets/images/fx/explosion.png');

        // Scrin Images (Rewards)
        const scrinFiles = [
            'scrins_00001.webp', 'scrins_00002.webp', 'scrins_00003.webp', 'scrins_00004.webp', 'scrins_00005.webp', 'scrins_00006.webp', 'scrins_00007.webp', 'scrins_00008.webp', 'scrins_00009.webp', 'scrins_00010.webp', 'scrins_00011.webp', 'scrins_00012.webp', 'scrins_00013.webp', 'scrins_00014.webp', 'scrins_00015.webp', 'scrins_00016.webp', 'scrins_00017.webp', 'scrins_00018.webp', 'scrins_00019.webp', 'scrins_00020.webp', 'scrins_00021.webp', 'scrins_00022.webp', 'scrins_00023.webp', 'scrins_00024.webp', 'scrins_00025.webp', 'scrins_00026.webp', 'scrins_00027.webp', 'scrins_00028.webp', 'scrins_00029.webp', 'scrins_00030.webp', 'scrins_00031.webp', 'scrins_00032.webp', 'scrins_00033.webp', 'scrins_00034.webp', 'scrins_00035.webp', 'scrins_00036.webp', 'scrins_00037.webp', 'scrins_00038.webp', 'scrins_00039.webp', 'scrins_00040.webp', 'scrins_00041.webp', 'scrins_00042.webp', 'scrins_00043.webp', 'scrins_00044.webp', 'scrins_00045.webp', 'scrins_00046.webp', 'scrins_00047.webp', 'scrins_00048.webp', 'scrins_00049.webp', 'scrins_00050.webp', 'scrins_00051.webp', 'scrins_00052.webp', 'scrins_00053.webp', 'scrins_00054.webp', 'scrins_00055.webp', 'scrins_00056.webp', 'scrins_00057.webp', 'scrins_00058.webp', 'scrins_00059.webp', 'scrins_00060.webp', 'scrins_00061.webp', 'scrins_00062.webp', 'scrins_00063.webp', 'scrins_00064.webp', 'scrins_00065.webp', 'scrins_00066.webp', 'scrins_00067.webp', 'scrins_00068.webp', 'scrins_00069.webp', 'scrins_00070.webp', 'scrins_00071.webp', 'scrins_00072.webp', 'scrins_00073.webp', 'scrins_00074.webp', 'scrins_00075.webp', 'scrins_00076.webp', 'scrins_00077.webp', 'scrins_00078.webp', 'scrins_00079.webp', 'scrins_00080.webp', 'scrins_00081.webp', 'scrins_00082.webp', 'scrins_00083.webp', 'scrins_00084.webp', 'scrins_00085.webp', 'scrins_00086.webp', 'scrins_00087.webp', 'scrins_00088.webp', 'scrins_00089.webp', 'scrins_00090.webp', 'scrins_00091.webp', 'scrins_00092.webp', 'scrins_00093.webp', 'scrins_00094.webp', 'scrins_00095.webp', 'scrins_00096.webp', 'scrins_00097.webp', 'scrins_00098.webp', 'scrins_00099.webp', 'scrins_00100.webp', 'scrins_00101.webp', 'scrins_00102.webp', 'scrins_00103.webp', 'scrins_00104.webp', 'scrins_00105.webp', 'scrins_00106.webp', 'scrins_00107.webp', 'scrins_00108.webp', 'scrins_00109.webp', 'scrins_00110.webp', 'scrins_00111.webp', 'scrins_00112.webp', 'scrins_00113.webp', 'scrins_00114.webp', 'scrins_00115.webp', 'scrins_00116.webp', 'scrins_00117.webp', 'scrins_00118.webp', 'scrins_00119.webp', 'scrins_00120.webp', 'scrins_00121.webp', 'scrins_00122.webp', 'scrins_00123.webp', 'scrins_00124.webp', 'scrins_00125.webp', 'scrins_00126.webp', 'scrins_00127.webp', 'scrins_00128.webp', 'scrins_00129.webp', 'scrins_00130.webp', 'scrins_00131.webp', 'scrins_00132.webp', 'scrins_00133.webp', 'scrins_00134.webp'
        ];

        scrinFiles.forEach(file => {
            const key = file.replace('.webp', '');
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
        // --- UI ---
        scene.load.audio('ui_player_found', 'assets/audio/sfx/ui/ui_player_found.wav');
        scene.load.audio('ui_change_character', 'assets/audio/sfx/ui/ui_change_character.wav');
        // keep old names if there's no new file for it, but assuming all are mapped to new folders
        scene.load.audio('ui_confirm_character', 'assets/audio/sfx/ui/ui_change_character.wav'); // Fallback to change char if no file
        scene.load.audio('ui_back', 'assets/audio/sfx/ui/ui_back.wav');
        scene.load.audio('ui_player_ready', 'assets/audio/sfx/ui/ui_player_ready.wav');
        scene.load.audio('ui_menu_hover', 'assets/audio/sfx/ui/ui_menu_hover.wav');
        const cb = `?v=${Date.now() + 1}`;
        scene.load.audio('ui_confirm', 'assets/audio/sfx/ui/ui_confirm.wav' + cb);
        scene.load.audio('ui_move_cursor', 'assets/audio/sfx/ui/ui_move_cursor.wav' + cb);
        scene.load.audio('ui_match_begin', 'assets/audio/sfx/ui/ui_match_begin.wav' + cb);
        scene.load.audio('sfx_ui_press_start', 'assets/audio/sfx/ui/ui_press_start.wav' + cb);
        scene.load.audio('ui_title_loop', 'assets/audio/sfx/ui/ui_title_loop.wav' + cb);

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

        // --- Misc ---
        scene.load.audio('sfx_chest_drop', 'assets/audio/sfx/misc/chest_drop.wav');
        scene.load.audio('sfx_chest_explode', 'assets/audio/sfx/misc/chest_explode.wav');
        scene.load.audio('sfx_chest_open', 'assets/audio/sfx/misc/chest_open.wav');
        scene.load.audio('sfx_chest_timer', 'assets/audio/sfx/misc/chest_timer.aac');
        scene.load.audio('sfx_chest_reveal', 'assets/audio/sfx/misc/chest_reveal.wav');
        scene.load.audio('sfx_chest_throw', 'assets/audio/sfx/misc/chest_throw.wav');
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
