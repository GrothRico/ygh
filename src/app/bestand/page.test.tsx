import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import StockPage from "./page";

const mocks = vi.hoisted(() => ({ requireReadAccess: vi.fn(), listLocations: vi.fn(), listStock: vi.fn(), getStockCard: vi.fn(), getStockChoices: vi.fn(), listStockActivity: vi.fn() }));
vi.mock("../../server/access", () => ({ requireReadAccess: mocks.requireReadAccess }));
vi.mock("../../server/locations", () => ({ listLocations: mocks.listLocations }));
vi.mock("../../server/stock", () => ({ listStock: mocks.listStock, getStockCard: mocks.getStockCard, getStockChoices: mocks.getStockChoices, listStockActivity: mocks.listStockActivity }));
vi.mock("../../server/logging", () => ({ withRequestContext: (callback: (id: string) => unknown) => callback("synthetic-request-id"), logEvent: vi.fn() }));
vi.mock("./StockManager", () => ({ StockManager: () => <p>Bestand mit Formular</p> }));
vi.mock("server-only", () => ({}));

describe("Bestandsansicht", () => {
  beforeEach(() => { mocks.listLocations.mockReturnValue([]); mocks.listStock.mockReturnValue([]); });
  it("zeigt Datenbankfehler und gibt keine Erfassungsform aus", async () => {
    mocks.requireReadAccess.mockResolvedValue({ id: "synthetic-user", displayName: "Test", role: "user", authMode: "tailscale" });
    mocks.listStock.mockImplementation(() => { throw new Error("database unavailable"); });
    vi.stubEnv("DATABASE_PATH", "/synthetic/database.sqlite");
    try {
      const markup = renderToStaticMarkup(await StockPage());
      expect(markup).toContain("Bestand nicht verfügbar");
      expect(markup).toContain("Request-ID: synthetic-request-id");
      expect(markup).not.toContain("Bestand mit Formular");
    } finally { vi.unstubAllEnvs(); vi.clearAllMocks(); }
  });
  it("verlangt Identität, bevor Bestands- oder Standortdaten gelesen werden", async () => {
    mocks.requireReadAccess.mockRejectedValue(new Error("denied"));
    const markup = renderToStaticMarkup(await StockPage());
    expect(markup).toContain("Zugriff verweigert.");
    expect(markup).toContain("Request-ID: synthetic-request-id");
    expect(mocks.listStock).not.toHaveBeenCalled();
    expect(mocks.listLocations).not.toHaveBeenCalled();
  });
  it("wendet die gewählte Ordnernavigation vor dem Seitenabruf an", async () => {
    mocks.requireReadAccess.mockResolvedValue({ id: "synthetic-user", displayName: "Test", role: "user", authMode: "tailscale" });
    mocks.listLocations.mockReturnValue([{ id: "folder-a", name: "Ordner", kind: "folder", parentId: null }]);
    vi.stubEnv("DATABASE_PATH", "/synthetic/database.sqlite");
    try {
      await StockPage({ searchParams: Promise.resolve({ locationId: "folder-a", page: "2" }) });
      expect(mocks.listStock).toHaveBeenCalledWith("/synthetic/database.sqlite", 25, 50, "folder-a");
    } finally { vi.unstubAllEnvs(); vi.clearAllMocks(); }
  });
  it("fragt bei einer ungültigen Ordnernavigation keine Bestände ab", async () => {
    mocks.requireReadAccess.mockResolvedValue({ id: "synthetic-user", displayName: "Test", role: "user", authMode: "tailscale" });
    mocks.listLocations.mockReturnValue([{ id: "folder-a", name: "Ordner", kind: "folder", parentId: null }]);
    vi.stubEnv("DATABASE_PATH", "/synthetic/database.sqlite");
    try {
      await StockPage({ searchParams: Promise.resolve({ locationId: "not-a-location" }) });
      expect(mocks.listStock).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); vi.clearAllMocks(); }
  });
});
