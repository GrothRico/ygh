import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).parents[1] / "infra/ansible/files/ygh_restore_check.py"
SPEC = importlib.util.spec_from_file_location("ygh_restore_check", SCRIPT)
assert SPEC and SPEC.loader
restore_check = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(restore_check)

IMAGE_ID = "sha256:" + "a" * 64
SNAPSHOT_ID = "b" * 64


class RestoreCheckTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory(prefix="ygh-p112-restore-", dir="/tmp")
        self.root = Path(self.temporary_directory.name)
        self.target = self.root / "restore-target"
        self.target.mkdir(mode=0o700)
        self.addCleanup(self.temporary_directory.cleanup)

    def test_target_must_be_empty_absolute_and_under_an_isolated_root(self):
        self.assertEqual(restore_check.checked_target(str(self.target)), self.target.resolve())
        with self.assertRaisesRegex(restore_check.RestoreError, "empty directory"):
            (self.target / "existing.txt").write_text("synthetic")
            restore_check.checked_target(str(self.target))

        with self.assertRaisesRegex(restore_check.RestoreError, "absolute"):
            restore_check.checked_target("relative/restore")
        with self.assertRaisesRegex(restore_check.RestoreError, "parent-directory"):
            restore_check.checked_target(str(self.root / ".." / "outside"))
        with self.assertRaisesRegex(restore_check.RestoreError, "dedicated path"):
            restore_check.checked_target("/etc/ygh/restore")

    def test_target_symlink_is_rejected(self):
        link = self.root / "restore-link"
        link.symlink_to(self.target, target_is_directory=True)
        with self.assertRaisesRegex(restore_check.RestoreError, "symbolic links"):
            restore_check.checked_target(str(link))

    def test_restore_uses_readonly_no_lock_path_and_never_starts_app(self):
        app_directory = self.target / restore_check.APP_BACKUP_PATH
        app_directory.mkdir(parents=True)
        (app_directory / "manifest.json").write_text(json.dumps({"imageId": IMAGE_ID}), encoding="utf-8")
        verifier = self.root / "restore-verify.ts"
        verifier.write_text("// synthetic read-only verifier", encoding="utf-8")
        calls = []

        def run(arguments, **kwargs):
            calls.append(arguments)
            if arguments[:3] == [restore_check.RESTIC_BIN, "--no-lock", "restore"]:
                return subprocess.CompletedProcess(arguments, 0, "", "")
            if arguments[:3] == [restore_check.DOCKER_BIN, "image", "inspect"]:
                return subprocess.CompletedProcess(arguments, 0, IMAGE_ID + "\n", "")
            return subprocess.CompletedProcess(arguments, 0, "", "")

        output = io.StringIO()
        with patch.object(restore_check, "VERIFY_SCRIPT", verifier), patch.object(restore_check, "run_silent", side_effect=run), contextlib.redirect_stdout(output):
            restore_check.verify_under_lock(SNAPSHOT_ID, self.target)

        self.assertIn("--no-lock", calls[0])
        self.assertNotIn("--fail", calls[0])
        docker_run = calls[2]
        self.assertIn("--network", docker_run)
        self.assertIn("none", docker_run)
        self.assertIn("--read-only", docker_run)
        self.assertIn("--cap-drop", docker_run)
        self.assertIn("ALL", docker_run)
        self.assertIn("DAC_READ_SEARCH", docker_run)
        self.assertEqual(docker_run[-2:], ["/app/scripts/restore-verify.ts", "/restore"])
        self.assertNotIn("RESTIC_PASSWORD", output.getvalue())

    def test_missing_exact_image_fails_without_running_a_container(self):
        app_directory = self.target / restore_check.APP_BACKUP_PATH
        app_directory.mkdir(parents=True)
        (app_directory / "manifest.json").write_text(json.dumps({"imageId": IMAGE_ID}), encoding="utf-8")
        calls = []

        def run(arguments, **kwargs):
            calls.append(arguments)
            if arguments[:3] == [restore_check.RESTIC_BIN, "--no-lock", "restore"]:
                return subprocess.CompletedProcess(arguments, 0, "", "")
            return subprocess.CompletedProcess(arguments, 1, "", "image unavailable")

        with patch.object(restore_check, "run_silent", side_effect=run):
            with self.assertRaisesRegex(restore_check.RestoreError, "unavailable locally"):
                restore_check.verify_under_lock(SNAPSHOT_ID, self.target)
        self.assertEqual(len(calls), 2)

    def test_main_hides_unexpected_subprocess_and_filesystem_errors(self):
        secret = "synthetic-secret-marker"
        output = io.StringIO()
        with patch.object(restore_check.sys, "argv", ["ygh-restore-check", "--snapshot", SNAPSHOT_ID, "--target", str(self.target)]), patch.object(
            restore_check, "verify_snapshot", side_effect=OSError(secret)
        ), contextlib.redirect_stderr(output):
            self.assertEqual(restore_check.main(), 1)
        self.assertNotIn(secret, output.getvalue())


if __name__ == "__main__":
    unittest.main()
