from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


WIDTH = 2500
HEIGHT = 843
PAPER = "#f5f4ee"
SURFACE = "#fffef9"
INK = "#163531"
LINE = "#d7ddd5"
ACCENT = "#d8674f"
SUCCESS = "#2f6b58"

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "social-media-assets" / "line" / "rich-menu.png"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = Path("C:/Windows/Fonts/BIZ-UDGothicB.ttc" if bold else "C:/Windows/Fonts/BIZ-UDGothicR.ttc")
    return ImageFont.truetype(str(path), size)


def centered(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, typeface: ImageFont.FreeTypeFont, fill: str) -> None:
    box = draw.multiline_textbbox(xy, text, font=typeface, anchor="mm", align="center", spacing=12)
    draw.multiline_text((xy[0], xy[1]), text, font=typeface, anchor="mm", align="center", spacing=12, fill=fill)


def calendar_icon(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    draw.rounded_rectangle((cx - 52, cy - 42, cx + 52, cy + 48), radius=12, outline=INK, width=8, fill=SURFACE)
    draw.line((cx - 52, cy - 13, cx + 52, cy - 13), fill=INK, width=8)
    draw.line((cx - 25, cy - 55, cx - 25, cy - 27), fill=INK, width=10)
    draw.line((cx + 25, cy - 55, cx + 25, cy - 27), fill=INK, width=10)
    draw.ellipse((cx - 20, cy + 8, cx - 4, cy + 24), fill=ACCENT)
    draw.ellipse((cx + 10, cy + 8, cx + 26, cy + 24), fill=SUCCESS)


def status_icon(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    draw.rounded_rectangle((cx - 57, cy - 42, cx + 57, cy + 42), radius=18, outline=INK, width=8, fill=SURFACE)
    draw.line((cx - 28, cy + 10, cx - 4, cy + 29), fill=SUCCESS, width=11)
    draw.line((cx - 4, cy + 29, cx + 37, cy - 20), fill=SUCCESS, width=11)


def safety_icon(draw: ImageDraw.ImageDraw, cx: int, cy: int) -> None:
    points = [(cx, cy - 58), (cx + 52, cy - 28), (cx + 42, cy + 38), (cx, cy + 64), (cx - 42, cy + 38), (cx - 52, cy - 28)]
    draw.polygon(points, outline=INK, fill=SURFACE)
    draw.line((cx - 25, cy + 3, cx - 5, cy + 24), fill=ACCENT, width=10)
    draw.line((cx - 5, cy + 24, cx + 33, cy - 21), fill=ACCENT, width=10)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new("RGB", (WIDTH, HEIGHT), PAPER)
    draw = ImageDraw.Draw(image)

    columns = [(0, 833), (833, 1667), (1667, WIDTH)]
    panel_colors = [PAPER, SURFACE, PAPER]
    labels = ["参加登録\n今週土曜に参加", "参加状況\nマッチを確認", "安全・問い合わせ\n困ったときはこちら"]
    captions = ["土曜の一日を登録", "公開された内容を確認", "困ったときの相談先"]
    icon_drawers = [calendar_icon, status_icon, safety_icon]

    draw.rectangle((0, 0, WIDTH - 1, HEIGHT - 1), outline=INK, width=8)
    for index, ((left, right), color) in enumerate(zip(columns, panel_colors)):
        draw.rectangle((left + (8 if index else 0), 0, right - (8 if index < 2 else 0), HEIGHT), fill=color)
        if index < 2:
            draw.rectangle((right - 4, 0, right + 4, HEIGHT), fill=INK)
        cx = (left + right) // 2
        icon_drawers[index](draw, cx, 230)
        centered(draw, (cx, 392), labels[index], font(54, bold=True), INK)
        centered(draw, (cx, 552), captions[index], font(28), SUCCESS if index == 1 else INK)
        draw.line((cx - 110, 625, cx + 110, 625), fill=ACCENT if index == 0 else (SUCCESS if index == 1 else INK), width=8)

    draw.text((48, 42), "set-mob", font=font(31, bold=True), fill=INK)
    draw.text((WIDTH - 48, 42), "毎週土曜の小さな出会い", font=font(26), fill=INK, anchor="ra")
    image.save(OUTPUT, format="PNG", optimize=True)
    print(f"{OUTPUT} {WIDTH}x{HEIGHT} {OUTPUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
