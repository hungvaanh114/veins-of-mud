"""Build the double-clickable edition from the same files served by dist/."""
from pathlib import Path
import base64
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
OUT = ROOT / "CHOI-GAME.html"


def embed_script(match):
    source = (DIST / match.group(1)).read_text(encoding="utf-8")
    # A literal HTML end tag in a JS string would terminate an inline script.
    source = re.sub(r"</script", lambda _: r"<\/script", source, flags=re.I)
    return "<script>\n" + source + "\n</script>"


def main():
    assets = {}
    for path in sorted(DIST.rglob("*")):
        if path.suffix not in (".webp", ".png"):
            continue
        key = path.relative_to(DIST).as_posix()
        payload = base64.b64encode(path.read_bytes()).decode("ascii")
        assets[key] = "data:image/" + path.suffix[1:] + ";base64," + payload

    html = (DIST / "index.html").read_text(encoding="utf-8")
    style = (DIST / "style.css").read_text(encoding="utf-8")
    html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + style + "\n</style>")
    data = json.dumps(assets, separators=(",", ":"))
    first = '<script src="assets.js"></script>'
    if first not in html:
        raise ValueError("Missing asset loader entry point")
    html = html.replace(first, "<script>globalThis.vomAssets=" + data + ";</script>" + first, 1)
    html = re.sub(r'<script src="([^"]+)"></script>', embed_script, html)
    OUT.write_text(html, encoding="utf-8")
    print(OUT.name, OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
