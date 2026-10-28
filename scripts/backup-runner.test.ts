import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const runnerPath = join(process.cwd(), "infra/ansible/files/ygh-backup.sh");
const linuxIt = it.skipIf(process.platform !== "linux");

async function createHarness(): Promise<{ root: string; environment: NodeJS.ProcessEnv }> {
  const root = await mkdtemp(join(tmpdir(), "ygh-backup-runner-"));
  temporaryDirectories.push(root);
  const bins = join(root, "bin");
  await mkdir(bins);
  const dockerPath = join(bins, "docker");
  const resticPath = join(bins, "restic");
  const journalctlPath = join(bins, "journalctl");
  const statePath = join(root, "container-state");
  const callsPath = join(root, "calls.log");
  await writeFile(statePath, "true\n");
  await writeFile(dockerPath, `#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\\n' "$*" >>"$YGH_TEST_CALLS"
case "$1" in
  compose) printf '%s\\n' '0123456789ab' ;;
  inspect)
    if [[ "$2" == --format && "$3" == '{{.State.Running}}' ]]; then cat "$YGH_TEST_CONTAINER_STATE"
    else printf '%s\\n' "$(cat "$YGH_TEST_CONTAINER_STATE")|sha256:$(printf 'a%.0s' {1..64})|ygh-app-data"
    fi ;;
  stop) printf 'false\\n' >"$YGH_TEST_CONTAINER_STATE" ;;
  start)
    if [[ "\${YGH_TEST_FAIL_START:-false}" == true ]]; then exit 1; fi
    printf 'true\\n' >"$YGH_TEST_CONTAINER_STATE" ;;
  run)
    mode="\${!#}"
    if [[ "\${YGH_TEST_FAIL_DOCKER_MODE:-}" == "$mode" ]]; then exit 1; fi
    if [[ "$mode" == snapshot ]]; then
      : >"$YGH_BACKUP_STAGE_ROOT/app/collection.sqlite"
      : >"$YGH_BACKUP_STAGE_ROOT/app/.snapshot-info.json"
    elif [[ "$mode" == finalize ]]; then
      : >"$YGH_BACKUP_STAGE_ROOT/app/manifest.json"
    fi ;;
  *) exit 9 ;;
esac
`);
  await writeFile(resticPath, `#!/usr/bin/env bash
set -euo pipefail
printf 'restic %s\\n' "$*" >>"$YGH_TEST_CALLS"
[[ "$1" == --cache-dir ]] || exit 8
shift 2
command="$1"
if [[ "$command" == backup && "\${YGH_TEST_RESTIC_BACKUP_EXIT:-0}" != 0 && " $* " == *" --tag ygh-app "* ]]; then
  exit "$YGH_TEST_RESTIC_BACKUP_EXIT"
fi
if [[ "$command" == forget && "\${YGH_TEST_FAIL_APP_DRYRUN:-false}" == true && " $* " == *" --dry-run "* && " $* " == *" --tag ygh-app "* ]]; then exit 1; fi
if [[ "$command" == forget && "\${YGH_TEST_FAIL_LOG_DRYRUN:-false}" == true && " $* " == *" --dry-run "* && " $* " == *" --tag ygh-logs "* ]]; then exit 1; fi
printf 'synthetic selection for %s\\n' "$*"
`);
  await writeFile(journalctlPath, "#!/usr/bin/env bash\nprintf 'synthetic journal\\n'\n");
  await Promise.all([dockerPath, resticPath, journalctlPath].map((path) => chmod(path, 0o700)));
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    YGH_DOCKER_BIN: dockerPath,
    YGH_RESTIC_BIN: resticPath,
    YGH_JOURNALCTL_BIN: journalctlPath,
    YGH_BACKUP_STAGE_ROOT: join(root, "staging"),
    YGH_BACKUP_STATE_ROOT: join(root, "state"),
    YGH_MAINTENANCE_LOCK: join(root, "run", "maintenance.lock"),
    YGH_COMPOSE_FILE: join(root, "compose.yaml"),
    YGH_BACKUP_CONTAINER_UID: String(process.getuid?.() ?? 1000),
    YGH_BACKUP_CONTAINER_GID: String(process.getgid?.() ?? 1000),
    YGH_TEST_CONTAINER_STATE: statePath,
    YGH_TEST_CALLS: callsPath,
    RESTIC_REPOSITORY: "s3:https://example.invalid/bucket/repository",
    RESTIC_PASSWORD: "synthetic-password-never-log",
    AWS_ACCESS_KEY_ID: "synthetic-key-never-log",
    AWS_SECRET_ACCESS_KEY: "synthetic-secret-never-log",
  };
  return { root, environment };
}

async function runBackup(environment: NodeJS.ProcessEnv, ...args: string[]) {
  return spawnSync("bash", [runnerPath, ...args], { encoding: "utf8", env: environment, timeout: 30_000 });
}

async function callLog(root: string): Promise<string> {
  return readFile(join(root, "calls.log"), "utf8");
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

linuxIt("restarts the exact app container before encrypted upload and uses separate Restic retention groups", async () => {
  const { root, environment } = await createHarness();
  environment.YGH_BACKUP_RETENTION_ENABLED = "true";
  const result = await runBackup(environment);
  const calls = await callLog(root);
  expect(result.status).toBe(0);
  expect(calls.indexOf("docker start 0123456789ab")).toBeGreaterThanOrEqual(0);
  expect(calls.indexOf("docker start 0123456789ab")).toBeLessThan(calls.indexOf("restic --cache-dir"));
  expect(calls).toContain("--tag ygh-app");
  expect(calls).toContain("--tag ygh-logs");
  expect(calls).toContain("--keep-daily 30 --keep-monthly 12");
  expect(calls).toContain("--keep-within 30d");
  expect(calls).toContain("--group-by host,paths,tags");
  expect(result.stdout).not.toContain("synthetic-password-never-log");
  expect(result.stdout).not.toContain("synthetic-secret-never-log");
  expect(await readFile(join(root, "container-state"), "utf8")).toBe("true\n");
});

linuxIt("treats Restic exit 3 as a failed backup, restarts the app, and skips destructive retention", async () => {
  const { root, environment } = await createHarness();
  environment.YGH_BACKUP_RETENTION_ENABLED = "true";
  environment.YGH_TEST_RESTIC_BACKUP_EXIT = "3";
  const result = await runBackup(environment);
  const calls = await callLog(root);
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("Backup failed");
  expect(calls).toContain("docker start 0123456789ab");
  expect(calls).not.toContain("forget");
  expect(calls).not.toContain("prune");
  expect(await readFile(join(root, "container-state"), "utf8")).toBe("true\n");
  expect(result.stdout).not.toContain("synthetic-password-never-log");
  expect(result.stdout).not.toContain("synthetic-key-never-log");
});

linuxIt("returns exit 2 when both the backup and exact-container restart fail", async () => {
  const { root, environment } = await createHarness();
  environment.YGH_TEST_RESTIC_BACKUP_EXIT = "3";
  environment.YGH_TEST_FAIL_START = "true";
  const result = await runBackup(environment);
  expect(result.status).toBe(2);
  expect(result.stdout).toContain("could not be restarted");
  expect(await callLog(root)).not.toContain("forget");
});

linuxIt("does not clean staging after an unsuccessful first retention dry-run", async () => {
  const { root, environment } = await createHarness();
  environment.YGH_TEST_FAIL_APP_DRYRUN = "true";
  const result = await runBackup(environment, "--retention-dry-run");
  const calls = await callLog(root);
  expect(result.status).toBe(1);
  expect(calls).toContain("--dry-run --group-by host,paths,tags --tag ygh-app");
  expect(calls).not.toContain("--dry-run --group-by host,paths,tags --tag ygh-logs");
  expect(calls).not.toContain("docker stop");
  expect(result.stdout).not.toContain("synthetic-secret-never-log");
});
