"""
Builds Londra's layered background for the game from the full-size layers
(9862x8263, the same canvas as the painting):

  python3 scripts/londra-layers.py "../assets/Stages/Londra/Layers"

  public/assets/stages/londra/layers/island.webp   the floating island, trimmed
  public/assets/stages/londra/layers/clouds.webp   5 cloud pieces in one atlas
  public/assets/stages/londra/layers/clouds.json   their frames (Phaser 3 hash)

The island is exported at half the canvas resolution and the clouds at 0.45:
the game draws the canvas at 0.389 world px per pixel, so that is about one
texel per screen pixel at the camera's closer zooms. src/stages/LondraLayers.ts places the
pieces in canvas coordinates. Needs Pillow, numpy and cwebp.
"""
import json
import subprocess
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None

SCALE = 0.5
# The soft clouds a little less, so the widest fits a 2048 atlas
CLOUD_SCALE = 0.45
# Transparent pixels round every frame: the lit shader reads up to 4 texels past an edge
PADDING = 4
OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'stages' / 'londra' / 'layers'

# Each piece: where it sits on the clouds canvas (x, y, w, h), and which of the
# clouds inside that box it is, largest first
PIECES = {
    # These two touch in the art: a straight cut under the big one parts them
    'cumulus_big': ((2528, 5533, 4641, 1440), 0),
    'cumulus_low': ((4028, 6973, 2700, 635), 0),
    'cumulus_flat': ((1264, 4777, 2596, 897), 0),
    'tower': ((5201, 2679, 1978, 1130), 0),
    'puff': ((6954, 2288, 1434, 549), 0),
}


def components(alpha: np.ndarray, cell: int = 2, reach: int = 30) -> list[np.ndarray]:
    """
    Masks of the separate clouds in `alpha`, largest first. Clouds are found from
    their solid pixels shrunk by 6 cells, then each grows back `reach` cells into
    its edge, soft pixels and specks;
    faint pixels further out are left behind.
    """
    h, w = alpha.shape[0] // cell, alpha.shape[1] // cell
    small = np.asarray(Image.fromarray(alpha).resize((w, h), Image.BOX))
    solid, seen = small >= 128, small > 0
    # Shrinking the solid pixels first parts clouds that only touch at a point
    for _ in range(6):
        solid = solid & np.roll(solid, 1, 0) & np.roll(solid, -1, 0) & np.roll(solid, 1, 1) & np.roll(solid, -1, 1)
    labels = np.zeros((h, w), np.int32)
    sizes = []
    for y in range(h):
        for x in np.flatnonzero(solid[y] & (labels[y] == 0)):
            if labels[y, x]:
                continue
            sizes.append(0)
            label = len(sizes)
            labels[y, x] = label
            queue = deque([(y, x)])
            while queue:
                cy, cx = queue.popleft()
                sizes[-1] += 1
                for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                    if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = label
                        queue.append((ny, nx))
    keep = [k + 1 for k in sorted(range(len(sizes)), key=lambda k: -sizes[k]) if sizes[k] >= 5000]
    labels[~np.isin(labels, keep)] = 0
    for _ in range(reach):
        grown = labels.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            shifted = np.roll(labels, (dy, dx), axis=(0, 1))
            take = (grown == 0) & seen & (shifted > 0)
            grown[take] = shifted[take]
        labels = grown
    masks = []
    for k in keep:
        full = np.kron(labels == k, np.ones((cell, cell), bool))
        mask = np.zeros(alpha.shape, bool)
        mask[:full.shape[0], :full.shape[1]] = full
        masks.append(mask)
    return masks


def trimmed(rgba: np.ndarray) -> tuple[np.ndarray, int, int]:
    """`rgba` cut to its visible pixels, and the cut's offset."""
    ys, xs = np.nonzero(rgba[..., 3] > 0)
    return rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], int(xs.min()), int(ys.min())


def scaled(rgba: np.ndarray, scale: float) -> Image.Image:
    image = Image.fromarray(rgba)
    return image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)


def webp(image: Image.Image, path: Path) -> None:
    png = path.with_suffix('.png')
    image.save(png)
    subprocess.run(['cwebp', '-quiet', '-q', '92', '-alpha_q', '100', '-m', '6', str(png), '-o', str(path)], check=True)
    png.unlink()


def main(layers: Path) -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    island, x, y = trimmed(np.asarray(Image.open(layers / 'Londra_Main.png').convert('RGBA')))
    small = scaled(island, SCALE)
    padded = Image.new('RGBA', (small.width + 2 * PADDING, small.height + 2 * PADDING))
    padded.paste(small, (PADDING, PADDING))
    webp(padded, OUT / 'island.webp')
    print(f'island: canvas x {x}, y {y}, {island.shape[1]}x{island.shape[0]}')

    clouds = np.asarray(Image.open(layers / 'Londra_Clouds.png').convert('RGBA'))
    frames = {}
    for name, ((bx, by, bw, bh), index) in PIECES.items():
        box = clouds[by:by + bh, bx:bx + bw].copy()
        box[~components(box[..., 3])[index]] = 0
        piece, px, py = trimmed(box)
        frames[name] = (scaled(piece, CLOUD_SCALE), bx + px, by + py, piece.shape[1], piece.shape[0])
        print(f'{name}: canvas x {bx + px}, y {by + py}, {piece.shape[1]}x{piece.shape[0]}')

    # One row per piece, tallest first, in a 2048-wide atlas
    width = 2048
    placed, cx, cy, row = {}, PADDING, PADDING, 0
    for name, (image, *_rest) in sorted(frames.items(), key=lambda f: -f[1][0].height):
        if cx + image.width + PADDING > width:
            cx, cy, row = PADDING, cy + row + 2 * PADDING, 0
        placed[name] = (cx, cy)
        cx += image.width + 2 * PADDING
        row = max(row, image.height)
    height = cy + row + PADDING
    atlas = Image.new('RGBA', (width, height))
    data = {'frames': {}, 'meta': {'image': 'clouds.webp', 'size': {'w': width, 'h': height}, 'scale': CLOUD_SCALE}}
    for name, (image, *_rest) in frames.items():
        ax, ay = placed[name]
        atlas.paste(image, (ax, ay))
        size = {'w': image.width, 'h': image.height}
        data['frames'][name] = {
            'frame': {'x': ax, 'y': ay, **size}, 'rotated': False, 'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, **size}, 'sourceSize': size,
        }
    webp(atlas, OUT / 'clouds.webp')
    (OUT / 'clouds.json').write_text(json.dumps(data, indent=2))
    print(f'clouds atlas: {width}x{height}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 scripts/londra-layers.py <folder with Londra_Main.png and Londra_Clouds.png>')
    main(Path(sys.argv[1]))
