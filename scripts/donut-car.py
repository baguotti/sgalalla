"""
DERAPATE's temporary car: the Audi reference render (45 frames of one donut
loop, grey background), keyed out and packed into one sheet.

Every frame is cut with the same window, centred on the donut's pivot in the
render, so each frame keeps the car where it is round the pivot: placed at
the pivot in the game, the frames play the donut exactly as rendered, without
jumping. A JSON file lists where round the pivot the car is in each frame
(its angle on screen), for the game to pick the frame that matches.

  python3 scripts/donut-car.py <folder of f_01.png … f_45.png>

Writes public/assets/donut/car_temp.png (9 columns) and car_temp.json. Needs Pillow and numpy.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'donut'
COLUMNS = 9


def key_out(rgb: np.ndarray) -> np.ndarray:
    """The car's pixels: background is what looks like it and joins the frame's edge, so grey parts of the car stay."""
    background = np.median(rgb.reshape(-1, 3), axis=0)
    near = np.abs(rgb - background).max(axis=2) <= 10
    outside = np.zeros_like(near)
    h, w = near.shape
    stack = [(y, x) for y in range(h) for x in (0, w - 1)] + [(y, x) for x in range(w) for y in (0, h - 1)]
    while stack:
        y, x = stack.pop()
        if outside[y, x] or not near[y, x]:
            continue
        outside[y, x] = True
        if y > 0: stack.append((y - 1, x))
        if y < h - 1: stack.append((y + 1, x))
        if x > 0: stack.append((y, x - 1))
        if x < w - 1: stack.append((y, x + 1))
    return ~outside


def main(folder: Path) -> None:
    frames = sorted(folder.glob('f_*.png'))
    images, centres, boxes = [], [], []
    for path in frames:
        rgb = np.asarray(Image.open(path).convert('RGB')).astype(int)
        keep = key_out(rgb)
        ys, xs = np.nonzero(keep)
        images.append(Image.fromarray(np.dstack([rgb, np.where(keep, 255, 0)]).astype(np.uint8)))
        centres.append(((xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2))
        boxes.append((xs.min(), ys.min(), xs.max(), ys.max()))

    # The pivot: the middle of the car's path round the loop
    pivot = np.mean(centres, axis=0)
    reach = max(max(abs(b[0] - pivot[0]), abs(b[2] - pivot[0]), abs(b[1] - pivot[1]), abs(b[3] - pivot[1])) for b in boxes)
    size = int(math.ceil(reach * 2)) + 8
    left, top = int(round(pivot[0] - size / 2)), int(round(pivot[1] - size / 2))

    rows = (len(images) + COLUMNS - 1) // COLUMNS
    sheet = Image.new('RGBA', (size * COLUMNS, size * rows))
    for i, image in enumerate(images):
        sheet.paste(image.crop((left, top, left + size, top + size)), ((i % COLUMNS) * size, (i // COLUMNS) * size))
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / 'car_temp.png')

    # Where round the loop the car is in each frame: its angle round the pivot on screen (y down),
    # with the camera's squash of the circle undone, so the angles step evenly like the render's time
    dx = np.array([cx - pivot[0] for cx, _ in centres])
    dy = np.array([cy - pivot[1] for _, cy in centres])
    squash = float(np.ptp(dy) / np.ptp(dx))
    phases = [math.atan2(y / squash, x) for x, y in zip(dx, dy)]
    (OUT / 'car_temp.json').write_text(json.dumps({
        'frameSize': size, 'frames': len(images), 'squash': round(squash, 3),
        'phases': [round(a, 4) for a in phases], 'orbitPixels': round(float(np.ptp(dx)) / 2, 1),
    }, indent=2))
    print(f'{len(images)} frames, {size}x{size} each; the car swings {np.ptp(dx) / 2:.0f} px either side of the pivot, squash {squash:.2f}')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
