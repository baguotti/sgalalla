"""
The racing mini-game's temporary car, at the size the racer draws it
(1920x1080): the artwork is shrunk to CAR_WIDTH pixels wide.

  python3 scripts/racing-car.py "<path to fok_car_temp_001.png>"

Writes public/assets/racing/car_temp.png. Needs Pillow.
"""
import sys
from pathlib import Path

from PIL import Image

CAR_WIDTH = 448
OUT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'racing' / 'car_temp.png'


def main(source: Path) -> None:
    image = Image.open(source).convert('RGBA')
    # Faint stray pixels round the car don't count towards its size
    solid = image.getchannel('A').point(lambda a: 255 if a > 128 else 0)
    car = image.crop(solid.getbbox())
    height = round(car.height * CAR_WIDTH / car.width)
    small = car.resize((CAR_WIDTH, height), Image.BOX)
    # Pixel art has no half-see-through edges: each pixel is in or out
    alpha = small.getchannel('A').point(lambda a: 255 if a > 110 else 0)
    small.putalpha(alpha)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    small.save(OUT)
    print(f'{OUT.name}: {CAR_WIDTH}x{height}')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 scripts/racing-car.py <fok_car_temp_001.png>')
    main(Path(sys.argv[1]))
