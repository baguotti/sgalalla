# Character Animation & Sprite Conventions

This document outlines the naming conventions for character animations and sprites in the Sgalalla game engine. These keys can be used in **Dialogue Scripts** (via the `animation` field) or directly in code.

## 1. Character Identifiers (Lower-Case Keys)
Use these keys to identify characters:
- `fok` (Fok - Final Boss)
- `sgu` (Sgu)
- `sga` (Sga)
- `pe` (Pe)
- `nock` (Nock)
- `greg` (Greg)

## 2. Animation Naming Pattern
In the dialogue script `DialogueLine[]`, use the **Base Animation Key**.
The engine automatically resolves the full animation key by prepending the character's name:
`[Character Name]_[Base Animation Key]` (e.g., `fok_taunt`).

## 3. Base Animation Keys (Use in Scripts)

### Common Actions
| Base Key | Description |
| :--- | :--- |
| `idle` | Neutral standing pose (Looping) |
| `run` | Running animation |
| `taunt` | Character-specific taunt / flair |
| `win` | Victory celebration pose |
| `charging` | Power-up / signature charge-up |
| `hurt` | Hit reaction frame |
| `fall` | Falling through the air |
| `jump` | Jumping upward |
| `land` | Landing on ground (often uses `idle` or `run`) |
| `dash` | Forward burst movement |
| `spot_dodge` | Dodging in place |
| `wall_slide` | Sliding down a wall |

### Combat & Attacks
| Base Key | Description |
| :--- | :--- |
| `attack_light_neutral` | Standing light attack |
| `attack_light_up` | Upward light attack |
| `attack_light_down` | Downward light attack |
| `attack_light_side` | Side light attack |
| `attack_light_run` | Running light attack |
| `attack_heavy_neutral`| Neutral heavy (Signature) |
| `attack_heavy_up` | Upward heavy (Signature) |
| `attack_heavy_side`| Side heavy (Signature) |
| `attack_heavy_down`| Downward heavy (Signature) |

## 4. Sprite Atlas Structure
- **Main Atlas**: Each character has a dedicated atlas in `assets/[char]/[char].json`.
- **Taunt Atlas**: All character taunts are bundled in a shared `assets/taunts/taunts.json` to save memory and draw calls.
- **Reference File**: For the exact frame count and prefix mapping, see `src/config/CharacterConfig.ts`.

## 5. Script Example
```typescript
{ 
  speaker: "Fok", 
  text: "Feel the weight of my crown!", 
  side: "right", 
  animation: "taunt" // Correct: uses base key
}
```

> [!TIP]
> Always use `charging` (with -ing) instead of `charge`.
> Always use `taunt` for the special flair animation.
