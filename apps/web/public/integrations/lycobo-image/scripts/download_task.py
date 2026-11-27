#!/usr/bin/env python3
"""在用户授权的目录中等待一个 Lycobo 任务，下载该任务已保存的原图。"""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener
from uuid import UUID

from reference_files import NoRedirect

DOWNLOAD_PATH = "/api/v1/enterprise/image-api/task-downloads/"
MAX_IMAGE_BYTES = 32 * 1024 * 1024
PNG_HEADER = b"\x89PNG\r\n\x1a\n"
PNG_END = b"\x00\x00\x00\x00IEND\xaeB\x60\x82"
TERMINAL = {"succeeded", "partially_failed", "failed", "needs_reconciliation"}


class DownloadError(Exception):
    """只报告短码，省略凭证及下载地址。"""


def trusted_origin(value):
    """常规连接需要 HTTPS，本地开发允许环回 HTTP。"""
    url = urlsplit(value)
    loopback = url.hostname in {"localhost", "127.0.0.1", "::1", "cdn.lycobo.localhost"}
    if not url.hostname or url.username or url.password or url.query or url.fragment:
        raise DownloadError("INVALID_ORIGIN")
    if url.path not in {"", "/"} or (url.scheme != "https" and not (url.scheme == "http" and loopback)):
        raise DownloadError("INVALID_ORIGIN")
    return url.scheme, url.netloc


def validate_ticket(ticket, origin):
    """凭证只能发送到配置的 Lycobo 源站和该任务的固定路径。"""
    task_id = str(UUID(ticket["taskId"]))
    url = urlsplit(ticket["downloadUrl"])
    if (
        (url.scheme, url.netloc) != origin or url.path != DOWNLOAD_PATH + task_id
        or url.query or url.fragment
    ):
        raise DownloadError("INVALID_DOWNLOAD_URL")
    if not isinstance(ticket["downloadToken"], str) or not 0 < len(ticket["downloadToken"]) <= 700:
        raise DownloadError("INVALID_DOWNLOAD_TOKEN")
    expiry = ticket["expiresAt"] / 1000
    if expiry <= time.time() or expiry > time.time() + 2 * 60 * 60 + 60:
        raise DownloadError("EXPIRED_DOWNLOAD_TICKET")
    public_id = ticket.get("publicId", "")
    return public_id if re.fullmatch(r"[A-Z0-9]{9}", public_id) else task_id


def task_folder(folder, identifier):
    """在用户指定的既有目录下为任务创建独立文件夹。"""
    root = folder.expanduser().resolve(strict=True)
    if not root.is_dir():
        raise DownloadError("FOLDER_UNAVAILABLE")
    destination = root / f"Lycobo-{identifier}"
    destination.mkdir(exist_ok=True)
    if destination.is_symlink() or not destination.is_dir():
        raise DownloadError("INVALID_TASK_FOLDER")
    return destination


def write_status(folder, task_id, state, **details):
    """原子保存本机状态，允许后续读取失败原因或已下载数量。"""
    with tempfile.NamedTemporaryFile(dir=folder, mode="w", encoding="utf-8", delete=False) as output:
        temporary = Path(output.name)
        try:
            json.dump({"taskId": task_id, "state": state, "updatedAt": datetime.now(timezone.utc).isoformat(), **details}, output)
            output.close()
            os.replace(temporary, folder / ".lycobo-download.json")
        finally:
            temporary.unlink(missing_ok=True)


def wait_for_manifest(ticket, deadline):
    """仅在该任务排队或生成时按服务端建议间隔重新读取。"""
    request = Request(ticket["downloadUrl"], headers={"Authorization": "Bearer " + ticket["downloadToken"]})
    opener = build_opener(NoRedirect())
    failures = 0
    while time.time() < deadline:
        delay = 30
        try:
            with opener.open(request, timeout=20) as response:
                payload = json.loads(response.read(128 * 1024))["data"]
                state = payload["status"]
                if state in TERMINAL and response.status == 200:
                    return payload
                if state not in {"queued", "running"} or response.status != 202:
                    raise DownloadError("UNEXPECTED_TASK_STATUS")
                delay = min(120, max(30, int(payload.get("retryAfterSeconds", delay))))
                failures = 0
        except HTTPError as error:
            status, after = error.code, error.headers.get("Retry-After", "")
            error.close()
            if status != 429 and not 500 <= status < 600:
                raise DownloadError(f"TASK_HTTP_{status}") from None
            failures += 1
            if after.isdecimal():
                delay = min(120, max(delay, int(after)))
        except OSError:
            failures += 1
        if failures >= 5:
            raise DownloadError("TASK_NETWORK_UNAVAILABLE")
        time.sleep(max(0, min(delay, deadline - time.time())))
    raise DownloadError("TASK_WAIT_EXPIRED")


def save_image(entry, folder, media_origin):
    """从固定媒体源读取原图，流式写入并只在完整时替换正式文件。"""
    asset_id = str(UUID(entry["assetId"]))
    index = entry["index"]
    url = urlsplit(entry["url"])
    if (
        (url.scheme, url.netloc) != media_origin or url.fragment
        or not url.path.endswith(f"/{asset_id}.png")
        or not isinstance(index, int) or not 1 <= index <= 20
    ):
        raise DownloadError("INVALID_MEDIA_URL")
    destination = folder / f"{index:02d}-{asset_id}.png"
    if destination.is_symlink():
        raise DownloadError("INVALID_MEDIA_DESTINATION")
    if destination.is_file():
        return
    opener = build_opener(NoRedirect())
    with opener.open(entry["url"], timeout=45) as response:
        if response.headers.get_content_type() != "image/png":
            raise DownloadError("INVALID_IMAGE_CONTENT")
        length = int(response.headers.get("Content-Length", "0"))
        if length > MAX_IMAGE_BYTES or response.read(len(PNG_HEADER)) != PNG_HEADER:
            raise DownloadError("INVALID_IMAGE_CONTENT")
        with tempfile.NamedTemporaryFile(dir=folder, suffix=".part", delete=False) as output:
            temporary = Path(output.name)
            try:
                output.write(PNG_HEADER)
                tail = b""
                while chunk := response.read(128 * 1024):
                    if output.tell() + len(chunk) > MAX_IMAGE_BYTES:
                        raise DownloadError("IMAGE_TOO_LARGE")
                    output.write(chunk)
                    tail = (tail + chunk)[-len(PNG_END):]
                if tail != PNG_END or (length and output.tell() != length):
                    raise DownloadError("IMAGE_INCOMPLETE")
                output.close()
                os.replace(temporary, destination)
            finally:
                temporary.unlink(missing_ok=True)


def try_image(entry, folder, media_origin):
    """允许同套的其他图片在个别下载失败时继续保存。"""
    try:
        save_image(entry, folder, media_origin)
        return True
    except (DownloadError, OSError, ValueError, KeyError, TypeError):
        return False


def download_task(ticket, folder, media_origin):
    """终态后并行保存原图，临时失败时续取清单并跳过已下载文件。"""
    deadline = ticket["expiresAt"] / 1000
    task_id = ticket["taskId"]
    write_status(folder, task_id, "waiting")
    try:
        for attempt in range(2):
            manifest = wait_for_manifest(ticket, deadline)
            entries = manifest["files"]
            if not isinstance(entries, list) or len(entries) > 20:
                raise DownloadError("INVALID_DOWNLOAD_MANIFEST")
            with ThreadPoolExecutor(max_workers=3) as pool:
                saved = sum(pool.map(lambda entry: try_image(entry, folder, media_origin), entries))
            if saved == len(entries) or attempt == 1:
                break
            time.sleep(2)
        status = manifest["status"]
        state = "saved" if saved and saved == len(entries) else status
        if saved != len(entries):
            state = "download_incomplete"
        write_status(folder, task_id, state, taskStatus=status, saved=saved, available=len(entries))
        return 0 if saved and saved == len(entries) else 1
    except (DownloadError, OSError, ValueError, KeyError, TypeError) as error:
        code = str(error) if isinstance(error, DownloadError) else "TASK_DOWNLOAD_FAILED"
        write_status(folder, task_id, "failed", code=code)
        return 1


def launch(args, ticket):
    """启动独立下载进程，凭证通过标准输入交接且不写入文件。"""
    options = {"creationflags": subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session": True}
    process = subprocess.Popen(
        [sys.executable, str(Path(__file__).resolve()), str(args.folder.expanduser().resolve()), "--base-url", args.base_url, "--media-origin", args.media_origin, "--foreground"],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        **options,
    )
    with process.stdin as request:
        request.write(json.dumps(ticket).encode("utf-8"))
    return process.pid


def main():
    """授权后启动本机任务，前台模式也用于验证和受控运行。"""
    parser = argparse.ArgumentParser()
    parser.add_argument("folder", type=Path)
    parser.add_argument("--base-url", default="https://lycobo.com")
    parser.add_argument("--media-origin", default="https://media.lycobo.com")
    parser.add_argument("--foreground", action="store_true")
    args = parser.parse_args()
    try:
        ticket = json.load(sys.stdin)
        identifier = validate_ticket(ticket, trusted_origin(args.base_url))
        media_origin = trusted_origin(args.media_origin)
        if args.foreground:
            return download_task(ticket, task_folder(args.folder, identifier), media_origin)
        destination = task_folder(args.folder, identifier)
        print(json.dumps({"status": "started", "taskId": ticket["taskId"], "folder": str(destination), "pid": launch(args, ticket)}))
        return 0
    except DownloadError as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
    except (OSError, ValueError, KeyError, TypeError):
        print(json.dumps({"error": "AUTOMATIC_DOWNLOAD_UNAVAILABLE"}), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
