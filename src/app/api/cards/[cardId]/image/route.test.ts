import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { headers } from "next/headers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const directories: string[] = [];
const adminLogin = "rico-test@example.invalid";
let databasePath: string;
let cacheDirectory: string;

function makeCatalog(withUser: boolean) {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p203-image-route-"));
  directories.push(directory);
  databasePath = join(directory, "catalog.sqlite");
  cacheDirectory = join(directory, "card-images");
  const sqlite = new Database(databasePath);
  migrate(drizzle(sqlite), { migrationsFolder: join(process.cwd(), "src/server/db/migrations") });
  sqlite.prepare("INSERT INTO cards (id, source, source_id, name_en) VALUES (?, ?, ?, ?)")
    .run("card-image", "ygoprodeck", "1001", "Synthetic Image Card");
  if (withUser) {
    sqlite.prepare("INSERT INTO users (id, identity_subject, display_name, active) VALUES (?, ?, ?, 1)")
      .run("synthetic-admin", adminLogin, "Synthetic Admin");
  }
  sqlite.close();
  vi.stubEnv("DATABASE_PATH", databasePath);
  vi.stubEnv("TAILSCALE_RICO_LOGIN", adminLogin);
  vi.stubEnv("TAILSCALE_SECOND_USER_LOGIN", "second-test@example.invalid");
  vi.stubEnv("APP_ORIGIN", "https://cards.example.ts.net");
}

async function requestImage() {
  return GET(new Request("https://cards.example.ts.net/api/cards/card-image/image"), {
    params: Promise.resolve({ cardId: "card-image" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("Bildroute", () => {
  it("liefert einen erlaubten Cachetreffer ohne Providerzugriff", async () => {
    makeCatalog(true);
    mkdirSync(cacheDirectory, { recursive: true });
    const jpeg = Buffer.from([0xff, 0xd8, 0x11, 0xff, 0xd9]);
    writeFileSync(join(cacheDirectory, "1001.jpg"), jpeg);
    vi.mocked(headers).mockResolvedValue(new Headers({ "Tailscale-User-Login": adminLogin }) as Awaited<ReturnType<typeof headers>>);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await requestImage();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(jpeg);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gibt bei fehlendem Cache einen Platzhalterstatus zurück und ruft den Anbieter nicht ab", async () => {
    makeCatalog(true);
    vi.mocked(headers).mockResolvedValue(new Headers({ "Tailscale-User-Login": adminLogin }) as Awaited<ReturnType<typeof headers>>);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await requestImage();

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verweigert einen unbekannten Benutzer auch bei vorhandenem JPG-Cache", async () => {
    makeCatalog(false);
    mkdirSync(cacheDirectory, { recursive: true });
    writeFileSync(join(cacheDirectory, "1001.jpg"), Buffer.from([0xff, 0xd8, 0x11, 0xff, 0xd9]));
    vi.mocked(headers).mockResolvedValue(new Headers({ "Tailscale-User-Login": "unknown@example.invalid" }) as Awaited<ReturnType<typeof headers>>);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await requestImage();

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
