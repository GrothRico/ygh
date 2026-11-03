import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const { requireReadAccess } = vi.hoisted(() => ({
  requireReadAccess: vi.fn(),
}));
const { searchCards, listLocations, getStockChoices } = vi.hoisted(() => ({ searchCards: vi.fn(), listLocations: vi.fn(), getStockChoices: vi.fn() }));

vi.mock("../server/access", () => ({ requireReadAccess }));
vi.mock("../server/catalog/search", () => ({ MAX_SEARCH_RESULTS: 30, searchCards }));
vi.mock("../server/locations", () => ({ listLocations }));
vi.mock("../server/stock", () => ({ getStockChoices }));
vi.mock("server-only", () => ({}));

describe("Startseite nach erfolgreicher Prüfung", () => {
  beforeEach(() => { requireReadAccess.mockReset(); searchCards.mockReset(); listLocations.mockReset(); getStockChoices.mockReset(); });

  it("rendert den deutschen privaten Einstieg", async () => {
    requireReadAccess.mockResolvedValue({ id: "synthetic-user", role: "user", authMode: "tailscale" });
    const markup = renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain("Deine Yu-Gi-Oh!-Sammlung");
    expect(markup).toContain("private Sammlungsverwaltung");
    expect(markup).toContain("Finde Karten über deutschen oder englischen Namen und gedruckte Codes.");
    expect(markup).toContain('name="q"');
    expect(markup).toContain('aria-label="Hauptnavigation"');
    expect(markup).toContain('href="#start" aria-current="page"');
    expect(markup).toContain('href="#inhalt"');
    expect(markup).not.toContain("Abmelden");
    expect(markup).not.toContain("Decks");
    expect(markup).not.toContain("Cubes");
    expect(markup).not.toContain("Request-ID:");
    expect(requireReadAccess).toHaveBeenCalledOnce();
  });

  it("kennzeichnet lokalen Testzugang dauerhaft mit Testbenutzer und Rolle", async () => {
    requireReadAccess.mockResolvedValue({
      id: "synthetic-admin",
      displayName: "Lokaler Test-Admin",
      role: "admin",
      authMode: "local",
    });
    const markup = renderToStaticMarkup(await HomePage());

    expect(markup).toContain('role="status"');
    expect(markup).toContain("Lokale Entwicklung · Lokaler Test-Admin (Admin) · nur synthetische Daten");
    expect(markup).toContain('name="q"');
    expect(markup).not.toContain("Tailscale-Verbindung");
  });

  it("rendert pro geschütztem Suchtreffer ein vollständiges Erfassungsformular auf derselben Seite", async () => {
    requireReadAccess.mockResolvedValue({ id: "synthetic-user", role: "user", authMode: "tailscale" });
    searchCards.mockReturnValue([{ id: "card-7", nameDe: "Testkarte", nameEn: "Test Card", sourceId: "7", rank: 0, printings: [], morePrintings: 0 }]);
    listLocations.mockReturnValue([{ id: "location-1", name: "Schublade", kind: "folder", parentId: null }]);
    getStockChoices.mockReturnValue([]);
    vi.stubEnv("DATABASE_PATH", "/synthetic/database.sqlite");
    try {
      const markup = renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({ q: "Testkarte" }) }));
      expect(markup).toContain('name="cardId" value="card-7"');
      expect(markup).toContain('name="operation" value="create"');
      expect(markup).toContain('name="reference"');
      expect(markup).toContain('name="language"');
      expect(markup).toContain('name="edition"');
      expect(markup).toContain('name="quantity"');
      expect(markup).toContain('name="locationId"');
      expect(markup).toContain("Hinzufügen");
      expect(markup).not.toContain("/bestand?cardId=");
      expect(listLocations).toHaveBeenCalledOnce();
      expect(getStockChoices).toHaveBeenCalledWith("/synthetic/database.sqlite", "card-7");
    } finally { vi.unstubAllEnvs(); }
  });

  it("liest weder Standorte noch Varianten vor erfolgreicher Identitätsprüfung", async () => {
    requireReadAccess.mockRejectedValue(new Error("denied"));
    const markup = renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({ q: "Testkarte" }) }));
    expect(markup).toContain("Zugriff verweigert.");
    expect(searchCards).not.toHaveBeenCalled();
    expect(listLocations).not.toHaveBeenCalled();
    expect(getStockChoices).not.toHaveBeenCalled();
  });
});
