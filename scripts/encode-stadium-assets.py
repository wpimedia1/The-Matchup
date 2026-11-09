"""Encode the existing stadium artwork for web delivery; keep the PNG originals.

Developer-only utility: pip install Pillow. No crop, resize, or artwork changes.
"""
from pathlib import Path
from PIL import Image

assets = Path(__file__).resolve().parent.parent / 'public' / 'assets'
for league in ('nba', 'nfl'):
    source = assets / f'stadium-{league}.png'
    target = assets / f'stadium-{league}.webp'
    with Image.open(source) as artwork:
        artwork.convert('RGB').save(target, 'WEBP', quality=82, method=6)
    print(f'{league}: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes')
