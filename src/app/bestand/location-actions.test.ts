import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listLocations } from "../../server/locations";
import { mutateLocationAction } from "./location-actions";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const directories: string[] = [];
const origin = "https://cards.example.ts.net";
const users = { first: "first@example.invalid", second: "second@example.invalid" };
let databasePath: string;
function setup() {
  const directory = mkdtempSync(join(tmpdir(), "ygh-location-actions-")); directories.push(directory); databasePath = join(directory, "test.sqlite");
  execFileSync(process.execPath, [join(process.cwd(), "node_modules/drizzle-kit/bin.cjs"), "migrate"], { cwd: process.cwd(), env: { ...process.env, DATABASE_PATH: databasePath }, stdio: "pipe" });
  const db = new Database(databasePath);
  db.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES ('user-a', ?, 'A', 1)").run(users.first);
  db.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES ('user-b', ?, 'B', 1)").run(users.second);
  db.close();
}
function setRequest(login: string | null, host = "cards.example.ts.net", requestOrigin = origin) {
  const value = new Headers({ Host: host, Origin: requestOrigin });
  if (login) value.set("Tailscale-User-Login", login);
  vi.mocked(headers).mockResolvedValue(value as Awaited<ReturnType<typeof headers>>);
}
function form(values: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; }
beforeEach(() => { setup(); vi.stubEnv("DATABASE_PATH", databasePath); vi.stubEnv("TAILSCALE_RICO_LOGIN", users.first); vi.stubEnv("TAILSCALE_SECOND_USER_LOGIN", users.second); vi.stubEnv("APP_ORIGIN", origin); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("geschützte Ordneraktionen", () => {
  it("erfordert Identität und Origin und erlaubt beiden Benutzern die gemeinsame Verwaltung", async () => {
    const base = { operation: "create", name: "Schublade", parentId: "" };
    setRequest(null);
    const denied = await mutateLocationAction({ ok: false, message: null }, form(base));
    expect(denied.message).toContain("Request-ID:");
    setRequest(users.second, "attacker.invalid", origin);
    const badHost = await mutateLocationAction({ ok: false, message: null }, form(base));
    expect(badHost.message).toContain("Request-ID:");
    setRequest(users.second, "cards.example.ts.net", "https://attacker.invalid");
    const badOrigin = await mutateLocationAction({ ok: false, message: null }, form(base));
    expect(badOrigin.ok).toBe(false);
    expect(badOrigin.message).toContain("Request-ID:");
    const db = new Database(databasePath);
    try { db.prepare("UPDATE users SET active = 0 WHERE id = 'user-a'").run(); } finally { db.close(); }
    setRequest(users.first);
    const inactive = await mutateLocationAction({ ok: false, message: null }, form(base));
    expect(inactive.ok).toBe(false);
    expect(inactive.message).toContain("Request-ID:");
    expect(listLocations(databasePath)).toHaveLength(1);
    expect(listLocations(databasePath)[0].kind).toBe("unknown");
    setRequest(users.second);
    const badParent = await mutateLocationAction({ ok: false, message: null }, form({ ...base, parentId: "missing-folder" }));
    expect(badParent).toEqual({ ok: false, message: "Der ausgewählte Ordner ist nicht mehr vorhanden." });
    expect(listLocations(databasePath)).toHaveLength(1);
    expect(await mutateLocationAction({ ok: false, message: null }, form(base))).toEqual({ ok: true, message: "Ordner angelegt." });
    expect(listLocations(databasePath)).toContainEqual(expect.objectContaining({ name: "Schublade", kind: "folder", parentId: null }));
  });
  it("liefert nach dem Löschen den serverseitig bestätigten Elternpfad zur Clientnavigation", async () => {
    setRequest(users.first);
    const create = await mutateLocationAction({ ok: false, message: null }, form({ operation: "create", name: "Parent", parentId: "" }));
    expect(create.ok).toBe(true);
    const parent = listLocations(databasePath).find((item) => item.name === "Parent")!;
    const childCreate = await mutateLocationAction({ ok: false, message: null }, form({ operation: "create", name: "Child", parentId: parent.id }));
    expect(childCreate.ok).toBe(true);
    const child = listLocations(databasePath).find((item) => item.name === "Child")!;
    expect(await mutateLocationAction({ ok: false, message: null }, form({ operation: "delete", id: child.id, currentLocationId: child.id }))).toEqual({ ok: true, message: "Ordner gelöscht.", navigateTo: `/bestand?locationId=${parent.id}` });
    expect(listLocations(databasePath).some((item) => item.id === child.id)).toBe(false);
  });
});
