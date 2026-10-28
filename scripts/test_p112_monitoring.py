import contextlib
import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).parents[1] / "infra/ansible/files/ygh_healthcheck.py"
SPEC = importlib.util.spec_from_file_location("ygh_healthcheck", SCRIPT)
assert SPEC and SPEC.loader
healthcheck = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(healthcheck)

BACKUP_URL = "https://hc-ping.com/11111111-1111-4111-8111-111111111111"
HOST_URL = "https://hc-ping.com/22222222-2222-4222-8222-222222222222"


class HealthcheckTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory(prefix="ygh-p112-monitor-")
        self.state_path = Path(self.temporary_directory.name) / "low-space-count"
        self.state_patch = patch.object(healthcheck, "STATE_FILE", self.state_path)
        self.state_patch.start()
        self.addCleanup(self.state_patch.stop)
        self.addCleanup(self.temporary_directory.cleanup)

    def test_url_validation_rejects_non_healthchecks_hosts_and_redirect_urls(self):
        self.assertEqual(healthcheck.healthcheck_url(BACKUP_URL), BACKUP_URL)
        self.assertIsNone(healthcheck.healthcheck_url("https://other.example/11111111-1111-4111-8111-111111111111"))
        self.assertIsNone(healthcheck.healthcheck_url(BACKUP_URL + "?token=extra"))

    def test_failure_ping_uses_fail_endpoint_without_proxy_or_redirect_handlers(self):
        class Response:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *_):
                return None

        class Opener:
            def open(self, request, timeout):
                self.url = request.full_url
                self.timeout = timeout
                return Response()

        opener = Opener()
        with patch.object(healthcheck, "build_opener", return_value=opener) as build_opener:
            self.assertTrue(healthcheck.send_ping(BACKUP_URL, fail=True))
        self.assertEqual(opener.url, BACKUP_URL + "/fail")
        self.assertEqual(opener.timeout, 5)
        handlers = build_opener.call_args.args
        self.assertTrue(any(isinstance(handler, healthcheck.ProxyHandler) for handler in handlers))
        self.assertTrue(any(isinstance(handler, healthcheck.NoRedirectHandler) for handler in handlers))

    def test_backup_success_ping_requires_complete_success_result(self):
        with patch.dict(
            "os.environ",
            {
                "YGH_BACKUP_HEALTHCHECK_URL": BACKUP_URL,
                "SERVICE_RESULT": "success",
                "EXIT_CODE": "exited",
                "EXIT_STATUS": "0",
            },
            clear=True,
        ), patch.object(healthcheck, "send_ping", return_value=True) as send_ping:
            self.assertEqual(healthcheck.backup_check(), 0)
            send_ping.assert_called_once_with(BACKUP_URL, fail=False)

        with patch.dict(
            "os.environ",
            {
                "YGH_BACKUP_HEALTHCHECK_URL": BACKUP_URL,
                "SERVICE_RESULT": "timeout",
                "EXIT_CODE": "killed",
                "EXIT_STATUS": "TERM",
            },
            clear=True,
        ), patch.object(healthcheck, "send_ping", return_value=True) as send_ping:
            self.assertEqual(healthcheck.backup_check(), 1)
            send_ping.assert_called_once_with(BACKUP_URL, fail=True)

    def test_first_low_space_sample_sends_no_success_or_failure_ping(self):
        with patch.dict("os.environ", {"YGH_HOST_HEALTHCHECK_URL": HOST_URL}, clear=True), patch.object(
            healthcheck, "app_is_live", return_value=True
        ), patch.object(healthcheck.shutil, "disk_usage", return_value=type("Usage", (), {"free": 7 * 1024**3})()), patch.object(
            healthcheck, "send_ping"
        ) as send_ping:
            self.assertEqual(healthcheck.host_check(), 0)
            send_ping.assert_not_called()
            self.assertEqual(self.state_path.read_text(encoding="ascii"), "1\n")

    def test_second_low_space_sample_and_critical_space_send_failure(self):
        self.state_path.write_text("1\n", encoding="ascii")
        with patch.dict("os.environ", {"YGH_HOST_HEALTHCHECK_URL": HOST_URL}, clear=True), patch.object(
            healthcheck, "app_is_live", return_value=True
        ), patch.object(healthcheck.shutil, "disk_usage", return_value=type("Usage", (), {"free": 7 * 1024**3})()), patch.object(
            healthcheck, "send_ping", return_value=True
        ) as send_ping:
            self.assertEqual(healthcheck.host_check(), 1)
            send_ping.assert_called_once_with(HOST_URL, fail=True)

        with patch.dict("os.environ", {"YGH_HOST_HEALTHCHECK_URL": HOST_URL}, clear=True), patch.object(
            healthcheck, "app_is_live", return_value=True
        ), patch.object(healthcheck.shutil, "disk_usage", return_value=type("Usage", (), {"free": 3 * 1024**3})()), patch.object(
            healthcheck, "send_ping", return_value=True
        ) as send_ping:
            self.assertEqual(healthcheck.host_check(), 1)
            send_ping.assert_called_once_with(HOST_URL, fail=True)

    def test_app_failure_withholds_heartbeat_and_does_not_send_failure_ping(self):
        output = io.StringIO()
        with patch.dict("os.environ", {"YGH_HOST_HEALTHCHECK_URL": HOST_URL}, clear=True), patch.object(
            healthcheck, "app_is_live", return_value=False
        ), patch.object(healthcheck.shutil, "disk_usage", return_value=type("Usage", (), {"free": 20 * 1024**3})()), patch.object(
            healthcheck, "send_ping"
        ) as send_ping, contextlib.redirect_stderr(output):
            self.assertEqual(healthcheck.host_check(), 1)
            send_ping.assert_not_called()
        self.assertNotIn("hc-ping", output.getvalue())

    def test_critical_space_sends_failure_even_when_app_is_down(self):
        with patch.dict("os.environ", {"YGH_HOST_HEALTHCHECK_URL": HOST_URL}, clear=True), patch.object(
            healthcheck, "app_is_live", return_value=False
        ), patch.object(healthcheck.shutil, "disk_usage", return_value=type("Usage", (), {"free": 3 * 1024**3})()), patch.object(
            healthcheck, "send_ping", return_value=True
        ) as send_ping:
            self.assertEqual(healthcheck.host_check(), 1)
            send_ping.assert_called_once_with(HOST_URL, fail=True)

    def test_second_low_space_sample_sends_failure_even_when_app_is_down(self):
        self.state_path.write_text("1\n", encoding="ascii")
        with patch.dict("os.environ", {"YGH_HOST_HEALTHCHECK_URL": HOST_URL}, clear=True), patch.object(
            healthcheck, "app_is_live", return_value=False
        ), patch.object(healthcheck.shutil, "disk_usage", return_value=type("Usage", (), {"free": 7 * 1024**3})()), patch.object(
            healthcheck, "send_ping", return_value=True
        ) as send_ping:
            self.assertEqual(healthcheck.host_check(), 1)
            send_ping.assert_called_once_with(HOST_URL, fail=True)

    def test_low_space_failure_is_sent_even_when_state_file_cannot_be_written(self):
        with patch.dict("os.environ", {"YGH_HOST_HEALTHCHECK_URL": HOST_URL}, clear=True), patch.object(
            healthcheck, "app_is_live", return_value=True
        ), patch.object(healthcheck.shutil, "disk_usage", return_value=type("Usage", (), {"free": 3 * 1024**3})()), patch.object(
            healthcheck, "set_low_space_count", side_effect=OSError("private path detail")
        ), patch.object(healthcheck, "send_ping", return_value=True) as send_ping:
            self.assertEqual(healthcheck.host_check(), 1)
            send_ping.assert_called_once_with(HOST_URL, fail=True)

    def test_malformed_ping_url_does_not_appear_in_error_output(self):
        secret = "not-a-valid-url-with-secret-marker"
        output = io.StringIO()
        with patch.dict(
            "os.environ",
            {
                "YGH_BACKUP_HEALTHCHECK_URL": f"https://hc-ping.com/{secret}",
                "SERVICE_RESULT": "success",
                "EXIT_CODE": "exited",
                "EXIT_STATUS": "0",
            },
            clear=True,
        ), contextlib.redirect_stderr(output):
            self.assertEqual(healthcheck.backup_check(), 1)
        self.assertNotIn(secret, output.getvalue())


if __name__ == "__main__":
    unittest.main()
