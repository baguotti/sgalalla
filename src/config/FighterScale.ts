import { PhysicsConfig } from '../../shared/PhysicsConfig';

/** The fighters' art is drawn this tall (px), as Fok's idle frame. */
const ART_HEIGHT = 184;

/** Fighters are drawn at their physics height (PhysicsConfig.PLAYER_HEIGHT): their art, ghosts and sparks scaled by this. */
export function fighterScale(): number {
    return PhysicsConfig.PLAYER_HEIGHT / ART_HEIGHT;
}
