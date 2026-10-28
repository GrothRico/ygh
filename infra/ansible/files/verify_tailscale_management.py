#!/usr/bin/env python3
"""Fail closed unless this fresh SSH session is the configured Tailscale SSH path."""

from __future__ import annotations

import ipaddress
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


def verified_tailscale_path(
    ssh_connection: str,
    status: dict[str, Any],
    preferences: dict[str, Any],
    interface_exists: bool,
    login_user: str,
    expected_user: str,
) -> bool:
    """Check current SSH endpoints against live local Tailscale peers and settings."""
    parts = ssh_connection.split()
    if (
        len(parts) != 4
        or parts[3] != "22"
        or login_user != expected_user
        or not interface_exists
    ):
        return False

    try:
        client_ip = ipaddress.ip_address(parts[0])
        server_ip = ipaddress.ip_address(parts[2])
        local_ips = {
            ipaddress.ip_address(value)
            for value in status["Self"]["TailscaleIPs"]
        }
        peer_ips = {
            ipaddress.ip_address(value)
            for peer in status.get("Peer", {}).values()
            for value in peer.get("TailscaleIPs", [])
        }
    except (KeyError, TypeError, ValueError):
        return False

    return (
        client_ip in peer_ips
        and server_ip in local_ips
        and status.get("BackendState") == "Running"
        and preferences.get("RunSSH") is True
    )


def verify_live() -> bool:
    status = json.loads(
        subprocess.check_output(["tailscale", "status", "--json"], text=True)
    )
    preferences = json.loads(
        subprocess.check_output(["tailscale", "debug", "prefs"], text=True)
    )
    login_user = subprocess.check_output(["id", "-un"], text=True).strip()
    return verified_tailscale_path(
        os.environ.get("SSH_CONNECTION", ""),
        status,
        preferences,
        Path("/sys/class/net/tailscale0").exists(),
        login_user,
        "deploy",
    )


if __name__ == "__main__":
    try:
        valid = verify_live()
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError):
        valid = False
    print("tailscale-ssh-path-ok" if valid else "management-path-unverified")
    sys.exit(0 if valid else 1)
