import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./page";

const { requireReadAccess } = vi.hoisted(() => ({
  requireReadAccess: vi.fn(),
}));

vi.mock("../server/access", () => ({ requireReadAccess }));
vi.mock("server-only", () => ({}));

describe("Startseite nach erfolgreicher Prüfung", () => {
  beforeEach(() => requireReadAccess.mockReset());

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
});
