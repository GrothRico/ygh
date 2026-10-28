import json
import subprocess
import unittest
from unittest.mock import patch

from verify_tailscale_serve import InvalidServeState, validate_serve_config, verify_with_cli


class VerifyServeConfigTests(unittest.TestCase):
    def setUp(self):
        self.dns_name = "ygh.example-tailnet.ts.net."
        # Shape matches Tailscale's serve_background fixture in serve_v2_test.go.
        self.route = {
            "TCP": {"443": {"HTTPS": True}},
            "Web": {
                "ygh.example-tailnet.ts.net:443": {
                    "Handlers": {"/": {"Proxy": "http://127.0.0.1:3000"}},
                }
            },
            "Services": {},
            "AllowFunnel": {},
            "Foreground": {},
        }

    def test_empty_state_is_allowed_for_first_configuration(self):
        self.assertEqual(validate_serve_config({}, self.dns_name), "empty")

    def test_nil_serve_config_is_empty_on_a_fresh_node(self):
        self.assertEqual(validate_serve_config(None, self.dns_name), "empty")

    def test_exact_private_https_route_is_ready(self):
        self.assertEqual(validate_serve_config(self.route, self.dns_name), "ready")

    def test_funnel_permission_is_rejected(self):
        self.route["AllowFunnel"] = {"ygh.example-tailnet.ts.net:443": True}
        with self.assertRaises(InvalidServeState):
            validate_serve_config(self.route, self.dns_name)

    def test_extra_tcp_port_is_rejected(self):
        self.route["TCP"]["22"] = {"HTTPS": False}
        with self.assertRaises(InvalidServeState):
            validate_serve_config(self.route, self.dns_name)

    def test_extra_web_handler_is_rejected(self):
        self.route["Web"]["ygh.example-tailnet.ts.net:443"]["Handlers"]["/debug"] = {
            "Proxy": "http://127.0.0.1:3000"
        }
        with self.assertRaises(InvalidServeState):
            validate_serve_config(self.route, self.dns_name)

    def test_wrong_upstream_is_rejected(self):
        self.route["Web"]["ygh.example-tailnet.ts.net:443"]["Handlers"]["/"]["Proxy"] = (
            "http://127.0.0.1:3001"
        )
        with self.assertRaises(InvalidServeState):
            validate_serve_config(self.route, self.dns_name)

    def test_unknown_configuration_key_is_rejected(self):
        self.route["Public"] = {"enabled": True}
        with self.assertRaises(InvalidServeState):
            validate_serve_config(self.route, self.dns_name)

    def test_cli_handles_fresh_and_already_configured_nodes(self):
        status = {"BackendState": "Running", "Self": {"DNSName": self.dns_name}}
        for config, expected in [(None, "empty"), ({}, "empty"), (self.route, "ready")]:
            with self.subTest(expected=expected, config=config):
                responses = [subprocess.CompletedProcess([], 0, json.dumps(v))
                             for v in [status, config, config]]
                with patch("verify_tailscale_serve.subprocess.run", side_effect=responses):
                    self.assertEqual(verify_with_cli(), expected)

    def test_cli_does_not_treat_missing_identity_as_empty_config(self):
        with patch("verify_tailscale_serve.subprocess.run",
                   return_value=subprocess.CompletedProcess([], 0, "null")):
            with self.assertRaises(InvalidServeState):
                verify_with_cli()

    def test_additional_service_or_foreground_config_is_rejected(self):
        for key in ["Services", "Foreground"]:
            with self.subTest(key=key):
                config = {**self.route, key: {"extra": {"TCP": {"80": {"HTTP": True}}}}}
                with self.assertRaises(InvalidServeState):
                    validate_serve_config(config, self.dns_name)


if __name__ == "__main__":
    unittest.main()
