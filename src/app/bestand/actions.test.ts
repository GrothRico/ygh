import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listLocations } from "../../server/locations";
import { recordStock, type StockInput } from "../../server/stock";
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
  it("erlaubt Mitgliedern Verschieben, ignoriert gefälschte Bestandsdetails und korreliert beide Verläufe", async () => {
    const locationId = listLocations(databasePath).find((location) => location.kind === "unknown")!.id;
    const destinationId = "destination";
    const db = new Database(databasePath);
    try { db.prepare("INSERT INTO locations (id, name, kind) VALUES (?, 'Ziel', 'folder')").run(destinationId); } finally { db.close(); }
    const stockInput: StockInput = { cardId: "card-a", variantId: null, printingId: null, sourceObservationId: null, language: "de", edition: "unknown", locationId, quantity: 5 };
    const stockId = recordStock(databasePath, stockInput, "user-a", "request-create");
    setRequest(logins.second);
    const result = await mutateStockAction({ ok: false, message: null }, form({ operation: "move", id: stockId, version: "1", destinationId, quantity: "2", cardId: "forged-card", locationId: "forged-location", reference: "printing:forged", language: "en", edition: "first" }));
    expect(result).toEqual({ ok: true, message: "Bestand verschoben; Verlauf gespeichert." });
    const verify = new Database(databasePath);
    try {
      expect(verify.prepare("SELECT card_id, quantity, location_id, language, edition FROM stock WHERE id = ?").get(stockId)).toEqual({ card_id: "card-a", quantity: 3, location_id: locationId, language: "de", edition: "unknown" });
      const entries = verify.prepare("SELECT actor_id, action, request_id FROM activity_log WHERE request_id != 'request-create'").all();
      expect(entries).toHaveLength(2);
      expect(entries).toEqual(expect.arrayContaining([
        { actor_id: "user-b", action: "stock.moved", request_id: expect.any(String) },
        { actor_id: "user-b", action: "stock.moved", request_id: expect.any(String) },
      ]));
      expect(new Set(entries.map((entry) => (entry as { request_id: string }).request_id)).size).toBe(1);
    } finally { verify.close(); }
    const stale = await mutateStockAction({ ok: false, message: null }, form({ operation: "move", id: stockId, version: "1", destinationId, quantity: "1" }));
    expect(stale).toEqual({ ok: false, message: expect.stringContaining("zwischenzeitlich geändert") });
    const unchanged = new Database(databasePath);
    try {
      expect(unchanged.prepare("SELECT quantity, version, location_id FROM stock WHERE id = ?").get(stockId)).toEqual({ quantity: 3, version: 2, location_id: locationId });
      expect(unchanged.prepare("SELECT COUNT(*) AS count FROM activity_log WHERE action = 'stock.moved'").get()).toEqual({ count: 2 });
    } finally { unchanged.close(); }
  });
  it("erlaubt einem Mitglied atomare Mehrfachverschiebungen und ignoriert gefälschte Actor-/Bestandsfelder", async () => {
    const locationId = listLocations(databasePath).find((location) => location.kind === "unknown")!.id;
    const destinationId = "destination-bulk";
    const db = new Database(databasePath);
    try {
      db.prepare("INSERT INTO locations (id, name, kind) VALUES (?, 'Ziel', 'folder')").run(destinationId);
      db.prepare("INSERT INTO cards (id, name_en) VALUES ('card-b', 'Other card')").run();
    } finally { db.close(); }
    const firstId = recordStock(databasePath, { cardId: "card-a", variantId: null, printingId: null, sourceObservationId: null, language: "de", edition: "unknown", locationId, quantity: 5 }, "user-a", "bulk-create-a");
    const secondId = recordStock(databasePath, { cardId: "card-b", variantId: null, printingId: null, sourceObservationId: null, language: "en", edition: "unknown", locationId, quantity: 4 }, "user-a", "bulk-create-b");
    setRequest(logins.second);
    const result = await mutateStockAction({ ok: false, message: null }, form({ operation: "move_many", moves: JSON.stringify([
      { id: firstId, expectedVersion: 1, quantity: 2, cardId: "forged", actorId: "forged" },
      { id: secondId, expectedVersion: 1, quantity: 4, cardId: "forged", actorId: "forged" },
    ]), destinationId: destinationId }));
    expect(result).toEqual({ ok: true, message: "Bestand verschoben; Verlauf gespeichert." });
    const verify = new Database(databasePath);
    try {
      expect(verify.prepare("SELECT quantity, version, location_id FROM stock WHERE id = ?").get(firstId)).toEqual({ quantity: 3, version: 2, location_id: locationId });
      expect(verify.prepare("SELECT quantity, version, location_id FROM stock WHERE id = ?").get(secondId)).toEqual({ quantity: 4, version: 2, location_id: destinationId });
      expect(verify.prepare("SELECT DISTINCT actor_id FROM activity_log WHERE request_id != 'bulk-create-a' AND request_id != 'bulk-create-b'").all()).toEqual([{ actor_id: "user-b" }]);
    } finally { verify.close(); }
  });
  it("weist fehlerhafte Mehrfachpayloads und ungeschützte Aufrufe ohne Revalidierung ab", async () => {
    const locationId = listLocations(databasePath).find((location) => location.kind === "unknown")!.id;
    const db = new Database(databasePath); try { db.prepare("INSERT INTO locations (id, name, kind) VALUES ('destination-bulk', 'Ziel', 'folder')").run(); } finally { db.close(); }
    const id = recordStock(databasePath, { cardId: "card-a", variantId: null, printingId: null, sourceObservationId: null, language: "unknown", edition: "unknown", locationId, quantity: 2 }, "user-a", "create");
    setRequest(logins.first);
    for (const moves of ["{", "[]", JSON.stringify([{ id, expectedVersion: 1, quantity: 1 }, { id, expectedVersion: 1, quantity: 1 }]), JSON.stringify([{ id, expectedVersion: "1", quantity: 1 }])]) {
      const result = await mutateStockAction({ ok: false, message: null }, form({ operation: "move_many", moves, destinationId: "destination-bulk" }));
      expect(result).toEqual({ ok: false, message: expect.stringContaining("Bitte alle Angaben") });
    }
    const { revalidatePath } = await import("next/cache");
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    setRequest(null);
    const denied = await mutateStockAction({ ok: false, message: null }, form({ operation: "move_many", moves: JSON.stringify([{ id, expectedVersion: 1, quantity: 1 }]), destinationId: "destination-bulk" }));
    expect(denied.message).toContain("Request-ID:");
    setRequest(logins.first);
    const inactiveDb = new Database(databasePath); inactiveDb.prepare("UPDATE users SET active = 0 WHERE id = 'user-a'").run(); inactiveDb.close();
    const inactive = await mutateStockAction({ ok: false, message: null }, form({ operation: "move_many", moves: JSON.stringify([{ id, expectedVersion: 1, quantity: 1 }]), destinationId: "destination-bulk" }));
    expect(inactive.message).toContain("Request-ID:");
    const reactivate = new Database(databasePath); reactivate.prepare("UPDATE users SET active = 1 WHERE id = 'user-a'").run(); reactivate.close();
    setRequest(logins.first, "attacker.invalid", origin);
    const badHost = await mutateStockAction({ ok: false, message: null }, form({ operation: "move_many", moves: JSON.stringify([{ id, expectedVersion: 1, quantity: 1 }]), destinationId: "destination-bulk" }));
    expect(badHost.message).toContain("Request-ID:");
    setRequest(logins.first, "cards.example.ts.net", "https://attacker.invalid");
    const badOrigin = await mutateStockAction({ ok: false, message: null }, form({ operation: "move_many", moves: JSON.stringify([{ id, expectedVersion: 1, quantity: 1 }]), destinationId: "destination-bulk" }));
    expect(badOrigin.message).toContain("Request-ID:");
    const verify = new Database(databasePath);
    try { expect(verify.prepare("SELECT quantity, version, location_id FROM stock WHERE id = ?").get(id)).toEqual({ quantity: 2, version: 1, location_id: locationId }); } finally { verify.close(); }
  });
  it("verweigert fehlende/inaktive Identität und ungültigen Host/Origin beim Verschieben", async () => {
    const locationId = listLocations(databasePath).find((location) => location.kind === "unknown")!.id;
    const db = new Database(databasePath);
    try { db.prepare("INSERT INTO locations (id, name, kind) VALUES ('destination', 'Ziel', 'folder')").run(); } finally { db.close(); }
    const stockId = recordStock(databasePath, { cardId: "card-a", variantId: null, printingId: null, sourceObservationId: null, language: "unknown", edition: "unknown", locationId, quantity: 1 }, "user-a", "request-create");
    const move = () => form({ operation: "move", id: stockId, version: "1", destinationId: "destination", quantity: "1" });
    setRequest(null); expect((await mutateStockAction({ ok: false, message: null }, move())).message).toContain("Request-ID:");
    const deactivate = new Database(databasePath); deactivate.prepare("UPDATE users SET active = 0 WHERE id = 'user-b'").run(); deactivate.close();
    setRequest(logins.second); expect((await mutateStockAction({ ok: false, message: null }, move())).message).toContain("Request-ID:");
    const activate = new Database(databasePath); activate.prepare("UPDATE users SET active = 1 WHERE id = 'user-b'").run(); activate.close();
    setRequest(logins.second, "attacker.invalid", origin); expect((await mutateStockAction({ ok: false, message: null }, move())).message).toContain("Request-ID:");
    setRequest(logins.second, "cards.example.ts.net", "https://attacker.invalid"); expect((await mutateStockAction({ ok: false, message: null }, move())).message).toContain("Request-ID:");
    const verify = new Database(databasePath);
    try { expect(verify.prepare("SELECT location_id, quantity, version FROM stock WHERE id = ?").get(stockId)).toEqual({ location_id: locationId, quantity: 1, version: 1 }); } finally { verify.close(); }
  });
  it("zeigt fachliche Verschiebefehler und invalidiert keine Seiten bei Fehlschlag", async () => {
    const locationId = listLocations(databasePath).find((location) => location.kind === "unknown")!.id;
    const db = new Database(databasePath);
    try { db.prepare("INSERT INTO locations (id, name, kind) VALUES ('destination', 'Ziel', 'folder')").run(); } finally { db.close(); }
    const stockId = recordStock(databasePath, { cardId: "card-a", variantId: null, printingId: null, sourceObservationId: null, language: "unknown", edition: "unknown", locationId, quantity: 1 }, "user-a", "request-create");
    setRequest(logins.first);
    const result = await mutateStockAction({ ok: false, message: null }, form({ operation: "move", id: stockId, version: "1", destinationId: "destination", quantity: "0" }));
    expect(result).toEqual({ ok: false, message: expect.stringContaining("positive ganze Zahl") });
    const { revalidatePath } = await import("next/cache");
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
    const verify = new Database(databasePath);
    try { expect(verify.prepare("SELECT location_id, quantity, version FROM stock WHERE id = ?").get(stockId)).toEqual({ location_id: locationId, quantity: 1, version: 1 }); } finally { verify.close(); }
  });
});
