import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import Database from "better-sqlite3";

const root = process.cwd();
const serverPath = join(root, ".next/standalone/server.js");
const login = "production-test-admin@example.invalid";
const directory = mkdtempSync(join(tmpdir(), "ygh-p116-production-"));
const databasePath = join(directory, "test.sqlite");
const sqlite = new Database(databasePath);
sqlite.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    identity_subject TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
  )
`);
sqlite.prepare(
  "INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, 1)",
).run("synthetic-production-user", login, "Synthetic Production Test");
sqlite.prepare(
  "INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, 1)",
).run("synthetic-local-admin", "local-admin@ygh.invalid", "Lokaler Test-Admin");
sqlite.prepare(
  "INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, 1)",
).run("synthetic-local-member", "local-member@ygh.invalid", "Lokaler Testbenutzer");
sqlite.close();

async function unusedPort() {
  const listener = createServer();
  await new Promise<void>((resolve, reject) => {
    listener.once("error", reject);
    listener.listen(0, "127.0.0.1", resolve);
  });
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Could not reserve a local test port.");
  const port = address.port;
  await new Promise<void>((resolve, reject) => listener.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startServer(extra: Record<string, string | undefined>) {
  const port = await unusedPort();
  const nodeEnvironment: "development" | "production" = extra.NODE_ENV === "development" ? "development" : "production";
  const child = spawn(process.execPath, [serverPath], {
    cwd: join(root, ".next/standalone"),
    stdio: "ignore",
    env: {
      PATH: process.env.PATH ?? "/usr/bin:/bin",
      NODE_ENV: nodeEnvironment,
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      DATABASE_PATH: databasePath,
      TAILSCALE_RICO_LOGIN: login,
      TAILSCALE_SECOND_USER_LOGIN: "synthetic-member@example.invalid",
      NEXT_TELEMETRY_DISABLED: "1",
      ...(extra.YGH_LOCAL_DEV_USER === undefined ? {} : { YGH_LOCAL_DEV_USER: extra.YGH_LOCAL_DEV_USER }),
      ...(extra.YGH_LOCAL_DEV_BUILD_ALLOWED === undefined ? {} : { YGH_LOCAL_DEV_BUILD_ALLOWED: extra.YGH_LOCAL_DEV_BUILD_ALLOWED }),
    },
  });
  const address = `http://127.0.0.1:${port}`;
  try {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Standalone server exited early (${child.exitCode}).`);
      try {
        response = await fetch(address, { signal: AbortSignal.timeout(500) });
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    if (!response) throw new Error("Standalone server did not become ready.");
    return { child, address, response };
  } catch (error) {
    child.kill("SIGTERM");
    throw error;
  }
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    new Promise<void>((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

try {
  const local = await startServer({
    NODE_ENV: "development",
    YGH_LOCAL_DEV_USER: "admin",
    YGH_LOCAL_DEV_BUILD_ALLOWED: "true",
  });
  try {
    await local.response.arrayBuffer();
    const protectedResponse = await fetch(local.address, {
      headers: {
        Host: "127.0.0.1:3001",
        "Tailscale-User-Login": login,
      },
      signal: AbortSignal.timeout(5000),
    });
    const body = await protectedResponse.text();
    assert.equal(protectedResponse.status, 200);
    assert.match(body, /Zugriff verweigert\./);
    assert.doesNotMatch(body, /Deine Yu-Gi-Oh!-Sammlung|Lokale Entwicklung/);
    process.stdout.write("PASS production artifact rejected local identity with runtime opt-in and changed NODE_ENV.\n");
  } finally {
    await stopServer(local.child);
  }

  const tailscale = await startServer({ NODE_ENV: "production" });
  try {
    const authorized = await fetch(tailscale.address, {
      headers: { "Tailscale-User-Login": login },
      signal: AbortSignal.timeout(5000),
    });
    const body = await authorized.text();
    assert.equal(authorized.status, 200);
    assert.match(body, /Deine Yu-Gi-Oh!-Sammlung/);
    assert.doesNotMatch(body, /Lokale Entwicklung/);
    process.stdout.write("PASS production artifact retained the existing authorized identity path.\n");
  } finally {
    await stopServer(tailscale.child);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
