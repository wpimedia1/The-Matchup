"""Render the site's original typographic brand graphics. Developer-only: pip install Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

assets = Path(__file__).resolve().parent.parent / 'public' / 'assets'
navy, blue, white = '#081b34', '#0758d4', '#ffffff'
def font(size):
    return ImageFont.truetype(str(assets / 'barlowcondensed-extrabold.ttf'), size)

# Code-native type and geometric accents; no external photos or team marks.
card = Image.new('RGB', (1200, 630), navy)
draw = ImageDraw.Draw(card)
draw.polygon([(930, 0), (1200, 0), (1200, 630), (730, 630)], fill='#0b2b56')
draw.line([(970, 0), (770, 630)], fill=blue, width=6)
draw.text((72, 62), 'NBA  /  NFL', font=font(30), fill='#9db9dd')
draw.text((66, 150), 'THE MATCHUP', font=font(144), fill=white)
draw.rectangle((74, 325, 658, 335), fill=blue)
draw.text((72, 382), 'GAME LINES. PLAYER PROPS. RECENT FORM.', font=font(38), fill=white)
draw.text((72, 528), 'the-matchup.app', font=font(27), fill='#9db9dd')
card.save(assets / 'social-preview.png', optimize=True)
for size, name in [(32, 'favicon.png'), (180, 'apple-touch-icon.png')]:
    icon = Image.new('RGB', (size, size), navy)
    d = ImageDraw.Draw(icon)
    text_font = font(round(size * .67))
    d.text((size / 2, size * .43), 'TM', font=text_font, anchor='mm', fill=white)
    d.rectangle((size * .18, size * .78, size * .82, size * .86), fill=blue)
    icon.save(assets / name, optimize=True)
print('Created social preview and raster icons from original type and geometry.')
