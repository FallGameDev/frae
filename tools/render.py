"""
render.py
Helpers that use a headless Chromium browser (Playwright) to turn SVG files
into pictures, exactly the way a browser draws them (including Scratch's fonts).
"""
import base64, re
from playwright.sync_api import sync_playwright


class Renderer:
    def __init__(self, font_css=""):
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch()
        self.font_css = font_css
        self.pages = {}

    def page(self, scale):
        if scale not in self.pages:
            ctx = self.browser.new_context(device_scale_factor=scale, viewport={"width": 1200, "height": 900})
            self.pages[scale] = ctx.new_page()
        return self.pages[scale]

    def svg_to_png(self, svg_text, width, height, scale=2):
        """Draw an SVG at width x height (CSS px) times `scale`, transparent background. Returns PNG bytes."""
        pg = self.page(scale)
        # inline the SVG so the page fonts (Scratch "Sans Serif", "Pixel", ...) apply to <text>
        svg_text = re.sub(r'<\?xml[^>]*\?>', '', svg_text)
        html = (f'<html><head><style>{self.font_css} html,body{{margin:0;background:transparent}}'
                f'#w{{position:absolute;left:0;top:0;width:{width}px;height:{height}px}}'
                f'#w>svg{{display:block;width:{width}px;height:{height}px;overflow:hidden}}</style></head>'
                f'<body><div id="w">{svg_text}</div></body></html>')
        pg.set_viewport_size({"width": max(64, int(width) + 2), "height": max(64, int(height) + 2)})
        pg.set_content(html)
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(30)
        return pg.screenshot(clip={"x": 0, "y": 0, "width": width, "height": height}, omit_background=True)

    def html_to_png(self, html, width, height, scale=1):
        pg = self.page(scale)
        pg.set_viewport_size({"width": int(width), "height": int(height)})
        pg.set_content(html)
        pg.evaluate("document.fonts.ready")
        pg.wait_for_timeout(50)
        return pg.screenshot(clip={"x": 0, "y": 0, "width": width, "height": height}, omit_background=True)

    def close(self):
        self.browser.close()
        self.pw.stop()


def font_css(fonts):
    """fonts: {family name: path to .ttf/.otf/.woff2}. Returns @font-face rules with the files embedded."""
    out = []
    for fam, path in fonts.items():
        data = base64.b64encode(open(path, 'rb').read()).decode()
        fmt = 'woff2' if path.endswith('woff2') else 'opentype' if path.endswith('otf') else 'truetype'
        out.append(f'@font-face{{font-family:"{fam}";src:url(data:font/{fmt};base64,{data}) format("{fmt}")}}')
    return ''.join(out)
