import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listLocations } from "../../server/locations";
import { mutateStockAction } from "./actions";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const directories: string[] = [];
const origin = "https://cards.example.ts.net";
const logins = { first: "first@example.invalid", second: "second@example.invalid" };
let databasePath: string;
function setup() {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p205-actions-")); directories.push(directory); databasePath = join(directory, "test.sqlite");
  execFileSync(process.execPath, [join(process.cwd(), "node_modules/drizzle-kit/bin.cjs"), "migrate"], { cwd: process.cwd(), env: { ...process.env, DATABASE_PATH: databasePath }, stdio: "pipe" });
  const db = new Database(databasePath); db.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES ('user-a', ?, 'Person A', 1)").run(logins.first); db.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES ('user-b', ?, 'Person B', 1)").run(logins.second); db.prepare("INSERT INTO cards (id, name_en) VALUES ('card-a', 'Synthetic Card')").run(); db.close();
}
function setRequest(login: string | null, host = "cards.example.ts.net", requestOrigin = origin) {
  const value = new Headers({ Host: host, Origin: requestOrigin }); if (login) value.set("Tailscale-User-Login", login); vi.mocked(headers).mockResolvedValue(value as Awaited<ReturnType<typeof headers>>);
}
function form(fields: Record<string, string>) { const data = new FormData(); for (const [key, value] of Object.entries(fields)) data.set(key, value); return data; }
beforeEach(() => { setup(); vi.stubEnv("DATABASE_PATH", databasePath); vi.stubEnv("TAILSCALE_RICO_LOGIN", logins.first); vi.stubEnv("TAILSCALE_SECOND_USER_LOGIN", logins.second); vi.stubEnv("APP_ORIGIN", origin); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

describe("geschützte Bestandsaktionen", () => {
  const payload = () => ({ operation: "create", cardId: "card-a", locationId: listLocations(databasePath).find((location) => location.kind === "unknown")!.id, quantity: "1", language: "de", edition: "unknown", reference: "" });
  it("weist fehlende oder inaktive Identität ab, bevor Bestand geschrieben wird", async () => {
    setRequest(null); const missing = await mutateStockAction({ ok: false, message: null }, form(payload())); expect(missing.message).toContain("Request-ID:");
    const db = new Database(databasePath); db.prepare("UPDATE users SET active = 0 WHERE id = 'user-a'").run(); db.close(); setRequest(logins.first);
    const inactive = await mutateStockAction({ ok: false, message: null }, form(payload())); expect(inactive.message).toContain("Request-ID:");
    const check = new Database(databasePath); try { expect(check.prepare("SELECT COUNT(*) AS count FROM stock").get()).toEqual({ count: 0 }); } finally { check.close(); }
  });
  it("erlaubt zweitem aktivem Benutzer die gemeinsame Bearbeitung und blockiert falschen Host/Origin", async () => {
    setRequest(logins.second); const allowed = await mutateStockAction({ ok: false, message: null }, form(payload())); expect(allowed).toEqual({ ok: true, message: "Bestand erfasst." });
    const db = new Database(databasePath); let stockId = "";
    try { expect(db.prepare("SELECT COUNT(*) AS count FROM stock").get()).toEqual({ count: 1 }); stockId = String((db.prepare("SELECT id FROM stock").get() as { id: string }).id); }
    finally { db.close(); }
    setRequest(logins.first);
    const correction = await mutateStockAction({ ok: false, message: null }, form({ ...payload(), operation: "correct", id: stockId, version: "1", quantity: "2", language: "en" }));
    expect(correction).toEqual({ ok: true, message: "Bestand korrigiert; Verlauf gespeichert." });
    const audited = new Database(databasePath);
    try {
      expect(audited.prepare("SELECT quantity, version FROM stock WHERE id = ?").get(stockId)).toEqual({ quantity: 2, version: 2 });
      expect(audited.prepare("SELECT actor_id, action, request_id FROM activity_log WHERE entity_id = ? ORDER BY created_at DESC LIMIT 1").get(stockId)).toMatchObject({ actor_id: "user-a", action: "stock.corrected" });
    } finally { audited.close(); }
    setRequest(logins.second, "attacker.invalid", origin); const host = await mutateStockAction({ ok: false, message: null }, form(payload())); expect(host.message).toContain("Request-ID:");
    setRequest(logins.second, "cards.example.ts.net", "https://attacker.invalid"); const requestOrigin = await mutateStockAction({ ok: false, message: null }, form(payload())); expect(requestOrigin.message).toContain("Request-ID:");
    const after = new Database(databasePath); try { expect(after.prepare("SELECT COUNT(*) AS count FROM stock").get()).toEqual({ count: 1 }); } finally { after.close(); }
  });
});
