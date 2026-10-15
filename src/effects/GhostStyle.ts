/** How attack ghosts look: see-through, with a coloured glow. */
export interface GhostStyle {
    opacity: number;
    glow: number;
    color: number;
}

export const DEFAULT_GHOST_STYLE: Readonly<GhostStyle> = { opacity: 0.5, glow: 0.2, color: 0xffffff };

/** The style every match draws ghosts with; the Studio Lab edits it live. New ghosts pick up changes. */
export const ghostStyle: GhostStyle = { ...DEFAULT_GHOST_STYLE };
