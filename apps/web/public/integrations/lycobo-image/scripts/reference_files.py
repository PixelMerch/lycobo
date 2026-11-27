#!/usr/bin/env python3
"""为 Lycobo 定时任务在授权文件夹内查指纹和上传压缩副本。"""

import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import time
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

MAX_SOURCE_BYTES = 50 * 1024 * 1024
TARGET_BYTES = 500 * 1024
MAX_BYTES = 1024 * 1024
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif", ".bmp"}
UPLOAD_PATH = "/api/v1/enterprise/image-api/reference-uploads"


class ReferenceError(Exception):
    """可向用户报告的本地处理或上传错误。"""


class NoRedirect(HTTPRedirectHandler):
    """短期凭证只发送给已配置的 Lycobo 源站。"""

    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def source_path(root, name):
    """只接受授权目录内的真实文件，拒绝符号链接。"""
    path = Path(name)
    relative = path.relative_to(root) if path.is_absolute() else path
    if ".." in relative.parts:
        raise ReferenceError("PATH_OUTSIDE_FOLDER")
    current = root
    for part in relative.parts:
        current /= part
        if current.is_symlink():
            raise ReferenceError("SYMLINK_NOT_ALLOWED")
    if not current.is_file() or current.suffix.lower() not in IMAGE_SUFFIXES:
        raise ReferenceError("UNSUPPORTED_REFERENCE_FILE")
    return current


def fingerprint(path):
    """只读取原文件字节来计算指纹，流式读取以限制内存占用。"""
    digest = hashlib.sha256()
    total = 0
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            total += len(chunk)
            if total > MAX_SOURCE_BYTES:
                raise ReferenceError("SOURCE_TOO_LARGE")
            digest.update(chunk)
    if not total:
        raise ReferenceError("EMPTY_SOURCE")
    return digest.hexdigest()


def pillow_encoder(source):
    """优先使用本地 Pillow，自动处理方向信息并保留透明度。"""
    try:
        from PIL import Image, ImageOps, features
    except ImportError:
        return None
    if not features.check("webp"):
        return None
    with Image.open(io.BytesIO(source)) as original:
        if getattr(original, "is_animated", False):
            raise ReferenceError("ANIMATED_REFERENCE")
        # 先限制解码像素，再应用 EXIF 方向。
        if original.width * original.height > 48_000_000:
            raise ReferenceError("SOURCE_DIMENSIONS_TOO_LARGE")
        oriented = ImageOps.exif_transpose(original)
        image = oriented.convert("RGBA" if "A" in oriented.getbands() or "transparency" in oriented.info else "RGB")

    def encode(edge, quality):
        resized = image.copy()
        resized.thumbnail((edge, edge), Image.Resampling.LANCZOS)
        output = io.BytesIO()
        resized.save(output, format="WEBP", quality=quality, method=4)
        return output.getvalue()

    return encode


def magick_encoder(source):
    """Pillow 不可用时使用设备上的 ImageMagick 7。"""
    binary = shutil.which("magick")
    if not binary:
        for path in ("/opt/homebrew/bin/magick", "/usr/local/bin/magick"):
            if Path(path).is_file():
                binary = path
                break
    if not binary:
        raise ReferenceError("WEBP_ENCODER_UNAVAILABLE")

    def encode(edge, quality):
        result = subprocess.run(
            [binary, "-limit", "memory", "256MiB", "-limit", "map", "256MiB",
             "-limit", "disk", "0", "-limit", "list-length", "2", "-",
             "-auto-orient", "-resize", f"{edge}x{edge}>", "-strip",
             "-quality", str(quality), "webp:-"],
            input=source, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            timeout=35, check=False,
        )
        if result.returncode or not result.stdout:
            raise ReferenceError("WEBP_ENCODING_FAILED")
        return result.stdout

    return encode


def compress(source):
    """保持比例且不放大，先降质量，必要时减小长边。"""
    encode = pillow_encoder(source) or magick_encoder(source)
    for edge, quality in ((1600, 82), (1600, 72), (1600, 62), (1280, 72), (960, 62), (640, 62)):
        webp = encode(edge, quality)
        if len(webp) <= TARGET_BYTES:
            return webp
    if len(webp) <= MAX_BYTES:
        return webp
    raise ReferenceError("WEBP_TOO_LARGE")


def upload_reference(ticket, webp, base_url):
    """用已验证源站的短期凭证上传，遇到限流有限重试。"""
    base, url = urlsplit(base_url), urlsplit(ticket["uploadUrl"])
    local_http = base.scheme == "http" and base.hostname in {"localhost", "127.0.0.1", "::1"}
    if (
        (base.scheme != "https" and not local_http)
        or not base.hostname or base.username or base.password
        or (url.scheme, url.netloc, url.path) != (base.scheme, base.netloc, UPLOAD_PATH)
        or url.query or url.fragment
    ):
        raise ReferenceError("UNEXPECTED_UPLOAD_URL")
    request = Request(ticket["uploadUrl"], data=webp, method="PUT", headers={
        "Authorization": "Bearer " + ticket["uploadToken"],
        "Content-Type": "image/webp",
    })
    opener = build_opener(NoRedirect())
    for attempt in range(2):
        try:
            with opener.open(request, timeout=45) as response:
                return json.load(response)["data"]["assetId"]
        except HTTPError as error:
            retry_after = error.headers.get("Retry-After", "")
            status = error.code
            error.close()
            if status == 429 and attempt == 0 and retry_after.isdecimal() and int(retry_after) <= 60:
                time.sleep(int(retry_after))
                continue
            raise ReferenceError(f"UPLOAD_HTTP_{status}") from None
        except OSError:
            raise ReferenceError("UPLOAD_NETWORK_ERROR") from None
    raise ReferenceError("UPLOAD_RETRY_EXHAUSTED")


def prepare(root, manifest, base_url):
    """复用命中项，仅重新读取并上传指纹未命中的文件。"""
    tickets = {ticket["sha256"]: ticket for ticket in manifest["references"]}
    assets, errors = {}, []
    for file in manifest["files"]:
        name, sha256 = file["path"], file["sha256"]
        try:
            if sha256 not in assets:
                ticket = tickets[sha256]
                if "assetId" in ticket:
                    assets[sha256] = ticket["assetId"]
                else:
                    with source_path(root, name).open("rb") as source:
                        data = source.read(MAX_SOURCE_BYTES + 1)
                    if len(data) > MAX_SOURCE_BYTES:
                        raise ReferenceError("SOURCE_TOO_LARGE")
                    if hashlib.sha256(data).hexdigest() != sha256:
                        raise ReferenceError("SOURCE_CHANGED")
                    assets[sha256] = upload_reference(ticket, compress(data), base_url)
        except ReferenceError as error:
            errors.append({"path": name, "code": str(error)})
        except (OSError, KeyError, ValueError, subprocess.TimeoutExpired):
            errors.append({"path": name, "code": "REFERENCE_PREPARATION_FAILED"})
    return {
        "files": [{"path": f["path"], "assetId": assets[f["sha256"]]}
                  for f in manifest["files"] if f["sha256"] in assets],
        "errors": errors,
    }


def main():
    """提供独立的指纹与上传命令，让连接器执行中间查重。"""
    parser = argparse.ArgumentParser()
    commands = parser.add_subparsers(dest="command", required=True)
    scan = commands.add_parser("fingerprint")
    scan.add_argument("folder", type=Path)
    scan.add_argument("files", nargs="+")
    upload = commands.add_parser("upload")
    upload.add_argument("folder", type=Path)
    upload.add_argument("--base-url", default="https://lycobo.com")
    args = parser.parse_args()
    try:
        root = args.folder.expanduser().resolve(strict=True)
        if not root.is_dir():
            raise ReferenceError("FOLDER_UNAVAILABLE")
        if args.command == "fingerprint":
            files = [{"path": name, "sha256": fingerprint(source_path(root, name))}
                     for name in args.files]
            result = {"files": files, "fingerprints": list(dict.fromkeys(f["sha256"] for f in files))}
        else:
            result = prepare(root, json.load(sys.stdin), args.base_url)
        print(json.dumps(result, ensure_ascii=False))
        return 1 if result.get("errors") else 0
    except ReferenceError as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
    except (OSError, ValueError, KeyError, TypeError):
        print(json.dumps({"error": "INVALID_REFERENCE_INPUT"}), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
