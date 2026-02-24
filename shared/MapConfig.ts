/**
 * Shared Map / Stage Configuration
 * Single source of truth for stage geometry.
 * Used by both client and server. NO PHASER DEPENDENCIES.
 */

export const MapConfig = {
    // Wall geometry
    WALL_THICKNESS: 45,
    WALL_LEFT_X: 0,
    WALL_RIGHT_X: 1920,

    // Blast zone boundaries (KO boundaries)
    BLAST_ZONE_LEFT: -1020,
    BLAST_ZONE_RIGHT: 2940,
    BLAST_ZONE_TOP: -1000,
    BLAST_ZONE_BOTTOM: 1800,
} as const;

/** Camera zoom presets (client-only, but kept here for co-location). */
export const ZOOM_SETTINGS = {
    CLOSE: { padX: 250, padY: 100, minZoom: 0.5, maxZoom: 1.5 },
    NORMAL: { padX: 450, padY: 300, minZoom: 0.5, maxZoom: 1.1 },
    WIDE: { padX: 600, padY: 450, minZoom: 0.3, maxZoom: 0.8 },
} as const;

export type ZoomLevel = keyof typeof ZOOM_SETTINGS;
