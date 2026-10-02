"""
DERAPATE's car: Riccardo's renders (90 frames of the car turning on the spot,
4 degrees apart, 1024x1024, transparent) packed into sheets for the game: the
body and the wheels as separate layers (the game draws the wheels under the
body, which gives back the full car, and moves the body on its springs).

Every layer is cut with the same window (found from the full car, so the car's
centre stays on the same pixel in all frames of all layers) and scaled down,
then the frames go into a grid. A JSON file says how big a frame is, where the
car's centre on the ground is in it (the pivot the game places on the donut),
which frame faces which way, and how long the car is in the frame's pixels (so
the game can draw it at its size).

A frame exactly the same as the one before it is a duplicate (the body folder
has one, frame 59) and is dropped, so every layer has the same frames.

  python3 scripts/donut-car-sprites.py "<folder with Completo, Main-body, Wheels>"

Writes public/assets/donut/car_body.webp, car_wheels.webp and car.json.
Needs Pillow and numpy.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'donut'
COLUMNS = 10
# Down from the 1024 px renders: the game draws the car at about a third of their size
SCALE = 0.4
MARGIN = 8
# The car (an Audi Q3-sized SUV): its length, and how high its front bumper's bottom is (metres)
CAR_LENGTH_M = 4.4
BUMPER_M = 0.3
# The layers the game uses: folder, sheet name
LAYERS = [('Main-body', 'car_body'), ('Wheels', 'car_wheels')]


def load_frames(folder: Path) -> list[Image.Image]:
    """The folder's PNGs in order, without frames identical to the one before."""
    frames: list[Image.Image] = []
    previous = None
    for path in sorted(p for p in folder.iterdir() if p.suffix.lower() == '.png'):
        image = Image.open(path).convert('RGBA')
        pixels = np.asarray(image)
        if previous is not None and np.array_equal(pixels, previous):
            print(f'  {folder.name}: {path.name} repeats the frame before it, dropped')
            continue
        previous = pixels
        frames.append(image)
    return frames


def main(root: Path) -> None:
    full = load_frames(root / 'Completo')
    boxes = []
    for image in full:
        ys, xs = np.nonzero(np.asarray(image)[..., 3] > 8)
        boxes.append((xs.min(), xs.max(), ys.min(), ys.max()))
    boxes = np.array(boxes, dtype=float)
    widths = boxes[:, 1] - boxes[:, 0]
    count = len(full)
    step = 360 / count

    # Facing the camera (nose straight down the screen) is the narrowest frame: heading 45° in the game's
    # ground (x down-right, y down-left on screen). The frames turn the other way round as they go.
    nose_down = int(np.argmin(widths[: count // 2]))
    # Side on (90° from there) the car's length shows whole: with the camera's true isometric squash,
    # half the width on screen is 0.6124 x its length
    side = (nose_down + round(90 / step)) % count
    length = (widths[side] / 2) / 0.6124

    # The car's centre on the ground: across, the middle of all the frames; down, from the bottom of the
    # nose-on frame (the front bumper, about BUMPER_M above the ground) less half its length, squashed.
    # Only roughly: the game's Lab can nudge it (sprite down)
    pivot_x = float(((boxes[:, 0] + boxes[:, 1]) / 2).mean())
    metre = length / CAR_LENGTH_M
    pivot_y = float(boxes[nose_down, 3] + BUMPER_M * metre - 0.5 * math.sqrt(2) * length / 2)

    left = int(boxes[:, 0].min()) - MARGIN
    top = int(boxes[:, 2].min()) - MARGIN
    right = int(boxes[:, 1].max()) + MARGIN
    bottom = int(boxes[:, 3].max()) + MARGIN
    frame_w = round((right - left) * SCALE)
    frame_h = round((bottom - top) * SCALE)
    rows = math.ceil(count / COLUMNS)
    OUT.mkdir(parents=True, exist_ok=True)

    for folder, name in LAYERS:
        frames = load_frames(root / folder)
        if len(frames) != count:
            raise SystemExit(f'{folder} has {len(frames)} frames, the full car {count}')
        sheet = Image.new('RGBA', (frame_w * COLUMNS, frame_h * rows))
        for i, image in enumerate(frames):
            cut = image.crop((left, top, right, bottom)).resize((frame_w, frame_h), Image.LANCZOS)
            sheet.paste(cut, ((i % COLUMNS) * frame_w, (i // COLUMNS) * frame_h))
        sheet.save(OUT / f'{name}.webp', 'WEBP', lossless=True, method=6)
        print(f'  {name}.webp: {(OUT / f"{name}.webp").stat().st_size / 1e6:.1f} MB')

    (OUT / 'car.json').write_text(json.dumps({
        'frameWidth': frame_w, 'frameHeight': frame_h, 'frames': count, 'columns': COLUMNS,
        'pivotX': round((pivot_x - left) * SCALE, 1), 'pivotY': round((pivot_y - top) * SCALE, 1),
        'noseDownFrame': nose_down, 'degreesPerFrame': step,
        'lengthPx': round(length * SCALE, 1),
    }, indent=2))
    print(f'{count} frames, {frame_w}x{frame_h} each, nose down in frame {nose_down + 1}, side on in {side + 1}; '
          f'pivot {pivot_x:.0f},{pivot_y:.0f} in the renders; length {length:.0f} px')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
