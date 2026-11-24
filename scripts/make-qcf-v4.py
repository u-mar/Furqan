"""Makes Naba's mushaf page fonts from the King Fahd Complex's V4 (1441H) colour page fonts, as published
by Quran Foundation (https://verses.quran.foundation/fonts/quran/hafs/v4/colrv1/woff2/p{n}.woff2).

The V4 fonts colour the letters by tajweed rule. Here the letters lose their colour layers and are
drawn from their own outlines, plain text in the app's ink, highlights and themes, and only the ayah
ornament keeps colours of its own (its number in the text's colour, 0xFFFF): palette 0 entries 10 (ring), 11 (flourishes), 12 (fill, clear: see ORNAMENT), as in
the 1440 print. lib/mushaf-fonts.ts makes the ornament plain on dark and black with font palettes.

Usage:  python -I scripts/make-qcf-v4.py <downloaded_dir> <out_dir> [pages...]
Then the 604 files go to public/qcf (for the Play Store app, which carries them) and to Naba's storage
under qcf5/ (scripts/upload-qcf-v4.mjs; lib/qcf-font-cdn.ts, for the website).
"""
import os
import sys
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables.C_P_A_L_ import Color

# Ring, flourishes, fill (red, green, blue, alpha). The fill is clear in the font itself: pictures and
# videos draw the page font on a canvas, which cannot choose a palette, in white over a photo, and a
# white number on a light fill could not be read. Read's light page fills it (lib/mushaf-fonts.ts).
ORNAMENT = {10: (0x6B, 0x77, 0x80, 255), 11: (0xE0, 0x15, 0x7F, 255), 12: (0xE4, 0xE7, 0xEA, 0)}
FOREGROUND = 0xFFFF

src, out = sys.argv[1], sys.argv[2]
pages = [int(p) for p in sys.argv[3:]] or list(range(1, 605))
os.makedirs(out, exist_ok=True)
bad = []
for p in pages:
    try:
        font = TTFont(os.path.join(src, f'p{p}.woff2'))
        colr = font['COLR']
        if colr.version != 0:
            raise ValueError(f'COLR v{colr.version}, expected v0')
        # Only the ornaments stay colour glyphs. Every other glyph has its whole shape as its own outline
        # too, and drawn from that it is plain text: thinned by the page's hairline stroke like any text
        # (app/mushaf-qcf.css; a colour glyph would draw as an outline only) and quicker to draw.
        colr.ColorLayers = {
            name: layers
            for name, layers in colr.ColorLayers.items()
            if any(layer.colorID in ORNAMENT for layer in layers)
        }
        for layers in colr.ColorLayers.values():
            for layer in layers:
                if layer.colorID not in ORNAMENT:
                    layer.colorID = FOREGROUND
        palette = font['CPAL'].palettes[0]
        for idx, (r, g, b, a) in ORNAMENT.items():
            palette[idx] = Color(red=r, green=g, blue=b, alpha=a)
        font.flavor = 'woff2'
        font.save(os.path.join(out, f'p{p}.woff2'))
    except Exception as e:  # noqa: BLE001
        bad.append((p, str(e)))
print(f'made {len(pages) - len(bad)} of {len(pages)}', 'failed:' if bad else '', bad[:10] if bad else '')
sys.exit(1 if bad else 0)
