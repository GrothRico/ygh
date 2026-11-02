import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const runnerPath = join(process.cwd(), "infra/ansible/files/ygh-catalog-update.sh");
const linuxIt = it.skipIf(process.platform !== "linux");

async function createHarness(): Promise<{ root: string; environment: NodeJS.ProcessEnv }> {
  const root = await mkdtemp(join(tmpdir(), "ygh-catalog-update-"));
  temporaryDirectories.push(root);
  const bins = join(root, "bin");
  await mkdir(bins);
  await mkdir(join(root, "run"));
  const dockerPath = join(bins, "docker");
  const nodePath = join(bins, "node");
  const callsPath = join(root, "calls.log");
  const commandPath = join(root, "worker-command");
  const nodeCallsPath = join(root, "node-calls.log");
  await writeFile(dockerPath, `#!/usr/bin/env bash
set -euo pipefail
printf 'docker %s\\n' "$*" >>"$YGH_TEST_CALLS"
case "$1" in
  compose) printf '%s\\n' '0123456789ab' ;;
  inspect)
    if [[ "$4" == '0123456789ab' ]]; then
      printf 'true|sha256:%064d|ygh-app-data\\n' 0
    else
      printf '%s|%s\\n' false "\${YGH_TEST_WORKER_EXIT:-0}"
    fi ;;
  create)
    printf '%s' "\${!#}" >"$YGH_TEST_WORKER_COMMAND"
    printf '%s\\n' 'abcdef012345' ;;
  start)
    [[ "\${YGH_TEST_FAIL_START:-false}" != true ]] || exit 1
    bash -c "$(cat "$YGH_TEST_WORKER_COMMAND")" ;;
  rm)
    [[ "$2" == --force && "$3" == 'abcdef012345' ]] || exit 1
    [[ "\${YGH_TEST_FAIL_REMOVE:-false}" != true ]] ;;
  *) exit 9 ;;
esac
`);
  await writeFile(nodePath, `#!/usr/bin/env bash
set -euo pipefail
printf 'node %s\\n' "$*" >>"$YGH_TEST_NODE_CALLS"
if [[ "$3" == scripts/catalog-sync.mts && "\${YGH_TEST_FAIL_METADATA:-false}" == true ]]; then exit 1; fi
if [[ "$3" == scripts/catalog-images.mts && "\${YGH_TEST_FAIL_IMAGES:-false}" == true ]]; then exit 1; fi
printf '%s\\n' 'synthetic worker progress'
`);
  await Promise.all([dockerPath, nodePath].map((path) => chmod(path, 0o700)));
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bins}:${process.env.PATH ?? ""}`,
    YGH_DOCKER_BIN: dockerPath,
    YGH_MAINTENANCE_LOCK: join(root, "run", "maintenance.lock"),
    YGH_COMPOSE_FILE: join(root, "compose.yaml"),
    YGH_PROJECT_DIRECTORY: root,
    YGH_TEST_CALLS: callsPath,
    YGH_TEST_WORKER_COMMAND: commandPath,
    YGH_TEST_NODE_CALLS: nodeCallsPath,
  };
  return { root, environment };
}

function runRunner(environment: NodeJS.ProcessEnv) {
  return spawnSync("bash", [runnerPath], { encoding: "utf8", env: environment, timeout: 30_000 });
}

async function readCalls(root: string): Promise<string> {
  return readFile(join(root, "calls.log"), "utf8");
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

linuxIt("runs the current immutable image as a restricted worker and removes only that worker", async () => {
  const { root, environment } = await createHarness();
  const result = runRunner(environment);
  const calls = await readCalls(root);
  const nodeCalls = await readFile(join(root, "node-calls.log"), "utf8");
  const workerCommand = await readFile(join(root, "worker-command"), "utf8");
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("refreshed successfully");
  expect(result.stdout).toContain("synthetic worker progress");
  expect(calls).toContain("compose --project-directory");
  expect(calls).toContain("--pull=never");
  expect(calls).toContain("--label com.ygh.maintenance=catalog-update");
  expect(calls).toContain("--read-only");
  expect(calls).toContain("--cap-drop ALL");
  expect(calls).toContain("--security-opt no-new-privileges:true");
  expect(calls).toContain("--user 1000:1000");
  expect(calls).toContain("--network ygh-app-private");
  expect(calls).toContain("type=volume,src=ygh-app-data,dst=/data");
  expect(calls).toContain("--env DATABASE_PATH=/data/collection.sqlite");
  expect(calls).toContain("docker rm --force abcdef012345");
  expect(workerCommand).toContain("catalog-sync.mts sync && node");
  expect(workerCommand).toContain("catalog-images.mts sync");
  expect(calls).not.toContain("docker stop");
  expect(calls).not.toContain("docker pull");
  expect(nodeCalls).toContain("scripts/catalog-sync.mts sync");
  expect(nodeCalls).toContain("scripts/catalog-images.mts sync");
  expect(result.stdout).not.toContain("docker.sock");
});

linuxIt.each([
  ["metadata refresh", "YGH_TEST_FAIL_METADATA"],
  ["image refresh", "YGH_TEST_FAIL_IMAGES"],
  ["worker start", "YGH_TEST_FAIL_START"],
])("fails and cleans up its worker after %s failure", async (_label, failureVariable) => {
  const { root, environment } = await createHarness();
  environment[failureVariable] = "true";
  const result = runRunner(environment);
  const calls = await readCalls(root);
  expect(result.status).toBe(1);
  expect(calls).toContain("docker rm --force abcdef012345");
  expect(result.stdout).toContain("Catalog refresh failed");
  if (failureVariable === "YGH_TEST_FAIL_METADATA") {
    const nodeCalls = await readFile(join(root, "node-calls.log"), "utf8");
    expect(nodeCalls).toContain("scripts/catalog-sync.mts sync");
    expect(nodeCalls).not.toContain("catalog-images.mts");
  }
  if (failureVariable === "YGH_TEST_FAIL_IMAGES") {
    const nodeCalls = await readFile(join(root, "node-calls.log"), "utf8");
    expect(nodeCalls).toContain("scripts/catalog-sync.mts sync");
    expect(nodeCalls).toContain("scripts/catalog-images.mts sync");
  }
});

linuxIt("rejects a nonzero worker exit code even when attach succeeds", async () => {
  const { root, environment } = await createHarness();
  environment.YGH_TEST_WORKER_EXIT = "7";
  const result = runRunner(environment);
  const calls = await readCalls(root);
  expect(result.status).toBe(1);
  expect(calls).toContain("docker rm --force abcdef012345");
});

linuxIt("reports failure when removal of the owned worker fails", async () => {
  const { root, environment } = await createHarness();
  environment.YGH_TEST_FAIL_REMOVE = "true";
  const result = runRunner(environment);
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("worker cleanup failed");
  expect(result.stdout).not.toContain("refreshed successfully");
  expect(await readCalls(root)).toContain("docker rm --force abcdef012345");
});

linuxIt("skips without contacting Docker when backup or deployment holds the shared lock", async () => {
  const { root, environment } = await createHarness();
  const result = spawnSync("flock", ["--nonblock", environment.YGH_MAINTENANCE_LOCK!, "bash", runnerPath], {
    encoding: "utf8",
    env: environment,
    timeout: 30_000,
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("skipped because another maintenance task holds the lock");
  await expect(readCalls(root)).rejects.toMatchObject({ code: "ENOENT" });
});
