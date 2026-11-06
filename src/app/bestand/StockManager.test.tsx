import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { StockManager } from "./StockManager";
import { MoveStockDialog } from "./MoveStockDialog";

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
  it("zeigt auswählbare physische Sprachzeilen samt Mengenfeld außerhalb eingeklappter Details", () => {
    const rows = [
      { id: "de-row", cardId: "card-a", variantId: null, printingId: null, sourceObservationId: null, language: "de" as const, edition: "unknown" as const, locationId: "binder", quantity: 5, version: 2, cardName: "Prüfdrache", cardImageId: null, locationName: "Binder", printingCode: null, confirmedCode: "DR-01", rarity: null, artworkKey: null, observationCode: null, setName: null },
      { id: "en-row", cardId: "card-a", variantId: null, printingId: null, sourceObservationId: null, language: "en" as const, edition: "unknown" as const, locationId: "binder", quantity: 4, version: 1, cardName: "Prüfdrache", cardImageId: null, locationName: "Binder", printingCode: null, confirmedCode: "DR-01", rarity: null, artworkKey: null, observationCode: null, setName: null },
    ];
    const markup = renderToStaticMarkup(<StockManager groups={[{ ...group, cardName: "Prüfdrache", rows }]} hasNextPage={false} page={0} locations={locations} choicesByCard={{}} cardId={null} cardName={null} cardNameEn={null} activityByStock={{}} locationId={null} invalidLocation={false} />);
    expect(markup).toContain('aria-label="Auswahl verschieben"');
    expect(markup).toContain('aria-label="Prüfdrache, Deutsch, Unbekannt, DR-01 auswählen"');
    expect(markup).toContain('aria-label="Prüfdrache, Englisch, Unbekannt, DR-01: Verschiebemenge"');
    expect(markup.indexOf("aria-label=\"Prüfdrache, Deutsch, Unbekannt, DR-01 auswählen\"")).toBeLessThan(markup.indexOf('id="stock-details-card" hidden=""'));
    expect(markup).not.toContain(">Verschieben</button>");
  });
  it("zeigt identische physische Zeilen als eine Auswahl mit aggregierter Menge außerhalb der Details", () => {
    const rows = [
      { id: "stock-a", cardId: "card-a", variantId: null, printingId: null, sourceObservationId: "same-observation", language: "en" as const, edition: "first" as const, locationId: "binder", quantity: 1, version: 2, cardName: "Prüfdrache", cardImageId: null, locationName: "Binder", printingCode: null, confirmedCode: null, rarity: "Common", artworkKey: null, observationCode: "SET-1", setName: "Set" },
      { id: "stock-b", cardId: "card-a", variantId: null, printingId: null, sourceObservationId: "same-observation", language: "en" as const, edition: "first" as const, locationId: "binder", quantity: 1, version: 6, cardName: "Prüfdrache", cardImageId: null, locationName: "Binder", printingCode: null, confirmedCode: null, rarity: "Common", artworkKey: null, observationCode: "SET-1", setName: "Set" },
    ];
    const markup = renderToStaticMarkup(<StockManager groups={[{ ...group, cardName: "Prüfdrache", edition: "first", rows }]} hasNextPage={false} page={0} locations={locations} choicesByCard={{}} cardId={null} cardName={null} cardNameEn={null} activityByStock={{}} locationId={null} invalidLocation={false} />);
    expect(markup.match(/type="checkbox"/g)).toHaveLength(1);
    expect(markup.match(/class="stock-row-quantity"/g)).toHaveLength(1);
    expect(markup).toContain("2 verfügbar");
    expect(markup).toContain('max="2"');
    expect(markup.indexOf('aria-label="Englisch, 1st Edition, SET-1 · Set · Common auswählen"')).toBeLessThan(markup.indexOf('id="stock-details-card" hidden=""'));
  });
  it.each(["0", "-1", "1.5", "9007199254740992", "3"])("deaktiviert den Sammeldialog bei ungültiger Gruppenmenge %s", (quantity) => {
    const row = { id: "stock-a", cardId: "card-a", variantId: null, printingId: null, sourceObservationId: "observation", language: "en" as const, edition: "first" as const, locationId: "binder", quantity: 1, version: 2, cardName: "Prüfdrache", cardImageId: null, locationName: "Binder", printingCode: null, confirmedCode: null, rarity: null, artworkKey: null, observationCode: null, setName: null };
    const markup = renderToStaticMarkup(<MoveStockDialog selections={[{ key: "selection", rows: [row], quantity }]} visibleRowIds={new Set([row.id])} visibleRowsByKey={{ selection: [row.id] }} locations={locations} onClear={() => {}} onSuccess={() => {}} />);
    expect(markup).toContain('aria-label="Auswahl verschieben"');
    expect(markup).toMatch(/aria-label="Auswahl verschieben"[^>]*disabled=""/);
  });
  it("meldet ungültige Navigation statt veraltete Karten weiter anzuzeigen", () => {
    const markup = renderAt("foreign-id", true);
    expect(markup).toContain("Der gewählte Ordner ist ungültig");
    expect(markup).not.toContain("Erfassungskarte");
    expect(markup).not.toContain('id="capture-title"');
  });
});
