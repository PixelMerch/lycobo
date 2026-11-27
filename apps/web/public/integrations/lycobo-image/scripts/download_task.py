#!/usr/bin/env python3
"""在用户授权的目录中按任务批量下载原图，使用持久队列恢复未完成下载。"""

import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import plistlib
import re
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import UUID

DOWNLOAD_PATH = "/api/v1/enterprise/image-api/task-downloads"
MAX_IMAGE_BYTES = 32 * 1024 * 1024
MAX_BATCH = 20
MAX_PARALLEL = 3
TICKET_LIFETIME = 7 * 24 * 60 * 60
PNG_HEADER = b"\x89PNG\r\n\x1a\n"
PNG_END = b"\x00\x00\x00\x00IEND\xaeB\x60\x82"
PENDING = {"queued", "running"}
TERMINAL = {"succeeded", "partially_failed", "failed", "needs_reconciliation", "unavailable"}
LAUNCH_LABEL = "com.lycobo.task-downloads"


class DownloadError(Exception):
    """只报告短码，省略凭证及下载地址。"""


class NoRedirect(HTTPRedirectHandler):
    """授权凭证只发送给指定的 API 源站。"""

    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


def default_state():
    """返回跨技能更新保留的用户私有下载队列。"""
    if sys.platform == "darwin":
        return Path.home() / "Library/Application Support/Lycobo/Downloads"
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local"))
    else:
        base = Path(os.environ.get("XDG_STATE_HOME", Path.home() / ".local/state"))
    return base / "Lycobo/Downloads"


def trusted_origin(value):
    """常规下载使用 HTTPS，本地验证允许环回地址。"""
    url = urlsplit(value)
    loopback = url.hostname in {"localhost", "127.0.0.1", "::1", "cdn.lycobo.localhost"}
    if not url.hostname or url.username or url.password or url.query or url.fragment:
        raise DownloadError("INVALID_ORIGIN")
    if url.path not in {"", "/"} or (url.scheme != "https" and not (url.scheme == "http" and loopback)):
        raise DownloadError("INVALID_ORIGIN")
    return url.scheme, url.netloc


def validate_ticket(ticket, origin):
    """验证批次任务与固定源站，避免凭证发送到外部地址。"""
    url = urlsplit(ticket["downloadUrl"])
    if (url.scheme, url.netloc) != origin or url.path != DOWNLOAD_PATH or url.query or url.fragment:
        raise DownloadError("INVALID_DOWNLOAD_URL")
    if not isinstance(ticket["downloadToken"], str) or not 0 < len(ticket["downloadToken"]) <= 2000:
        raise DownloadError("INVALID_DOWNLOAD_TOKEN")
    expiry = ticket["expiresAt"] / 1000
    if expiry <= time.time() or expiry > time.time() + TICKET_LIFETIME + 60:
        raise DownloadError("EXPIRED_DOWNLOAD_TICKET")
    tasks = ticket["tasks"]
    if not isinstance(tasks, list) or not 1 <= len(tasks) <= MAX_BATCH:
        raise DownloadError("INVALID_TASK_BATCH")
    ids = [str(UUID(task["id"])) for task in tasks]
    if len(ids) != len(set(ids)):
        raise DownloadError("INVALID_TASK_BATCH")
    return ids


def task_folder(folder, identifier):
    """在用户授权的既有目录下建立单任务子目录。"""
    root = Path(folder).expanduser().resolve(strict=True)
    if not root.is_dir():
        raise DownloadError("FOLDER_UNAVAILABLE")
    destination = root / f"Lycobo-{identifier}"
    destination.mkdir(exist_ok=True)
    if destination.is_symlink() or not destination.is_dir():
        raise DownloadError("INVALID_TASK_FOLDER")
    return destination


def atomic_write(path, content):
    """以用户私有权限写入完整文件，避免进程中断留下半份记录。"""
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as output:
        temporary = Path(output.name)
        try:
            output.write(content)
            output.close()
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)


def save_record(path, value):
    """提交本机队列或进度记录。"""
    atomic_write(path, json.dumps(value).encode("utf-8"))


def task_status(job, state, **details):
    """进度文件只记录结果，下载凭证留在私有队列。"""
    folder = task_folder(job["folder"], job["identifier"])
    save_record(folder / ".lycobo-download.json", {
        "taskId": job["taskId"],
        "state": state,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        **details,
    })


def read_record(file):
    """忽略正在被另一个进程替换或移除的旧记录。"""
    try:
        return json.loads(file.read_text())
    except (OSError, ValueError):
        return None


def update_job(path, job, next_job=None):
    """新领凭证时不让旧进程覆盖更新。"""
    current = read_record(path)
    if current != job:
        return
    if next_job is None:
        path.unlink(missing_ok=True)
    else:
        save_record(path, next_job)


def enqueue(state, folder, ticket, media):
    """按任务 ID 保存工作项，重启后可按原目标目录接着下载。"""
    queue = state / "queue"
    queue.mkdir(mode=0o700, parents=True, exist_ok=True)
    root = folder.expanduser().resolve(strict=True)
    for task in ticket["tasks"]:
        task_id = str(UUID(task["id"]))
        number = task.get("publicId", "")
        identifier = number if re.fullmatch(r"[A-Z0-9]{9,10}", number) else task_id
        destination = task_folder(root, identifier)
        current = read_record(destination / ".lycobo-download.json")
        if current and current.get("taskId") == task_id and current.get("state") == "saved":
            continue
        job = {
            "taskId": task_id,
            "identifier": identifier,
            "folder": str(root),
            "media": list(media),
            "downloadUrl": ticket["downloadUrl"],
            "downloadToken": ticket["downloadToken"],
            "expiresAt": ticket["expiresAt"],
            "createdAt": time.time(),
            "nextAt": 0,
            "retries": 0,
        }
        task_status(job, "waiting")
        save_record(queue / (task_id + ".json"), job)


def batch_manifest(jobs):
    """同一凭证的一批待完成任务只发一次 HTTP 请求。"""
    first = jobs[0]
    request = Request(first["downloadUrl"], method="POST",
        data=json.dumps({"taskIds": [job["taskId"] for job in jobs]}).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + first["downloadToken"],
            "Content-Type": "application/json",
        },
    )
    opener = build_opener(NoRedirect())
    with opener.open(request, timeout=20) as response:
        manifest = json.loads(response.read(512 * 1024))["data"]
        entries = manifest["tasks"]
        if not isinstance(entries, list) or len(entries) != len(jobs):
            raise DownloadError("INVALID_DOWNLOAD_MANIFEST")
        return {entry["taskId"]: entry for entry in entries}, min(120, max(30, int(manifest.get("retryAfterSeconds", 60))))


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


def defer_job(path, job, delay, retries=None):
    """写入下一次查询时间，常规排队等待不反复读取接口。"""
    update_job(path, job, {
        **job,
        "nextAt": time.time() + delay,
        "retries": job["retries"] if retries is None else retries,
    })


def finish_job(path, job, state, **details):
    """写入保留给用户的状态并清除本机短期凭证。"""
    if read_record(path) != job:
        return
    try:
        task_status(job, state, **details)
    except (DownloadError, OSError):
        defer_job(path, job, 120)
        return
    update_job(path, job)


def handle_batch_error(group, error):
    """批量查询遇到暂时故障时统一退避。"""
    status = error.code if isinstance(error, HTTPError) else 0
    if isinstance(error, HTTPError):
        error.close()
    for path, job in group:
        if status in {400, 401, 403, 404}:
            finish_job(path, job, "failed", code=f"TASK_HTTP_{status}")
        else:
            defer_job(path, job, 120)


def queue_downloads(group, downloads, pool):
    """拆分待生成与已完成任务，把原图交给全局线程池。"""
    try:
        statuses, delay = batch_manifest([job for _, job in group])
    except (DownloadError, OSError, TypeError, ValueError, KeyError) as error:
        handle_batch_error(group, error)
        return
    for path, job in group:
        manifest = statuses.get(job["taskId"], {})
        state = manifest.get("status")
        if state in PENDING:
            # 很长时间仍未完成时降低查询频率，任务最终仍可在重启后恢复。
            defer_job(path, job, max(delay, 300) if time.time() - job["createdAt"] > 7200 else delay)
            continue
        files = manifest.get("files", [])
        if state not in TERMINAL or not isinstance(files, list) or len(files) > MAX_BATCH:
            finish_job(path, job, "failed", code="INVALID_DOWNLOAD_MANIFEST")
            continue
        folder = task_folder(job["folder"], job["identifier"])
        origin = tuple(job["media"])
        futures = [pool.submit(try_image, file, folder, origin) for file in files]
        downloads[path] = (job, state, futures)


def reconcile_downloads(downloads):
    """已完成任务马上确认，未完成任务保留在独立线程中。"""
    for path, (job, state, futures) in list(downloads.items()):
        if not all(future.done() for future in futures):
            continue
        del downloads[path]
        saved = sum(future.result() for future in futures)
        if saved != len(futures) and not job["retries"]:
            defer_job(path, job, 3, retries=1)
            continue
        outcome = state
        if saved != len(futures):
            outcome = "download_incomplete"
        elif saved:
            outcome = "saved"
        finish_job(path, job, outcome, taskStatus=state, saved=saved, available=len(futures))


def due_tasks(state, downloads):
    """收集当前可查任务，过期或损坏工作项不再请求服务器。"""
    groups = defaultdict(list)
    waiting = False
    for path in (state / "queue").glob("*.json"):
        if path in downloads:
            continue
        job = read_record(path)
        if not job:
            continue
        if job["nextAt"] > time.time():
            waiting = True
        elif job["expiresAt"] / 1000 <= time.time():
            finish_job(path, job, "failed", code="EXPIRED_DOWNLOAD_TICKET")
            waiting = path.exists() or waiting
        else:
            groups[(job["downloadUrl"], job["downloadToken"])].append((path, job))
    return groups, waiting


def acquire_worker_lock(file):
    """每台电脑的当前用户只运行一个下载进程。"""
    try:
        if os.name == "nt":
            import msvcrt
            msvcrt.locking(file.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        return True
    except OSError:
        return False


def work(state):
    """使用全局并发池为所有已授权任务服务，没有待办时退出。"""
    with (state / "worker.lock").open("ab") as lock:
        if not acquire_worker_lock(lock):
            return
        downloads = {}
        idle = False
        with ThreadPoolExecutor(max_workers=MAX_PARALLEL) as pool:
            while True:
                reconcile_downloads(downloads)
                groups, waiting = due_tasks(state, downloads)
                has_work = bool(groups or waiting or downloads)
                if not has_work and idle:
                    return
                idle = not has_work
                for group in groups.values():
                    try:
                        queue_downloads(group, downloads, pool)
                    except (DownloadError, OSError):
                        # 授权目录暂时离线时，保留队列供重新挂载后继续。
                        for path, job in group:
                            if path not in downloads:
                                defer_job(path, job, 120)
                time.sleep(1 if downloads or idle else 3)


def launch_command(state, script):
    """用同一条命令启动当前或登录恢复所需的工作进程。"""
    return [sys.executable, str(script), "--state-dir", str(state), "--worker"]


def register_login_worker(state):
    """在 macOS 用当前用户的 LaunchAgent 登录恢复，空队列不联网。"""
    if sys.platform != "darwin" or state != default_state().resolve():
        return False
    target = f"gui/{os.getuid()}"
    label = f"{target}/{LAUNCH_LABEL}"
    stable = state / "download_task.py"
    atomic_write(stable, Path(__file__).read_bytes())
    launch_dir = Path.home() / "Library/LaunchAgents"
    launch_dir.mkdir(parents=True, exist_ok=True)
    plist = launch_dir / f"{LAUNCH_LABEL}.plist"
    config = plistlib.dumps({
        "Label": LAUNCH_LABEL,
        "ProgramArguments": launch_command(state, stable),
        "RunAtLoad": True,
        "WatchPaths": [str(state / "queue")],
    })
    if not plist.is_file() or plist.read_bytes() != config:
        atomic_write(plist, config)
    quiet = {"stdout": subprocess.DEVNULL, "stderr": subprocess.DEVNULL, "timeout": 8}
    status = subprocess.run(["/bin/launchctl", "print", label], **quiet)
    if status.returncode:
        status = subprocess.run(["/bin/launchctl", "bootstrap", target, str(plist)], **quiet)
    return status.returncode == 0


def start_worker(state):
    """唤醒工作进程，登录注册失败时仍可完成本次下载。"""
    try:
        registered = register_login_worker(state)
    except (OSError, subprocess.SubprocessError):
        registered = False
    options = {"creationflags": subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session": True}
    subprocess.Popen(
        launch_command(state, Path(__file__).resolve()),
        stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        **options,
    )
    return registered


def main():
    """解析下载目录及批次，首次授权后自动登记本机恢复。"""
    parser = argparse.ArgumentParser()
    parser.add_argument("folder", type=Path, nargs="?")
    parser.add_argument("--base-url", default="https://lycobo.com")
    parser.add_argument("--media-origin", default="https://media.lycobo.com")
    parser.add_argument("--state-dir", type=Path, default=default_state())
    parser.add_argument("--worker", action="store_true")
    args = parser.parse_args()
    state = args.state_dir.expanduser().resolve()
    try:
        state.mkdir(mode=0o700, parents=True, exist_ok=True)
        if args.worker:
            work(state)
            return 0
        if args.folder is None:
            raise DownloadError("FOLDER_UNAVAILABLE")
        ticket = json.load(sys.stdin)
        ids = validate_ticket(ticket, trusted_origin(args.base_url))
        enqueue(state, args.folder, ticket, trusted_origin(args.media_origin))
        restart_resume = start_worker(state)
        print(json.dumps({"status": "started", "taskCount": len(ids), "restartResume": restart_resume}))
        return 0
    except DownloadError as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
    except (OSError, ValueError, KeyError, TypeError):
        print(json.dumps({"error": "AUTOMATIC_DOWNLOAD_UNAVAILABLE"}), file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
