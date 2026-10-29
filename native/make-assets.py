"""
Draws the Android app's icon and splash sources into native/assets/ from the logo's blocks
(lib/app-logo.ts: نبأ in square Kufic, soft white and gold on black). Then:

    npx @capacitor/assets generate --android --assetPath native/assets

turns them into every size Android needs (android/app/src/main/res).
"""
import os
from PIL import Image, ImageDraw

GROUND = (0, 0, 0, 255)
INK = (0xF1, 0xF3, 0xEF, 255)
GOLD = (0xE0, 0xBC, 0x74, 255)
BOX = 200
RADIUS = 1.5
LETTERS = [(40, 127, 120, 14), (40, 57, 14, 84), (93, 99, 14, 42), (146, 99, 14, 42)]
MARKS = [(146, 71, 14, 14), (93, 155, 14, 14), (40, 31, 15, 5), (40, 31, 5, 16), (40, 42, 15, 5)]
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets')


def word(image, box_px):
    """The word, its 200-unit square drawn `box_px` wide in the middle of `image`."""
    draw = ImageDraw.Draw(image)
    k = box_px / BOX
    left = (image.width - box_px) / 2
    top = (image.height - box_px) / 2
    for blocks, fill in ((LETTERS, INK), (MARKS, GOLD)):
        for x, y, w, h in blocks:
            draw.rounded_rectangle(
                (left + x * k, top + y * k, left + (x + w) * k - 1, top + (y + h) * k - 1),
                radius=RADIUS * k,
                fill=fill,
            )
    return image


def make(name, size, box_px, ground=GROUND, supersample=4):
    big = Image.new('RGBA', (size * supersample, size * supersample), ground)
    word(big, box_px * supersample)
    big.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, name))


os.makedirs(OUT, exist_ok=True)
# The full icon, as on the site (lib/app-icon.tsx at scale 1).
make('icon-only.png', 1024, 1024)
# Android's shaped icon: the word on its own. @capacitor/assets maps this square onto the 72 units
# a launcher shows (of the icon's 108), so the word's corners must stay inside the circle every
# shape keeps: 33 units from the middle, 469 of these 512 pixels. At 900 they are 411 out.
make('icon-foreground.png', 1024, 900, ground=(0, 0, 0, 0))
Image.new('RGBA', (1024, 1024), GROUND).save(os.path.join(OUT, 'icon-background.png'))
# The launch screen on older Android, in both themes: the word, small, on black.
make('splash.png', 2732, 1000, supersample=2)
make('splash-dark.png', 2732, 1000, supersample=2)
print('ok', sorted(os.listdir(OUT)))
