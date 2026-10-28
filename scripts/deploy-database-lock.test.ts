import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, expect, it } from "vitest";

const temporaryDirectories: string[] = [];
const linuxIt = it.skipIf(process.platform !== "linux");
const deploymentScript = join(process.cwd(), "infra/ansible/files/ygh-deploy-database.sh");

async function setup(): Promise<{ root: string; calls: string }> {
  const root = await mkdtemp(join(tmpdir(), "ygh-deploy-lock-"));
  temporaryDirectories.push(root);
  const docker = join(root, "docker");
  const calls = join(root, "calls.log");
  await writeFile(docker, `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >>"$YGH_TEST_CALLS"
if [[ " $* " == *" ps "* ]]; then printf 'app-container-id\\n'; fi
if [[ " $* " == *" run "* ]]; then exit "\${YGH_TEST_MIGRATION_EXIT:-0}"; fi
`);
  await chmod(docker, 0o700);
  return { root, calls };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

linuxIt("holds the shared lock across stop, successful migration, and application start", async () => {
  const { root, calls } = await setup();
  const lockPath = join(root, "maintenance.lock");
  const result = spawnSync(
    "flock",
    ["--exclusive", lockPath, "bash", deploymentScript, join(root, "deployment"), "false"],
    { encoding: "utf8", env: { ...process.env, PATH: `${root}:${process.env.PATH}`, YGH_TEST_CALLS: calls } },
  );
  expect(result.status).toBe(0);
  const output = await readFile(calls, "utf8");
  expect(output.indexOf("stop")).toBeLessThan(output.indexOf("run"));
  expect(output.indexOf("run")).toBeLessThan(output.indexOf("up"));
});

linuxIt("keeps the application stopped when migration fails under the lock", async () => {
  const { root, calls } = await setup();
  const result = spawnSync(
    "flock",
    ["--exclusive", join(root, "maintenance.lock"), "bash", deploymentScript, join(root, "deployment"), "false"],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${root}:${process.env.PATH}`, YGH_TEST_CALLS: calls, YGH_TEST_MIGRATION_EXIT: "1" },
    },
  );
  expect(result.status).toBe(1);
  const output = await readFile(calls, "utf8");
  expect(output).toContain("stop");
  expect(output).toContain("run");
  expect(output).not.toContain("up");
});
