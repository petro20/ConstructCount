#!/usr/bin/env python3
"""Gera favicon.ico + PNGs (16/32/180) a partir de assets/logo.png.
Rodar:  py assets/make_favicon.py
Requer: pillow  (py -m pip install pillow)
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "logo.png")

def main():
    if not os.path.isfile(SRC):
        print("logo.png não encontrado em assets/. Salve o logo lá primeiro.")
        return
    im = Image.open(SRC).convert("RGBA")
    # quadrado: cola num canvas quadrado transparente (não distorce)
    w, h = im.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2), im)

    canvas.resize((180, 180), Image.LANCZOS).save(os.path.join(HERE, "apple-touch-icon.png"))
    canvas.resize((32, 32), Image.LANCZOS).save(os.path.join(HERE, "favicon-32.png"))
    canvas.resize((16, 16), Image.LANCZOS).save(os.path.join(HERE, "favicon-16.png"))
    canvas.save(os.path.join(HERE, "favicon.ico"),
                sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print("OK: favicon.ico, favicon-32.png, favicon-16.png, apple-touch-icon.png gerados em assets/")

if __name__ == "__main__":
    main()
