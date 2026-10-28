#!/usr/bin/env python3
"""Restore one Restic app snapshot into a new isolated directory and verify it read-only."""

import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import subprocess
import sys

RESTIC_BIN = os.environ.get("YGH_RESTIC_BIN", "/usr/bin/restic")
DOCKER_BIN = os.environ.get("YGH_DOCKER_BIN", "/usr/bin/docker")
VERIFY_SCRIPT = Path(os.environ.get("YGH_RESTORE_VERIFY_SCRIPT", "/usr/local/lib/ygh/restore-verify.ts"))
MAINTENANCE_LOCK = Path(os.environ.get("YGH_MAINTENANCE_LOCK", "/run/lock/ygh-maintenance.lock"))
RESTORES_ROOT = Path("/var/lib/ygh/restores")
APP_BACKUP_PATH = Path("var/lib/ygh/backups/staging/app")
IMAGE_ID_PATTERN = re.compile(r"^sha256:[a-f0-9]{64}$")
SNAPSHOT_ID_PATTERN = re.compile(r"^[a-f0-9]{8,64}$")


class RestoreError(Exception):
    pass


def checked_target(raw_path: str) -> Path:
    path = Path(raw_path)
    if not path.is_absolute():
        raise RestoreError("Restore target must be an absolute path.")
    if ".." in path.parts:
        raise RestoreError("Restore target must not contain parent-directory segments.")

    temporary_root = Path("/tmp").resolve()
    allowed_roots = (temporary_root, RESTORES_ROOT)
    resolved = path.resolve(strict=False)
    if not any(resolved != root and root in resolved.parents for root in allowed_roots):
        raise RestoreError("Restore target must be a dedicated path under /tmp or /var/lib/ygh/restores.")

    # Do not follow a path assembled through a symlink, including an existing target.
    lexical = Path(os.path.abspath(path))
    for component in (lexical, *lexical.parents):
        if component == Path("/"):
            break
        if component == Path("/tmp") and Path("/tmp").is_symlink():
            continue
        if component.is_symlink():
            raise RestoreError("Restore target path must not contain symbolic links.")

    if path.exists():
        if not path.is_dir() or any(path.iterdir()):
            raise RestoreError("Restore target must be an empty directory; no files were changed.")
    parent = resolved.parent
    if not parent.is_dir():
        raise RestoreError("Restore target parent directory must already exist.")
    return resolved


def run_silent(
    arguments: list[str], *, env: dict[str, str] | None = None, capture_stdout: bool = False
) -> subprocess.CompletedProcess[str]:
    stdout = subprocess.PIPE if capture_stdout else subprocess.DEVNULL
    return subprocess.run(arguments, check=False, text=True, stdout=stdout, stderr=subprocess.DEVNULL, env=env)


def restored_app_directory(target: Path) -> Path:
    app_directory = target / APP_BACKUP_PATH
    manifest = app_directory / "manifest.json"
    if not app_directory.is_dir() or not manifest.is_file() or manifest.is_symlink():
        raise RestoreError("Restored app backup or manifest is missing; the target was retained for inspection.")
    return app_directory


def verify_snapshot(snapshot_id: str, raw_target: str) -> None:
    if not SNAPSHOT_ID_PATTERN.fullmatch(snapshot_id):
        raise RestoreError("Snapshot ID must be a hexadecimal Restic snapshot ID.")
    repository = os.environ.get("RESTIC_REPOSITORY")
    password = os.environ.get("RESTIC_PASSWORD")
    if not repository or not password:
        raise RestoreError("Restic repository credentials are unavailable in the service environment.")

    target = checked_target(raw_target)
    target.mkdir(mode=0o700, exist_ok=True)
    target.chmod(0o700)
    if not os.environ.get("AWS_ACCESS_KEY_ID") or not os.environ.get("AWS_SECRET_ACCESS_KEY"):
        raise RestoreError("Restic read-only repository credentials are unavailable in the service environment.")

    if not MAINTENANCE_LOCK.parent.is_dir():
        raise RestoreError("The local maintenance lock directory is unavailable.")
    with MAINTENANCE_LOCK.open("a", encoding="ascii") as lock_file:
        try:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RestoreError("Another local backup or deployment holds the maintenance lock.") from None
        verify_under_lock(snapshot_id, target)


def verify_under_lock(snapshot_id: str, target: Path) -> None:
    restore = run_silent(
        [RESTIC_BIN, "--no-lock", "restore", snapshot_id, "--tag", "ygh-app", "--target", str(target)]
    )
    if restore.returncode != 0:
        raise RestoreError("Restic restore failed; the target was retained and was not cleaned automatically.")

    app_directory = restored_app_directory(target)
    try:
        manifest = json.loads((app_directory / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        raise RestoreError("Restored manifest is unreadable; the target was retained for inspection.") from None
    image_id = manifest.get("imageId") if isinstance(manifest, dict) else None
    if not isinstance(image_id, str) or not IMAGE_ID_PATTERN.fullmatch(image_id):
        raise RestoreError("Restored manifest has no valid immutable app image ID; the target was retained.")

    image = run_silent(
        [DOCKER_BIN, "image", "inspect", "--format", "{{.Id}}", image_id], capture_stdout=True
    )
    if image.returncode != 0 or image.stdout.strip() != image_id:
        raise RestoreError("The exact app image from the manifest is unavailable locally; no application was started.")
    if not VERIFY_SCRIPT.is_file():
        raise RestoreError("The read-only restore verifier is missing; the target was retained for inspection.")

    command = [
        DOCKER_BIN,
        "run",
        "--rm",
        "--network",
        "none",
        "--read-only",
        "--tmpfs",
        "/tmp:rw,nosuid,nodev,noexec,size=16m",
        "--user",
        "0:0",
        "--cap-drop",
        "ALL",
        "--cap-add",
        "DAC_READ_SEARCH",
        "--security-opt",
        "no-new-privileges:true",
        "--mount",
        f"type=bind,src={target},dst=/restore,readonly",
        "--mount",
        f"type=bind,src={VERIFY_SCRIPT},dst=/app/scripts/restore-verify.ts,readonly",
        "--env",
        f"YGH_RESTORE_IMAGE_ID={image_id}",
        "--entrypoint",
        "node",
        image_id,
        "--experimental-strip-types",
        "/app/scripts/restore-verify.ts",
        "/restore",
    ]
    checked = run_silent(command)
    if checked.returncode != 0:
        raise RestoreError("Read-only version, migration, SQLite, or import verification failed; target retained.")

    print(f"Restore verification passed for snapshot {snapshot_id} and image {image_id}.")
    print(f"Isolated files remain at {target}; inspect and remove this dedicated test directory manually.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", required=True, help="Hexadecimal Restic app snapshot ID")
    parser.add_argument("--target", required=True, help="New isolated absolute restore directory")
    arguments = parser.parse_args()
    try:
        verify_snapshot(arguments.snapshot, arguments.target)
    except RestoreError as error:
        print(str(error), file=sys.stderr)
        return 1
    except Exception:
        print("Restore check failed; sensitive details were omitted and the target was retained.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
