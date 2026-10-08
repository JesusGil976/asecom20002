"""Build a local QA gallery from results.json. Pillow is optional for contact sheets."""
from pathlib import Path
import html
import json
root = Path(__file__).resolve().parents[1] / 'qa'
data = json.loads((root / 'browser/results.json').read_text())
cards = []
for page in data['pages']:
    filename = page['screenshot']
    route = html.escape(page['route'])
    cards.append(f'<article><h2>{page["width"]} px · {route}</h2><a href="browser/{filename}"><img loading="lazy" src="browser/{filename}" alt="{route}"></a></article>')
if (root/'video/results.json').exists():
    video=json.loads((root/'video/results.json').read_text())
    for name in video['screenshots']:
        cards.append(f'<article><h2>Vídeo y correo · {html.escape(name)}</h2><a href="video/{name}"><img loading="lazy" src="video/{name}" alt="{html.escape(name)}"></a></article>')
(root / 'index.html').write_text('<!doctype html><html lang="es"><meta charset="utf-8"><title>QA AcademiaVE 5.3.0</title><style>body{font-family:system-ui;background:#f7f8f5;padding:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}article{background:white;padding:12px;border:1px solid #dce3dd}h2{font-size:14px}img{max-width:100%;max-height:600px;object-fit:contain;object-position:top}</style><h1>QA AcademiaVE 5.3.0 · '+str(len(cards))+' capturas</h1><p>Clic para ver cada captura completa.</p><main>'+''.join(cards)+'</main></html>')
wanted = {page['screenshot'] for page in data['pages']}
for image_path in (root / 'browser').glob('*.png'):
    if image_path.name not in wanted:
        image_path.unlink()
try:
    from PIL import Image, ImageDraw
except ImportError:
    print('Galería creada. Instala Pillow para generar mosaicos opcionales.')
else:
    (root / 'contact-sheets').mkdir(exist_ok=True)
    for width in data['widths']:
        sheet = Image.new('RGB', (1100, 1450), '#e5e9e5')
        draw = ImageDraw.Draw(sheet)
        pages = [page for page in data['pages'] if page['width'] == width]
        for index, page in enumerate(pages):
            image = Image.open(root / 'browser' / page['screenshot']).convert('RGB')
            image = image.crop((0, 0, image.width, min(image.height, 900)))
            image.thumbnail((208, 255))
            x, y = (index % 5) * 220 + 6, (index // 5) * 290 + 24
            sheet.paste(image, (x, y))
            draw.text((x, y - 18), page['route'][:29], fill='#142d2a')
        sheet.save(root / 'contact-sheets' / f'{width}.jpg', quality=85)
    print('Galería y siete mosaicos creados.')
