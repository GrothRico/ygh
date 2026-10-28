#!/usr/bin/env python3
"""Fail closed unless Tailscale Serve is empty or the exact private YGH route."""

import json
import subprocess
import sys
from typing import Any


ALLOWED_TOP_LEVEL = {"TCP", "Web", "Services", "AllowFunnel", "Foreground"}
EXPECTED_PROXY = "http://127.0.0.1:3000"
EXPECTED_TCP = {"443": {"HTTPS": True}}


class InvalidServeState(ValueError):
    pass


def command_json(*argv: str, allow_empty: bool = False) -> dict[str, Any]:
    completed = subprocess.run(argv, check=True, capture_output=True, text=True)
    value = json.loads(completed.stdout)
    # Tailscale marshals a nil ServeConfig as JSON null on a fresh node.
    if value is None and allow_empty:
        return {}
    if not isinstance(value, dict):
        raise InvalidServeState
    return value


def funnel_is_disabled(value: Any) -> bool:
    if value is None or value is False or value == {}:
        return True
    if isinstance(value, dict):
        return all(item is False for item in value.values())
    return False


def validate_serve_config(config: dict[str, Any] | None, dns_name: str) -> str:
    if config is None:
        config = {}
    if set(config) - ALLOWED_TOP_LEVEL:
        raise InvalidServeState
    if not funnel_is_disabled(config.get("AllowFunnel")):
        raise InvalidServeState

    tcp = config.get("TCP", {})
    services = config.get("Services", {})
    foreground = config.get("Foreground", {})
    web = config.get("Web", {})
    if services not in ({}, None):
        raise InvalidServeState
    if foreground not in ({}, None, False):
        raise InvalidServeState

    if tcp in ({}, None) and web in ({}, None):
        return "empty"
    if tcp != EXPECTED_TCP:
        raise InvalidServeState
    if not isinstance(web, dict) or len(web) != 1:
        raise InvalidServeState

    expected_host = f"{dns_name.removesuffix('.')}:443"
    host_config = web.get(expected_host)
    if not isinstance(host_config, dict):
        raise InvalidServeState
    if set(host_config) - {"Handlers"}:
        raise InvalidServeState
    if host_config.get("Handlers") != {"/": {"Proxy": EXPECTED_PROXY}}:
        raise InvalidServeState
    return "ready"


def verify_with_cli() -> str:
    status = command_json("tailscale", "status", "--json")
    self_status = status.get("Self")
    if not isinstance(self_status, dict) or not isinstance(self_status.get("DNSName"), str):
        raise InvalidServeState
    dns_name = self_status["DNSName"]
    if status.get("BackendState") != "Running" or not dns_name.rstrip(".").endswith(".ts.net"):
        raise InvalidServeState

    serve_config = command_json("tailscale", "serve", "status", "--json", allow_empty=True)
    funnel_config = command_json("tailscale", "funnel", "status", "--json", allow_empty=True)
    serve_state = validate_serve_config(serve_config, dns_name)
    if validate_serve_config(funnel_config, dns_name) != serve_state:
        raise InvalidServeState
    return serve_state


def main() -> int:
    try:
        print(verify_with_cli())
        return 0
    except (InvalidServeState, json.JSONDecodeError, subprocess.SubprocessError, OSError):
        print(
            "Tailscale Serve/Funnel state is unknown or outside the approved private HTTPS route.",
            file=sys.stderr,
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
