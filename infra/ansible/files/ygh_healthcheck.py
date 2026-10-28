#!/usr/bin/env python3
"""Send private Healthchecks.io signals and check app liveness/free space."""

import os
from pathlib import Path
import re
import shutil
import sys
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

HEALTHCHECK_URL_PATTERN = re.compile(
    r"^https://hc-ping[.]com/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)
LOW_SPACE_BYTES = 8 * 1024**3
CRITICAL_SPACE_BYTES = 4 * 1024**3
LIVENESS_URL = "http://127.0.0.1:3000/api/health/live"
STATE_FILE = Path("/var/lib/ygh/monitoring/low-space-count")


class NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(self, request, file, code, message, headers, new_url):
        return None


def healthcheck_url(value: str) -> str | None:
    return value if HEALTHCHECK_URL_PATTERN.fullmatch(value) else None


def send_ping(value: str, *, fail: bool = False) -> bool:
    try:
        url = healthcheck_url(value)
        if url is None:
            return False
        if fail:
            url += "/fail"
        request = Request(url, method="GET")
        with build_opener(ProxyHandler({}), NoRedirectHandler()).open(request, timeout=5) as response:
            return response.status == 200
    except (HTTPError, URLError, TimeoutError, OSError):
        return False


def backup_result_successful() -> bool:
    return (
        os.environ.get("SERVICE_RESULT") == "success"
        and os.environ.get("EXIT_CODE") == "exited"
        and os.environ.get("EXIT_STATUS") == "0"
    )


def backup_check() -> int:
    url = os.environ.get("YGH_BACKUP_HEALTHCHECK_URL", "")
    success = backup_result_successful()
    delivered = send_ping(url, fail=not success)
    if success and delivered:
        return 0
    print("Backup heartbeat delivery failed or the backup service reported an error.", file=sys.stderr)
    return 1


def app_is_live() -> bool:
    try:
        request = Request(LIVENESS_URL, method="GET")
        with build_opener(ProxyHandler({}), NoRedirectHandler()).open(request, timeout=5) as response:
            return response.status == 204 and response.headers.get("Cache-Control") == "no-store"
    except (HTTPError, URLError, TimeoutError, OSError):
        return False


def prior_low_space_count() -> int | None:
    try:
        value = STATE_FILE.read_text(encoding="ascii").strip()
        return int(value) if value in {"0", "1", "2"} else None
    except FileNotFoundError:
        return 0
    except (OSError, ValueError):
        return None


def set_low_space_count(value: int) -> None:
    STATE_FILE.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    temporary = STATE_FILE.with_suffix(".tmp")
    temporary.write_text(f"{value}\n", encoding="ascii")
    temporary.chmod(0o600)
    temporary.replace(STATE_FILE)


def host_check() -> int:
    url = os.environ.get("YGH_HOST_HEALTHCHECK_URL", "")
    free_bytes = shutil.disk_usage("/").free
    live = app_is_live()

    state_write_succeeded = True
    if free_bytes < CRITICAL_SPACE_BYTES:
        try:
            set_low_space_count(2)
        except OSError:
            state_write_succeeded = False
        healthy = False
    elif free_bytes < LOW_SPACE_BYTES:
        previous_count = prior_low_space_count()
        if previous_count is None:
            state_write_succeeded = False
            previous_count = 1
        low_count = min(previous_count + 1, 2)
        try:
            set_low_space_count(low_count)
        except OSError:
            state_write_succeeded = False
        healthy = low_count < 2
    else:
        try:
            set_low_space_count(0)
        except OSError:
            state_write_succeeded = False
        healthy = True

    if not healthy or not state_write_succeeded:
        if send_ping(url, fail=True):
            print("Host free-space check reported a failure.", file=sys.stderr)
            return 1
        print("Host check failed and its alarm signal could not be delivered.", file=sys.stderr)
        return 1

    if not live:
        print("Host liveness check failed; heartbeat was withheld.", file=sys.stderr)
        return 1

    # The first low-space sample remains silent so the external grace period can apply.
    if free_bytes < LOW_SPACE_BYTES:
        return 0
    if send_ping(url):
        return 0
    print("Host heartbeat delivery failed.", file=sys.stderr)
    return 1


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] not in {"backup", "host"}:
        print("Expected check type: backup or host.", file=sys.stderr)
        return 2
    try:
        return backup_check() if sys.argv[1] == "backup" else host_check()
    except Exception:
        print("Healthcheck operation failed; no sensitive details were logged.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
