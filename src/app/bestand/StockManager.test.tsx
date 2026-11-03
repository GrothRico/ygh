import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StockManager } from "./StockManager";

vi.mock("./actions", () => ({ mutateStockAction: vi.fn() }));
vi.mock("./location-actions", () => ({ mutateLocationAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("../CardArtwork", () => ({ CardArtwork: () => <span /> }));

const locations = [
  { id: "unknown", name: "Ungeklärt", kind: "unknown" as const, parentId: null },
  { id: "root-a", name: "Rico", kind: "folder" as const, parentId: null },
  { id: "box", name: "Blaue Box", kind: "folder" as const, parentId: "root-a" },
  { id: "binder", name: "Binder", kind: "folder" as const, parentId: "box" },
  { id: "root-b", name: "Remo", kind: "folder" as const, parentId: null },
];
const group = { key: "card", cardId: "card-a", cardName: "Karte", cardImageId: null, edition: "unknown" as const, locationId: "binder", locationName: "Binder", total: 1, languageCounts: { unknown: 1, de: 0, en: 0 }, rows: [] };
function renderAt(locationId: string | null, invalidLocation = false) {
  return renderToStaticMarkup(<StockManager groups={[group]} hasNextPage={false} page={0} locations={locations} choicesByCard={{}} cardId="card-a" cardName="Erfassungskarte" cardNameEn={null} activityByStock={{}} locationId={locationId} invalidLocation={invalidLocation} />);
}

describe("Bestandsordner und Karteikarten", () => {
  it("zeigt Root-Ordner kompakt mit Aktionen und Ordneranlage-Dialogauslöser", () => {
    const root = renderAt(null);
    expect(root).toContain('href="/bestand?locationId=root-a"');
    expect(root).toContain('href="/bestand?locationId=root-b"');
    expect(root).not.toContain('href="/bestand?locationId=box"');
    expect(root).toContain("Umbenennen");
    expect(root).toContain("Bewegen");
    expect(root).toContain("Löschen");
    expect(root).toContain('aria-label="Ordner anlegen"');
    expect(root).not.toContain('name="name"');
    expect(root).not.toContain("Person ·");
  });
  it("zeigt Breadcrumb, Parent-Pfeil und aktuelle Ordneraktionen ohne alten Hinweisblock", () => {
    const markup = renderAt("box");
    expect(markup).toContain('aria-label="Ordnerpfad"');
    expect(markup).toContain('href="/bestand?locationId=root-a"');
    expect(markup).toContain('href="/bestand?locationId=box"');
    expect(markup).toContain('href="/bestand?locationId=binder"');
    expect(markup).toContain('aria-label="Zum übergeordneten Ordner Rico"');
    expect(markup).not.toContain("Eine Ebene höher");
    expect(markup).not.toContain("Aktueller Ordner");
    expect(markup).toContain('aria-label="Aktionen für Blaue Box"');
    expect(markup).not.toContain("Physisch bei mir");
    expect(markup).not.toContain("Standortfilter");
    expect(markup).not.toContain("Person ·");
  });
  it("erhält den bestätigten Standort im Korrekturformular und versteckt Details kompakt", () => {
    const markup = renderToStaticMarkup(<StockManager groups={[{
      ...group, locationId: "binder", locationName: "Binder", rows: [{ id: "stock-a", cardId: "card-a", variantId: null, printingId: null, sourceObservationId: null, language: "de", edition: "unknown", locationId: "binder", quantity: 1, version: 1, cardName: "Karte", cardImageId: null, locationName: "Binder", printingCode: null, confirmedCode: null, rarity: null, artworkKey: null, observationCode: null, setName: null }],
    }]} hasNextPage={false} page={0} locations={locations} choicesByCard={{}} cardId={null} cardName={null} cardNameEn={null} activityByStock={{}} locationId={null} invalidLocation={false} />);
    expect(markup).toContain('<input type="hidden" name="locationId" value="binder"/>');
    expect(markup).toContain('name="locationId" required="" disabled=""');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('id="stock-details-card" hidden=""');
  });
  it("meldet ungültige Navigation statt veraltete Karten weiter anzuzeigen", () => {
    const markup = renderAt("foreign-id", true);
    expect(markup).toContain("Der gewählte Ordner ist ungültig");
    expect(markup).not.toContain("Erfassungskarte");
    expect(markup).not.toContain('id="capture-title"');
  });
});
