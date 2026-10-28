import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("PWA-Manifest", () => {
  it("beschreibt eine online verfügbare, eigenständig startende Anwendung mit lokalen Icons", () => {
    const result = manifest();

    expect(result).toMatchObject({
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
      name: "YGH · Yu-Gi-Oh!-Sammlung",
      short_name: "YGH",
    });
    expect(result.icons).toEqual([
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ]);

    for (const [filename, expectedSize] of [
      ["icon-192.png", 192],
      ["icon-512.png", 512],
      ["apple-touch-icon.png", 180],
    ] as const) {
      const png = readFileSync(join(process.cwd(), "public/icons", filename));
      expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      expect(png.readUInt32BE(16)).toBe(expectedSize);
      expect(png.readUInt32BE(20)).toBe(expectedSize);
    }
  });
});
