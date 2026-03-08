/**
 * Maps character keys to their campaign island (map) names.
 * The ladder order is randomized per save, so each character
 * always maps to the same location regardless of fight order.
 */
export const ISLAND_NAMES: Record<string, string> = {
    fok: 'Londra',
    sgu: 'Adria',
    sga: 'Sguzia',
    greg: 'La Serra',
    nock: 'La Sala Prove',
    pe: 'La Palestra',
};

/**
 * Maps character keys to the stage background key used during their fight.
 * Centralised here so adding a new character only requires editing this file.
 */
export const CHARACTER_STAGES: Record<string, string> = {
    fok: 'londra_bg',
    sgu: 'adria_bg',
    sga: 'sguzia_bg',
    greg: 'adria_bg',
    nock: 'bg_la_sala_prove',
    pe: 'adria_bg',
};

