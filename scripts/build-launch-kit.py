from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont, ImageOps, PngImagePlugin


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "social-media-assets" / "launch"
SOURCE = OUT / "illustration-source.png"
URL = "https://setlog-match-web.vercel.app/?ref=partner-kit&utm_source=instagram&utm_medium=partner&utm_campaign=first100"

PAPER = "#f5f4ee"
SURFACE = "#fffef9"
INK = "#163531"
INK_SOFT = "#64716b"
CORAL = "#d8674f"
SUCCESS = "#2f6b58"
FONT_REGULAR = "C:/Windows/Fonts/YuGothM.ttc"
FONT_BOLD = "C:/Windows/Fonts/YuGothB.ttc"


def font(size: int, bold: bool = False):
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size=size)


def text(draw, xy, value, size, fill=INK, bold=False, anchor=None, spacing=12):
    draw.multiline_text(xy, value, font=font(size, bold), fill=fill, anchor=anchor, spacing=spacing)


def cover(image: Image.Image, size: tuple[int, int], focus_y=0.5):
    target_w, target_h = size
    ratio = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)
    left = max(0, (resized.width - target_w) // 2)
    top = max(0, round((resized.height - target_h) * focus_y))
    return resized.crop((left, top, left + target_w, top + target_h))


def framed_art(base, box, source, focus_y=0.5):
    x, y, w, h = box
    art = cover(source, (w, h), focus_y)
    base.paste(art, (x, y))
    draw = ImageDraw.Draw(base)
    draw.rectangle((x, y, x + w, y + h), outline=INK, width=7)


def brand(draw, width, top=70):
    draw.rectangle((64, top, 124, top + 60), fill=INK)
    text(draw, (94, top + 30), "sm", 24, fill=SURFACE, bold=True, anchor="mm")
    text(draw, (146, top + 2), "set-mob", 34, bold=True)
    text(draw, (146, top + 43), "SATURDAY ISSUE", 18, fill=INK_SOFT, bold=True)
    draw.line((64, top + 88, width - 64, top + 88), fill=INK, width=4)


def footer(draw, width, y, message="独立運営 / 18歳以上の青学生限定"):
    draw.line((64, y, width - 64, y), fill=INK, width=3)
    text(draw, (64, y + 22), message, 20, fill=INK_SOFT, bold=True)
    text(draw, (width - 64, y + 22), "SET-MOB.JP", 19, fill=INK_SOFT, bold=True, anchor="ra")


def qr_image(size=350):
    qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=12, border=4)
    qr.add_data(URL)
    qr.make(fit=True)
    image = qr.make_image(fill_color=INK, back_color=SURFACE).convert("RGB")
    return image.resize((size, size), Image.Resampling.NEAREST)


def save(image, name):
    metadata = PngImagePlugin.PngInfo()
    metadata.add_text("set-mob-url", URL)
    metadata.add_text("asset-note", "set-mob independent service; background illustration generated with built-in image generation")
    image.save(OUT / name, pnginfo=metadata, optimize=True)


def story_one(source):
    canvas = Image.new("RGB", (1080, 1920), PAPER)
    draw = ImageDraw.Draw(canvas)
    brand(draw, 1080)
    text(draw, (64, 210), "知らない青学生の、\n土曜日を知る。", 100, bold=True, spacing=14)
    text(draw, (67, 470), "友人  /  恋愛  /  どちらでも", 30, fill=CORAL, bold=True)
    framed_art(canvas, (64, 565, 952, 1080), source, 0.5)
    text(draw, (64, 1690), "一日の過ごし方から始まる、\n毎週土曜のDay Pair。", 36, bold=True, spacing=10)
    footer(draw, 1080, 1820)
    save(canvas, "story-01-discovery.png")


def story_two(source):
    canvas = Image.new("RGB", (1080, 1920), PAPER)
    draw = ImageDraw.Draw(canvas)
    brand(draw, 1080)
    text(draw, (64, 210), "教えるのは、\n双方が選んだものだけ。", 88, bold=True, spacing=14)
    framed_art(canvas, (64, 500, 952, 760), source, 0.58)
    bullets = [
        ("01", "連絡先は相互同意時だけ開示"),
        ("02", "嫌ならいつでもブロック・通報"),
        ("03", "希望する目的・相手を双方で確認"),
    ]
    y = 1320
    for number, copy in bullets:
        draw.rectangle((64, y, 146, y + 68), fill=CORAL, outline=INK, width=4)
        text(draw, (105, y + 34), number, 23, bold=True, anchor="mm")
        text(draw, (178, y + 11), copy, 31, bold=True)
        y += 112
    footer(draw, 1080, 1820)
    save(canvas, "story-02-safety.png")


def story_three(source):
    canvas = Image.new("RGB", (1080, 1920), PAPER)
    draw = ImageDraw.Draw(canvas)
    brand(draw, 1080)
    text(draw, (64, 210), "初回100人、\n招待受付中。", 108, bold=True, spacing=12)
    text(draw, (66, 465), "次の土曜に事前登録", 34, fill=CORAL, bold=True)
    framed_art(canvas, (64, 555, 952, 510), source, 0.67)
    draw.rectangle((64, 1115, 1016, 1740), fill=SURFACE, outline=INK, width=7)
    qr = qr_image(390)
    canvas.paste(qr, (105, 1220))
    text(draw, (545, 1200), "参加条件", 24, fill=CORAL, bold=True)
    text(draw, (545, 1255), "18歳以上\n青学生\nメール認証\nLINE連携", 42, bold=True, spacing=18)
    text(draw, (545, 1540), "QRから参加登録へ", 27, fill=INK_SOFT, bold=True)
    footer(draw, 1080, 1820)
    save(canvas, "story-03-call-to-action.png")


def square_post(source):
    canvas = Image.new("RGB", (1080, 1080), PAPER)
    draw = ImageDraw.Draw(canvas)
    brand(draw, 1080, 44)
    text(draw, (64, 170), "土曜の一日から、\nつながる。", 83, bold=True, spacing=8)
    text(draw, (65, 365), "友人  /  恋愛  /  どちらでも", 25, fill=CORAL, bold=True)
    framed_art(canvas, (64, 430, 650, 500), source, 0.58)
    qr = qr_image(230)
    draw.rectangle((740, 430, 1016, 930), fill=SURFACE, outline=INK, width=7)
    canvas.paste(qr, (763, 470))
    text(draw, (878, 730), "初回100人", 31, bold=True, anchor="ma")
    text(draw, (878, 785), "招待受付中", 27, fill=CORAL, bold=True, anchor="ma")
    text(draw, (878, 845), "18歳以上\n青学生限定", 20, fill=INK_SOFT, bold=True, anchor="ma", spacing=5)
    footer(draw, 1080, 975, "独立運営 / 連絡先は相互同意まで非公開")
    save(canvas, "post-01-launch.png")


def contact_sheet():
    names = ["story-01-discovery.png", "story-02-safety.png", "story-03-call-to-action.png", "post-01-launch.png"]
    thumbs = []
    for name in names:
        image = Image.open(OUT / name).convert("RGB")
        image.thumbnail((300, 460), Image.Resampling.LANCZOS)
        thumbs.append((name, image.copy()))
    sheet = Image.new("RGB", (1320, 560), "#ebece4")
    draw = ImageDraw.Draw(sheet)
    x = 20
    for name, image in thumbs:
        sheet.paste(image, (x, 20))
        text(draw, (x, 500), name, 17, bold=True)
        x += 325
    sheet.save(OUT / "launch-kit-preview.png", optimize=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source = ImageOps.exif_transpose(Image.open(SOURCE)).convert("RGB")
    story_one(source)
    story_two(source)
    story_three(source)
    square_post(source)
    contact_sheet()
    print(f"Built launch kit in {OUT}")


if __name__ == "__main__":
    main()
