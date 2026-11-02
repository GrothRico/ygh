import { randomUUID } from "node:crypto";
import type { FileHandle } from "node:fs/promises";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import Database from "better-sqlite3";

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_REQUEST_INTERVAL_MS = 1_000;
export const IMAGE_REQUEST_TIMEOUT_MS = 8_000;
export const IMAGE_PROVIDER_ROOT = "https://images.ygoprodeck.com/images/cards_small/";
const IMAGE_CACHE_DIRECTORY = "card-images";
const IMAGE_LOCK_FILE = ".catalog-images.lock";

export class CatalogImagesError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string) {
    super(errorCode);
    this.errorCode = errorCode;
    this.name = "CatalogImagesError";
  }
}

export type CatalogImageSyncResult = {
  downloaded: number;
  cached: number;
  unavailable: number;
};

export type CatalogImageSyncOptions = {
  fetchImage?: typeof fetch;
  wait?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  onProgress?: (processed: number, total: number) => void;
  cacheDirectory?: string;
};

export function cardImageCacheDirectory(databasePath: string): string {
  return join(dirname(databasePath), IMAGE_CACHE_DIRECTORY);
}

export function isJpeg(image: Buffer): boolean {
  return image.length >= 4 && image[0] === 0xff && image[1] === 0xd8 &&
    image[image.length - 2] === 0xff && image[image.length - 1] === 0xd9;
}

export async function readCachedCardImage(cacheDirectory: string, sourceId: string): Promise<Buffer | null> {
  if (!/^\d+$/.test(sourceId)) return null;
  try {
    const image = await readFile(join(cacheDirectory, `${sourceId}.jpg`));
    return image.length <= MAX_IMAGE_BYTES && isJpeg(image) ? image : null;
  } catch {
    return null;
  }
}

async function readBoundedJpeg(response: Response): Promise<Buffer | null> {
  if (!response.ok || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "image/jpeg") {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  const contentLength = response.headers.get("content-length");
  const announcedLength = contentLength === null ? null : Number(contentLength);
  if (announcedLength !== null && Number.isFinite(announcedLength) && announcedLength > MAX_IMAGE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const image = Buffer.concat(chunks);
  return isJpeg(image) ? image : null;
}

async function downloadJpeg(sourceId: string, fetchImage: typeof fetch): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetchImage(`${IMAGE_PROVIDER_ROOT}${sourceId}.jpg`, {
      signal: AbortSignal.timeout(IMAGE_REQUEST_TIMEOUT_MS),
      redirect: "error",
      headers: { Accept: "image/jpeg" },
    });
  } catch {
    throw new CatalogImagesError("network_error");
  }

  if (response.status === 403 || response.status === 429) {
    await response.body?.cancel().catch(() => undefined);
    throw new CatalogImagesError("provider_blocked");
  }
  if (response.status === 404) {
    await response.body?.cancel().catch(() => undefined);
    throw new CatalogImagesError("image_not_found");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new CatalogImagesError("provider_error");
  }

  try {
    const image = await readBoundedJpeg(response);
    if (!image) throw new CatalogImagesError("invalid_image_response");
    return image;
  } catch (error) {
    await response.body?.cancel().catch(() => undefined);
    if (error instanceof CatalogImagesError) throw error;
    throw new CatalogImagesError("invalid_image_response");
  }
}

async function waitForInterval(
  lastRequestAt: number | null,
  now: () => number,
  wait: (milliseconds: number) => Promise<void>,
): Promise<number> {
  if (lastRequestAt !== null) {
    const remaining = IMAGE_REQUEST_INTERVAL_MS - (now() - lastRequestAt);
    if (remaining > 0) await wait(remaining);
  }
  return now();
}

export async function syncCatalogImageCache(
  databasePath: string,
  options: CatalogImageSyncOptions = {},
): Promise<CatalogImageSyncResult> {
  if (!isAbsolute(databasePath)) throw new CatalogImagesError("invalid_database_path");
  const cacheDirectory = options.cacheDirectory ?? cardImageCacheDirectory(databasePath);
  const fetchImage = options.fetchImage ?? fetch;
  const now = options.now ?? Date.now;
  const wait = options.wait ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const lockPath = join(cacheDirectory, IMAGE_LOCK_FILE);
  let lockHandle: FileHandle | undefined;
  try {
    await mkdir(cacheDirectory, { recursive: true, mode: 0o750 });
    lockHandle = await open(lockPath, "wx", 0o600);
    await lockHandle.writeFile(`${new Date().toISOString()} pid=${process.pid}\n`);
  } catch (error) {
    if (lockHandle) {
      await lockHandle.close().catch(() => undefined);
      await unlink(lockPath).catch(() => undefined);
    }
    const code = (error as NodeJS.ErrnoException).code;
    throw new CatalogImagesError(code === "EEXIST" ? "image_import_locked" : "image_import_unavailable");
  }

  try {
    try {
      const database = new Database(databasePath, { readonly: true, fileMustExist: true });
      let sourceRows: Array<{ source_id: string }>;
      try {
        sourceRows = database.prepare(
          "SELECT source_id FROM cards WHERE source = ? AND source_id IS NOT NULL",
        ).all("ygoprodeck") as Array<{ source_id: string }>;
      } finally {
        database.close();
      }
      const sourceIds = [...new Set(sourceRows.map((row) => row.source_id).filter((id) => /^\d+$/.test(id)))];
      const result: CatalogImageSyncResult = { downloaded: 0, cached: 0, unavailable: 0 };
      let lastRequestAt: number | null = null;

      for (let index = 0; index < sourceIds.length; index += 1) {
        const sourceId = sourceIds[index];
        if (await readCachedCardImage(cacheDirectory, sourceId)) {
          result.cached += 1;
          continue;
        }

        lastRequestAt = await waitForInterval(lastRequestAt, now, wait);
        try {
          const image = await downloadJpeg(sourceId, fetchImage);
          const temporaryPath = join(cacheDirectory, `.${sourceId}.${randomUUID()}.tmp`);
          try {
            await writeFile(temporaryPath, image, { mode: 0o640, flag: "wx" });
            await rename(temporaryPath, join(cacheDirectory, `${sourceId}.jpg`));
          } catch {
            await unlink(temporaryPath).catch(() => undefined);
            throw new CatalogImagesError("image_cache_write_failed");
          }
          result.downloaded += 1;
        } catch (error) {
          if (error instanceof CatalogImagesError && error.errorCode === "image_not_found") {
            result.unavailable += 1;
          } else {
            throw error instanceof CatalogImagesError ? error : new CatalogImagesError("image_download_failed");
          }
        }
        options.onProgress?.(index + 1, sourceIds.length);
      }
      return result;
    } catch (error) {
      if (error instanceof CatalogImagesError) throw error;
      throw new CatalogImagesError("image_import_failed");
    }
  } finally {
    await lockHandle.close().catch(() => undefined);
    await unlink(lockPath).catch(() => undefined);
  }
}
