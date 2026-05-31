"""Generate PNG icons + a promo tile for the Chrome Web Store.

Run: python3 generate_icons.py
Outputs land in ../icons/ and ../ (this folder) relative to this script.
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ICONS_DIR = os.path.join(HERE, "..", "icons")
ASSETS_DIR = HERE

BLUE = (37, 99, 235)        # #2563eb
BLUE_DARK = (29, 78, 216)   # #1d4ed8
WHITE = (255, 255, 255)
SHADOW = (0, 0, 0, 90)


def find_bold_font(size):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                pass
    return ImageFont.load_default()


def rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rounded_rectangle(xy, radius=radius, fill=fill)


def make_icon(size):
    # Render at 4x for crisp downscale.
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Blue rounded background.
    corner = int(s * 0.22)
    rounded_rect(draw, (0, 0, s - 1, s - 1), corner, BLUE)

    # White flashcard rectangle.
    inset = int(s * 0.16)
    card_radius = int(s * 0.08)
    card_box = (inset, inset + int(s * 0.04), s - inset, s - inset - int(s * 0.04))

    # Soft shadow under the card.
    shadow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    offset = int(s * 0.025)
    sdraw.rounded_rectangle(
        (card_box[0] + offset, card_box[1] + offset, card_box[2] + offset, card_box[3] + offset),
        radius=card_radius,
        fill=SHADOW,
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=int(s * 0.018)))
    img = Image.alpha_composite(img, shadow)
    draw = ImageDraw.Draw(img)

    rounded_rect(draw, card_box, card_radius, WHITE)

    # Letter "A" centered on the card.
    if size >= 32:
        font = find_bold_font(int(s * 0.55))
        text = "A"
        tbox = draw.textbbox((0, 0), text, font=font)
        tw = tbox[2] - tbox[0]
        th = tbox[3] - tbox[1]
        tx = (s - tw) / 2 - tbox[0]
        ty = (s - th) / 2 - tbox[1] - int(s * 0.02)
        draw.text((tx, ty), text, font=font, fill=BLUE)
    else:
        # At 16px the "A" gets muddy; use a clean plus-sign-on-card mark instead.
        bar = max(2, int(s * 0.07))
        cx, cy = s // 2, s // 2
        arm = int(s * 0.18)
        draw.rectangle((cx - arm, cy - bar, cx + arm, cy + bar), fill=BLUE)
        draw.rectangle((cx - bar, cy - arm, cx + bar, cy + arm), fill=BLUE)

    img = img.resize((size, size), Image.LANCZOS)
    return img


def make_promo_tile():
    """Chrome Web Store small promo tile: 440x280."""
    w, h = 440, 280
    img = Image.new("RGB", (w, h), BLUE)
    draw = ImageDraw.Draw(img)
    # Soft vignette bottom.
    grad = Image.new("RGB", (w, h), BLUE_DARK)
    mask = Image.new("L", (w, h), 0)
    mdraw = ImageDraw.Draw(mask)
    for y in range(h):
        mdraw.line([(0, y), (w, y)], fill=int(255 * (y / h) * 0.6))
    img = Image.composite(grad, img, mask)
    draw = ImageDraw.Draw(img)

    # Icon-style card on the left.
    icon = make_icon(160).convert("RGBA")
    img.paste(icon, (32, 60), icon)

    # Wordmark on the right.
    title_font = find_bold_font(26)
    sub_font = find_bold_font(14)
    draw.text((215, 88), "Anki Flashcard", font=title_font, fill=WHITE)
    draw.text((215, 122), "Creator", font=title_font, fill=WHITE)
    draw.text((215, 178), "Highlight → suggest → save.", font=sub_font, fill=(230, 235, 250))

    img.save(os.path.join(ASSETS_DIR, "promo_tile_440x280.png"))


def main():
    os.makedirs(ICONS_DIR, exist_ok=True)
    for sz in (16, 32, 48, 128):
        out = os.path.join(ICONS_DIR, f"icon{sz}.png")
        make_icon(sz).save(out)
        print(f"wrote {out}")
    make_promo_tile()
    print("wrote promo_tile_440x280.png")


if __name__ == "__main__":
    main()
