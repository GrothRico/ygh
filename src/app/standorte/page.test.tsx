import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LocationsPage from "./page";

const mocks = vi.hoisted(() => ({ requireReadAccess: vi.fn(), redirect: vi.fn() }));
vi.mock("../../server/access", () => ({ requireReadAccess: mocks.requireReadAccess }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

describe("Standorte-Weiterleitung", () => {
  beforeEach(() => { mocks.requireReadAccess.mockReset(); mocks.redirect.mockReset(); });
  it("leitet nach erfolgreicher Identitätsprüfung zur Bestandsansicht weiter", async () => {
    mocks.requireReadAccess.mockResolvedValue({ id: "synthetic-user", displayName: "Test", role: "user", authMode: "tailscale" });
    await LocationsPage();
    expect(mocks.requireReadAccess).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/bestand");
  });
  it("zeigt bei fehlender Identität die neutrale Zugriffssperre und leitet nicht weiter", async () => {
    mocks.requireReadAccess.mockRejectedValue(new Error("denied"));
    const markup = renderToStaticMarkup(await LocationsPage());
    expect(markup).toContain("Zugriff verweigert.");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
