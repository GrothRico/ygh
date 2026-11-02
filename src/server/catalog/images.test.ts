import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogImagesError, cardImageCacheDirectory, syncCatalogImageCache } from "./image-cache";

vi.mock("server-only", () => ({}));

const directories: string[] = [];
const JPEG = new Uint8Array([0xff, 0xd8, 0x11, 0xff, 0xd9]);

function makeCatalog(sourceIds: string[]) {
  const directory = mkdtempSync(join(tmpdir(), "ygh-p203-image-import-"));
  directories.push(directory);
  const databasePath = join(directory, "catalog.sqlite");
  const sqlite = new Database(databasePath);
  migrate(drizzle(sqlite), { migrationsFolder: join(process.cwd(), "src/server/db/migrations") });
  const insertCard = sqlite.prepare("INSERT INTO cards (id, source, source_id, name_en) VALUES (?, ?, ?, ?)");
  sourceIds.forEach((sourceId, index) => insertCard.run(`card-${index}`, "ygoprodeck", sourceId, `Synthetic Card ${index}`));
  sqlite.close();
  return { databasePath, directory, cacheDirectory: cardImageCacheDirectory(databasePath) };
}

function jpegResponse() {
  return new Response(JPEG, { headers: { "Content-Type": "image/jpeg", "Content-Length": String(JPEG.length) } });
}

function timing() {
  let currentTime = 0;
  return {
    now: () => currentTime,
    wait: vi.fn(async (milliseconds: number) => { currentTime += milliseconds; }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("manueller Bildcacheimport", () => {
  it("überspringt gültige JPGs, begrenzt die Rate und setzt nach Teilerfolg fort", async () => {
    const { databasePath, cacheDirectory } = makeCatalog(["1001", "1002", "1003"]);
    mkdirSync(cacheDirectory, { recursive: true });
    writeFileSync(join(cacheDirectory, "1001.jpg"), JPEG);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jpegResponse());
    const clock = timing();

    const first = await syncCatalogImageCache(databasePath, {
      fetchImage: fetchMock,
      now: clock.now,
      wait: clock.wait,
    });

    expect(first).toEqual({ downloaded: 2, cached: 1, unavailable: 0 });
    expect(clock.wait.mock.calls.map(([milliseconds]) => milliseconds)).toEqual([1_000]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://images.ygoprodeck.com/images/cards_small/1002.jpg",
      "https://images.ygoprodeck.com/images/cards_small/1003.jpg",
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "error", headers: { Accept: "image/jpeg" } });
    expect(Buffer.from(readFileSync(join(cacheDirectory, "1003.jpg")))).toEqual(Buffer.from(JPEG));

    const resumed = await syncCatalogImageCache(databasePath, { fetchImage: fetchMock, now: clock.now, wait: clock.wait });
    expect(resumed).toEqual({ downloaded: 0, cached: 3, unavailable: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("meldet 404-Bilder als nicht verfügbar und setzt mit der nächsten Karte fort", async () => {
    const { databasePath } = makeCatalog(["2001", "2002"]);
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => String(url).includes("2001.jpg")
      ? new Response(null, { status: 404 })
      : jpegResponse());
    const result = await syncCatalogImageCache(databasePath, { fetchImage: fetchMock, ...timing() });
    expect(result).toEqual({ downloaded: 1, cached: 0, unavailable: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([403, 429])("stoppt bei HTTP %i nach Erhalt eines früheren Cachetreffers und setzt später fort", async (status) => {
    const { databasePath, cacheDirectory } = makeCatalog(["2101", "2102", "2103"]);
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => String(url).includes("2101.jpg")
      ? jpegResponse()
      : new Response(null, { status }));
    await expect(syncCatalogImageCache(databasePath, { fetchImage: fetchMock })).rejects.toMatchObject({
      errorCode: "provider_blocked",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(readFileSync(join(cacheDirectory, "2101.jpg"))).toEqual(Buffer.from(JPEG));
    expect(readdirSync(cacheDirectory).sort()).toEqual(["2101.jpg"]);

    const resumedFetch = vi.fn(async () => jpegResponse());
    await expect(syncCatalogImageCache(databasePath, { fetchImage: resumedFetch }))
      .resolves.toEqual({ downloaded: 2, cached: 1, unavailable: 0 });
    expect(resumedFetch.mock.calls).toHaveLength(2);
  });

  it("stoppt bei ungültigem Typ, angekündigter Übergröße und überschrittenem Streamlimit", async () => {
    const cases: Array<{ sourceId: string; response: Response }> = [
      { sourceId: "3001", response: new Response("not an image", { headers: { "Content-Type": "text/plain" } }) },
      { sourceId: "3002", response: new Response(JPEG, {
        headers: { "Content-Type": "image/jpeg", "Content-Length": String(2 * 1024 * 1024 + 1) },
      }) },
      { sourceId: "3003", response: new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(1024 * 1024));
          controller.enqueue(new Uint8Array(1024 * 1024 + 1));
          controller.close();
        },
      }), { headers: { "Content-Type": "image/jpeg" } }) },
    ];

    for (const { sourceId, response } of cases) {
      const { databasePath, cacheDirectory } = makeCatalog([sourceId]);
      const fetchMock = vi.fn(async () => response);
      await expect(syncCatalogImageCache(databasePath, { fetchImage: fetchMock })).rejects.toMatchObject({
        errorCode: "invalid_image_response",
      });
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(readdirSync(cacheDirectory)).toEqual([]);
    }
  });

  it("überspringt nicht numerische IDs und verweigert einen verwaisten Sperrmarker", async () => {
    const { databasePath, cacheDirectory } = makeCatalog(["not-a-numeric-id"]);
    const fetchMock = vi.fn();
    await expect(syncCatalogImageCache(databasePath, { fetchImage: fetchMock }))
      .resolves.toEqual({ downloaded: 0, cached: 0, unavailable: 0 });
    expect(fetchMock).not.toHaveBeenCalled();

    writeFileSync(join(cacheDirectory, ".catalog-images.lock"), "synthetic lock");
    await expect(syncCatalogImageCache(databasePath, { fetchImage: fetchMock })).rejects.toMatchObject({
      errorCode: "image_import_locked",
    });
    expect(readFileSync(join(cacheDirectory, ".catalog-images.lock"), "utf8")).toBe("synthetic lock");
  });

  it("blockiert einen zweiten gleichzeitigen Import für denselben Cache", async () => {
    const { databasePath } = makeCatalog(["3501"]);
    let announceFetch: (() => void) | undefined;
    let finishFetch: ((response: Response) => void) | undefined;
    const fetchStarted = new Promise<void>((resolve) => { announceFetch = resolve; });
    const responsePromise = new Promise<Response>((resolve) => { finishFetch = resolve; });
    const fetchMock = vi.fn(async () => {
      announceFetch?.();
      return responsePromise;
    });
    const firstImport = syncCatalogImageCache(databasePath, { fetchImage: fetchMock });
    await fetchStarted;

    await expect(syncCatalogImageCache(databasePath, { fetchImage: fetchMock })).rejects.toMatchObject({
      errorCode: "image_import_locked",
    });
    finishFetch?.(jpegResponse());
    await expect(firstImport).resolves.toEqual({ downloaded: 1, cached: 0, unavailable: 0 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("entfernt nur die eigene temporäre Datei nach einem Cache-Schreibfehler", async () => {
    const { databasePath, cacheDirectory } = makeCatalog(["4001"]);
    mkdirSync(join(cacheDirectory, "4001.jpg"), { recursive: true });
    const fetchMock = vi.fn(async () => jpegResponse());
    await expect(syncCatalogImageCache(databasePath, { fetchImage: fetchMock })).rejects.toBeInstanceOf(CatalogImagesError);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(readdirSync(cacheDirectory).sort()).toEqual(["4001.jpg"]);
  });

  it("führt den tatsächlichen Node-CLI gegen einen vollständigen Cache ohne Netzabruf aus", async () => {
    const { databasePath, cacheDirectory } = makeCatalog(["5001"]);
    mkdirSync(cacheDirectory, { recursive: true });
    writeFileSync(join(cacheDirectory, "5001.jpg"), JPEG);

    const output = execFileSync(process.execPath, [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      "scripts/catalog-images.mts",
      "sync",
    ], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: databasePath },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const usage = spawnSync(process.execPath, [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "--experimental-strip-types",
      "scripts/catalog-images.mts",
    ], { cwd: process.cwd(), encoding: "utf8", env: process.env });

    expect(output).toContain("0 geladen, 1 bereits vorhanden");
    expect(usage.status).toBe(2);
    expect(usage.stderr).toContain("npm run catalog:images -- sync");
  });
});
