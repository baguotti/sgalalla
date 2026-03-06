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
