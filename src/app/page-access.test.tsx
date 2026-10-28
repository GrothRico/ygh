import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

let temporaryDirectory: string;

beforeEach(() => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "ygh-p105-page-"));
  vi.stubEnv("TAILSCALE_RICO_LOGIN", "rico-test@example.invalid");
  vi.stubEnv("TAILSCALE_SECOND_USER_LOGIN", "second-test@example.invalid");
  vi.stubEnv("DATABASE_PATH", join(temporaryDirectory, "test.sqlite"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("Startseitenzugriff", () => {
  it("zeigt bei fehlender Identität die korrelierte ID ohne private Inhalte", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const markup = renderToStaticMarkup(await HomePage());
      const requestId = markup.match(/Request-ID: ([0-9a-f-]{36})/)?.[1];
      const logs = [...stdout.mock.calls, ...stderr.mock.calls].map(([chunk]) => String(chunk)).join("");

      expect(markup).toContain("Zugriff verweigert.");
      expect(markup).not.toContain("private Sammlungsverwaltung");
      expect(markup).not.toContain("Deine Yu-Gi-Oh!-Sammlung");
      expect(requestId).toBeTruthy();
      expect(logs).toContain(requestId);
      expect(logs).toContain('"event":"auth.denied"');
      expect(logs).toContain('"reason":"missing_identity"');
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });
});
