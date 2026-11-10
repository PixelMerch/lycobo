"""按固定字符分组生成自托管字体，校验来源、覆盖与切片之间的独立性。"""

import argparse
import hashlib
import io
import json
import logging
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
PLAN = Path(__file__).with_name("subsets.json")
PUBLIC = ROOT / "apps/web/public/fonts/alibaba-puhuiti-3"
STYLES = ROOT / "apps/web/src/styles/fonts"


def unicode_ranges(points):
    """合并连续码点，缩短 CSS 并保持浏览器按实际字符选择切片。"""
    ranges = []
    start = end = points[0]
    for point in points[1:]:
        if point == end + 1:
            end = point
            continue
        ranges.append((start, end))
        start = end = point
    ranges.append((start, end))
    return ",".join(
        f"U+{start:X}" if start == end else f"U+{start:X}-{end:X}"
        for start, end in ranges
    )


def build_weight(source, source_dir, plan):
    """保留字体版权和排版信息，生成一个字重的 WOFF2 与完整覆盖记录。"""
    logging.getLogger("fontTools.subset").setLevel(logging.ERROR)
    raw = (Path(source_dir) / source["filename"]).read_bytes()
    if hashlib.sha256(raw).hexdigest() != source["sha256"]:
        raise ValueError(f"字体来源校验失败：{source['filename']}")
    expected = set(TTFont(io.BytesIO(raw)).getBestCmap())
    covered = set()
    rules = []
    files = []
    for group in plan["subsets"]:
        group_points = set()
        for value in group["ranges"].split(","):
            bounds = [int(point, 16) for point in value.split("-")]
            group_points.update(range(bounds[0], bounds[-1] + 1))
        points = sorted(group_points & expected)
        if not points:
            continue
        if covered.intersection(points):
            raise ValueError(f"字符切片重叠：{group['name']}")
        font = TTFont(io.BytesIO(raw))
        font.recalcTimestamp = False
        options = subset.Options()
        options.layout_features = ["*"]
        options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 8, 9, 11, 13, 14]
        builder = subset.Subsetter(options=options)
        builder.populate(unicodes=points)
        builder.subset(font)
        if set(font.getBestCmap()) != set(points):
            raise ValueError(f"切片丢字：{group['name']}")
        font.flavor = "woff2"
        data = io.BytesIO()
        font.save(data)
        payload = data.getvalue()
        digest = hashlib.sha256(payload).hexdigest()[:12]
        filename = f"{source['weight']}-{group['name']}-{digest}.woff2"
        (PUBLIC / filename).write_bytes(payload)
        rules.append(
            "@font-face {\n"
            f'  font-family: "{plan["family"]}";\n'
            "  font-style: normal;\n"
            f"  font-weight: {source['weight']};\n"
            "  font-display: swap;\n"
            f'  src: url("/fonts/alibaba-puhuiti-3/{filename}") format("woff2");\n'
            f"  unicode-range: {unicode_ranges(points)};\n"
            "}\n"
        )
        covered.update(points)
        files.append({"file": filename, "bytes": len(payload), "characters": len(points)})
    if expected != covered:
        raise ValueError(f"字体覆盖不完整：{source['weight']}")
    (STYLES / f"puhuiti-{source['weight']}.css").write_text(
        "/* 自动生成的字体声明；修改来源分组后运行 scripts/fonts/build-subsets.py。 */\n"
        + "\n".join(rules)
    )
    print(f"字重 {source['weight']}：{len(covered)} 字符，{len(files)} 切片", flush=True)
    return {"weight": source["weight"], "characters": len(covered), "files": files}


def main():
    """读取已校验的官方源字体，并汇总可复查的生成记录。"""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    arguments = parser.parse_args()
    plan = json.loads(PLAN.read_text())
    PUBLIC.mkdir(parents=True, exist_ok=True)
    STYLES.mkdir(parents=True, exist_ok=True)
    with ProcessPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(build_weight, source, arguments.source_dir, plan)
            for source in plan["sources"]
        ]
        weights = [future.result() for future in futures]
    manifest = {"family": plan["family"], "version": plan["font_version"], "weights": weights}
    (PUBLIC / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
