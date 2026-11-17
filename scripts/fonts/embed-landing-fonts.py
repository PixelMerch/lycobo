"""将现有普惠体切片按落地页文案再次裁切，内联到隔离模板。"""

import base64
import io
import logging
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
LANDING = ROOT / "apps/web/src/features/home/landing"
TEMPLATE = ROOT / "apps/web/public/openart-reference/index.html"
START = "<!-- lycobo-fonts:start -->"
END = "<!-- lycobo-fonts:end -->"


def inline_face(face, codepoints):
    """只嵌入当前文案用到的字形，并保留已有字体名称与许可元数据。"""
    match = re.search(r'url\("(/fonts/alibaba-puhuiti-3/[^\"]+)"\)', face)
    if not match:
        raise ValueError("Unexpected font path")
    font = TTFont(ROOT / "apps/web/public" / match[1].lstrip("/"))
    selected = set(font.getBestCmap()) & codepoints
    if not selected:
        font.close()
        return ""
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.name_languages = ["*"]
    builder = subset.Subsetter(options=options)
    builder.populate(unicodes=selected)
    builder.subset(font)
    if not selected.issubset(font.getBestCmap()):
        raise ValueError("Landing font subset lost characters")
    font.flavor = "woff2"
    font.recalcTimestamp = False
    data = io.BytesIO()
    font.save(data)
    font.close()
    uri = "data:font/woff2;base64," + base64.b64encode(data.getvalue()).decode()
    return face.replace(match[1], uri)


def main():
    """重建字体块；原有页面布局和动画保持原样。"""
    logging.getLogger("fontTools.subset").setLevel(logging.ERROR)
    # 源码字符是实际文案的超集，新增文案后重跑即可补齐字形。
    messages = "".join(p.read_text() for p in sorted(LANDING.glob("*-messages.ts")))
    codepoints = {ord(character) for character in messages}
    styles = "".join(
        (ROOT / f"apps/web/src/styles/fonts/puhuiti-{weight}.css").read_text()
        for weight in (400, 500, 600, 700)
    )
    faces = re.findall(r"@font-face\s*\{[^}]+\}", styles)
    inline = [inline_face(face, codepoints) for face in faces]
    typography = (LANDING / "landing-typography.css").read_text()
    block = START + "\n<style>\n" + "\n".join(filter(None, inline)) + "\n"
    block += typography + "</style>\n" + END + "\n"
    template = TEMPLATE.read_text()
    if START in template:
        start = template.index(START)
        end = template.index(END, start) + len(END)
        template = template[:start] + template[end:]
    template = re.sub(r"@font-face\s*\{[^}]+\}", "", template)
    # 删除录制的字体、字重和字距声明，由统一排版源接管，避免叠加强制覆盖。
    template = re.sub(
        r"<style[^>]*>.*?</style>",
        lambda match: re.sub(
            r"(?<![-\w])(?:font-family|font-weight|letter-spacing)\s*:[^;}]+;?",
            "",
            match[0],
        ),
        template,
        flags=re.S,
    )
    template = re.sub(r"\s*</head>", lambda _: "\n" + block + "</head>", template)
    TEMPLATE.write_text(template)
    print(f"Embedded {sum(bool(face) for face in inline)} PuHuiTi subsets for 4 weights.")


if __name__ == "__main__":
    main()
