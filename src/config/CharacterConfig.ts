/**
 * Shared Character Animation Configuration
 *
 * Single source of truth for all character animation definitions.
 * Used by both GameScene and OnlineGameScene.
 */

export interface AnimationDef {
    prefix: string;
    count: number;
    loop: boolean;
    suffix?: string;
}

export type CharacterAnimations = Record<string, AnimationDef>;

/**
 * All character animation configs.
 * Keys are character identifiers (e.g. 'fok', 'sgu').
 * Values are objects mapping animation names to their frame definitions.
 */
export const charConfigs: Record<string, CharacterAnimations> = {
    'fok': {
        idle: { prefix: 'fok_idle_', count: 12, loop: true },
        run: { prefix: 'fok_run_', count: 9, loop: true },
        charging: { prefix: 'fok_charge_', count: 2, loop: true },

        // Dash
        dash: { prefix: 'fok_dash_', count: 1, suffix: '000', loop: false },

        // Spot Dodge
        spot_dodge: { prefix: 'fok_dodge_', count: 1, suffix: '000', loop: false },

        // Side Sig Ghost
        side_sig_ghost: { prefix: 'fok_side_sig_ghost_', count: 2, loop: true },

        // --- LIGHT ATTACKS ---
        attack_light_neutral: { prefix: 'fok_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_up: { prefix: 'fok_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_up_air: { prefix: 'fok_side_air_', count: 1, suffix: '000', loop: false },
        attack_light_down: { prefix: 'fok_down_light_', count: 1, suffix: '000', loop: false },
        attack_light_side: { prefix: 'fok_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_side_air: { prefix: 'fok_side_air_', count: 1, suffix: '000', loop: false },
        attack_light_run: { prefix: 'fok_side_run_', count: 1, suffix: '000', loop: false },

        // --- HEAVY ATTACKS (SIGS) ---
        attack_heavy_neutral: { prefix: 'fok_up_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_up: { prefix: 'fok_up_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_side: { prefix: 'fok_side_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_down: { prefix: 'fok_side_sig_', count: 1, suffix: '000', loop: false },

        // Utilities
        wall_slide: { prefix: 'fok_wall_slide_', count: 1, suffix: '000', loop: false },
        recovery: { prefix: 'fok_recovery_', count: 1, suffix: '000', loop: false },
        ground_pound: { prefix: 'fok_ground_pound_', count: 1, suffix: '000', loop: false },
        hurt: { prefix: 'fok_hurt_', count: 1, suffix: '000', loop: false },
        fall: { prefix: 'fok_fall_', count: 1, suffix: '000', loop: false },
        jump: { prefix: 'fok_jump_', count: 1, suffix: '000', loop: false },
        slide: { prefix: 'fok_dodge_', count: 1, suffix: '000', loop: false }
    },
    'sgu': {
        idle: { prefix: 'sgu_idle_', count: 12, loop: true },
        run: { prefix: 'sgu_run_', count: 9, loop: true },
        charging: { prefix: 'sgu_charge_', count: 2, loop: true },

        dash: { prefix: 'sgu_dash_', count: 1, suffix: '000', loop: false },
        spot_dodge: { prefix: 'sgu_dodge_', count: 1, suffix: '000', loop: false },

        // Side Sig Ghost
        side_sig_ghost: { prefix: 'sgu_side_sig_ghost_', count: 3, loop: false },

        // --- LIGHT ATTACKS ---
        attack_light_neutral: { prefix: 'sgu_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_up: { prefix: 'sgu_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_up_air: { prefix: 'sgu_side_air_', count: 1, suffix: '000', loop: false },
        attack_light_down: { prefix: 'sgu_down_light_', count: 1, suffix: '000', loop: false },
        attack_light_side: { prefix: 'sgu_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_side_air: { prefix: 'sgu_side_air_', count: 1, suffix: '000', loop: false },
        attack_light_run: { prefix: 'sgu_side_run_', count: 1, suffix: '000', loop: false },

        // --- HEAVY ATTACKS (SIGS) ---
        attack_heavy_neutral: { prefix: 'sgu_up_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_up: { prefix: 'sgu_up_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_side: { prefix: 'sgu_side_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_down: { prefix: 'sgu_side_sig_', count: 1, suffix: '000', loop: false },

        // Utilities
        wall_slide: { prefix: 'sgu_wall_slide_', count: 1, suffix: '000', loop: false },
        recovery: { prefix: 'sgu_recovery_', count: 1, suffix: '000', loop: false },
        ground_pound: { prefix: 'sgu_ground_pound_', count: 1, suffix: '000', loop: false },
        hurt: { prefix: 'sgu_hurt_', count: 1, suffix: '000', loop: false },
        fall: { prefix: 'sgu_fall_', count: 1, suffix: '000', loop: false },
        jump: { prefix: 'sgu_jump_', count: 1, suffix: '000', loop: false },
        slide: { prefix: 'sgu_dodge_', count: 1, suffix: '000', loop: false }
    },
    'sga': {
        idle: { prefix: 'sga_idle_', count: 15, loop: true },
        run: { prefix: 'sga_run_', count: 9, loop: true },
        charging: { prefix: 'sga_charge_', count: 2, loop: true },

        dash: { prefix: 'sga_dash_', count: 1, suffix: '000', loop: false },
        spot_dodge: { prefix: 'sga_dodge_', count: 1, suffix: '000', loop: false },

        // Side Sig Ghost
        side_sig_ghost: { prefix: 'sga_side_sig_ghost_', count: 2, loop: true },

        // --- LIGHT ATTACKS ---
        attack_light_neutral: { prefix: 'sga_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_side: { prefix: 'sga_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_side_air: { prefix: 'sga_side_air_', count: 1, suffix: '000', loop: false },
        attack_light_run: { prefix: 'sga_side_run_', count: 1, suffix: '000', loop: false },
        attack_light_down: { prefix: 'sga_down_light_', count: 1, suffix: '000', loop: false },
        attack_light_up: { prefix: 'sga_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_up_air: { prefix: 'sga_side_air_', count: 1, suffix: '000', loop: false },

        // --- HEAVY ATTACKS (SIGS) ---
        attack_heavy_neutral: { prefix: 'sga_up_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_side: { prefix: 'sga_side_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_down: { prefix: 'sga_side_sig_', count: 1, suffix: '000', loop: false },

        // Utilities
        wall_slide: { prefix: 'sga_wall_slide_', count: 1, suffix: '000', loop: false },
        recovery: { prefix: 'sga_recovery_', count: 1, suffix: '000', loop: false },
        ground_pound: { prefix: 'sga_ground_pound_', count: 1, suffix: '000', loop: false },
        hurt: { prefix: 'sga_hurt_', count: 1, suffix: '000', loop: false },
        fall: { prefix: 'sga_fall_', count: 1, suffix: '000', loop: false },
        jump: { prefix: 'sga_jump_', count: 1, suffix: '000', loop: false },
        slide: { prefix: 'sga_dodge_', count: 1, suffix: '000', loop: false }
    },
    'pe': {
        idle: { prefix: 'pe_idle_', count: 17, loop: true },
        run: { prefix: 'pe_run_', count: 9, loop: true },
        charging: { prefix: 'pe_charge_', count: 2, loop: true },

        dash: { prefix: 'pe_dash_', count: 1, suffix: '000', loop: false },
        spot_dodge: { prefix: 'pe_dodge_', count: 1, suffix: '000', loop: false },

        // Side Sig Ghost
        side_sig_ghost: { prefix: 'pe_side_sig_ghost_', count: 1, loop: false },

        // --- LIGHT ATTACKS ---
        attack_light_neutral: { prefix: 'pe_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_side: { prefix: 'pe_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_side_air: { prefix: 'pe_side_air_', count: 1, suffix: '000', loop: false },
        attack_light_run: { prefix: 'pe_side_run_', count: 1, suffix: '000', loop: false },
        attack_light_down: { prefix: 'pe_down_light_', count: 1, suffix: '000', loop: false },
        attack_light_up: { prefix: 'pe_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_up_air: { prefix: 'pe_side_air_', count: 1, suffix: '000', loop: false },

        // --- HEAVY ATTACKS (SIGS) ---
        attack_heavy_neutral: { prefix: 'pe_up_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_side: { prefix: 'pe_side_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_down: { prefix: 'pe_side_sig_', count: 1, suffix: '000', loop: false },

        // Utilities
        wall_slide: { prefix: 'pe_wall_slide_', count: 1, suffix: '000', loop: false },
        recovery: { prefix: 'pe_recovery_', count: 1, suffix: '000', loop: false },
        ground_pound: { prefix: 'pe_ground_pound_', count: 1, suffix: '000', loop: false },
        hurt: { prefix: 'pe_hurt_', count: 1, suffix: '000', loop: false },
        fall: { prefix: 'pe_fall_', count: 1, suffix: '000', loop: false },
        jump: { prefix: 'pe_jump_', count: 1, suffix: '000', loop: false },
        slide: { prefix: 'pe_dodge_', count: 1, suffix: '000', loop: false }
    },
    'nock': {
        idle: { prefix: 'nock_idle_', count: 17, loop: true },
        run: { prefix: 'nick_run_', count: 9, loop: true }, // Note: nick_run (atlas naming)
        charging: { prefix: 'nock_charge_', count: 2, loop: true },

        dash: { prefix: 'nock_dash_', count: 1, suffix: '000', loop: false },
        spot_dodge: { prefix: 'nock_dodge_', count: 1, suffix: '000', loop: false },

        // --- LIGHT ATTACKS ---
        attack_light_neutral: { prefix: 'nock_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_side: { prefix: 'nock_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_side_air: { prefix: 'nock_side_air_', count: 1, suffix: '000', loop: false },
        attack_light_run: { prefix: 'nock_side_run_', count: 1, suffix: '000', loop: false },
        attack_light_down: { prefix: 'nock_down_light_', count: 1, suffix: '000', loop: false },
        attack_light_up: { prefix: 'nock_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_up_air: { prefix: 'nock_side_air_', count: 1, suffix: '000', loop: false },

        // --- HEAVY ATTACKS (SIGS) ---
        attack_heavy_neutral: { prefix: 'nock_up_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_side: { prefix: 'nock_side_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_down: { prefix: 'nock_side_sig_', count: 1, suffix: '000', loop: false },

        // Utilities
        wall_slide: { prefix: 'nock_wall_slide_', count: 1, suffix: '000', loop: false },
        recovery: { prefix: 'nock_recovery_', count: 1, suffix: '000', loop: false },
        ground_pound: { prefix: 'nock_ground_pound_', count: 1, suffix: '000', loop: false },
        hurt: { prefix: 'nock_hurt_', count: 1, suffix: '000', loop: false },
        fall: { prefix: 'nock_fall_', count: 1, suffix: '000', loop: false },
        jump: { prefix: 'nock_jump_', count: 1, suffix: '000', loop: false },
        slide: { prefix: 'nock_dodge_', count: 1, suffix: '000', loop: false }
    },
    'greg': {
        idle: { prefix: 'greg_idle_', count: 17, loop: true },
        run: { prefix: 'greg_run_', count: 9, loop: true },
        charging: { prefix: 'greg_charge_', count: 2, loop: true },

        dash: { prefix: 'greg_dash_', count: 1, suffix: '000', loop: false },
        spot_dodge: { prefix: 'greg_dodge_', count: 1, suffix: '000', loop: false },

        // --- LIGHT ATTACKS ---
        attack_light_neutral: { prefix: 'greg_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_side: { prefix: 'greg_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_side_air: { prefix: 'greg_side_air_', count: 1, suffix: '000', loop: false },
        attack_light_run: { prefix: 'greg_side_run_', count: 1, suffix: '000', loop: false },
        attack_light_down: { prefix: 'greg_down_light_', count: 1, suffix: '000', loop: false },
        attack_light_up: { prefix: 'greg_side_light_', count: 1, suffix: '000', loop: false },
        attack_light_up_air: { prefix: 'greg_side_air_', count: 1, suffix: '000', loop: false },

        // --- HEAVY ATTACKS (SIGS) ---
        attack_heavy_neutral: { prefix: 'greg_up_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_side: { prefix: 'greg_side_sig_', count: 1, suffix: '000', loop: false },
        attack_heavy_down: { prefix: 'greg_side_sig_', count: 1, suffix: '000', loop: false },

        // Utilities
        wall_slide: { prefix: 'greg_wall_slide_', count: 1, suffix: '000', loop: false },
        recovery: { prefix: 'greg_recovery_', count: 1, suffix: '000', loop: false },
        ground_pound: { prefix: 'greg_ground_pound_', count: 1, suffix: '000', loop: false },
        hurt: { prefix: 'greg_hurt_', count: 1, suffix: '000', loop: false },
        fall: { prefix: 'greg_fall_', count: 1, suffix: '000', loop: false },
        jump: { prefix: 'greg_jump_', count: 1, suffix: '000', loop: false },
        slide: { prefix: 'greg_dodge_', count: 1, suffix: '000', loop: false }
    }
};

/** List of all available character keys */
export const ALL_CHARACTERS = Object.keys(charConfigs);

/** Default frame rates for animation creation */
export const ANIM_FRAME_RATES = {
    RUN: 24,
    DEFAULT: 10
} as const;
