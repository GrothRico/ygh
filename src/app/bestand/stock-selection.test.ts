import { describe, expect, it } from "vitest";
import type { StockRow } from "../../server/stock";
import { allocateStockSelection, groupEquivalentStockRows } from "./stock-selection";

function row(id: string, overrides: Partial<StockRow> = {}): StockRow {
  return {
    id, cardId: "card", variantId: null, printingId: null, sourceObservationId: "observation", language: "en", edition: "first", locationId: "location",
    quantity: 1, version: id === "a" ? 2 : 6, cardName: "Karte", cardImageId: null, locationName: "Ordner", printingCode: null, confirmedCode: null,
    rarity: "Common", artworkKey: null, observationCode: "SET-1", setName: "Set", ...overrides,
  };
}

describe("Auswahl identischer physischer Bestände", () => {
  it("gruppiert Zeilen mit identischer physischer Identität samt Gesamtmenge", () => {
    const groups = groupEquivalentStockRows([row("b"), row("a")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ total: 2, rows: [{ id: "a", version: 2 }, { id: "b", version: 6 }] });
  });

  it("teilt eine Teilmenge stabil auf und bewahrt die Version jeder verwendeten Zeile", () => {
    const rows = [row("b"), row("a")];
    const key = groupEquivalentStockRows(rows)[0].key;
    expect(allocateStockSelection({ key, rows, quantity: "1" })).toEqual([{ id: "a", expectedVersion: 2, quantity: 1 }]);
    expect(allocateStockSelection({ key, rows, quantity: "2" })).toEqual([
      { id: "a", expectedVersion: 2, quantity: 1 }, { id: "b", expectedVersion: 6, quantity: 1 },
    ]);
  });

  it("verteilt eine angeforderte Menge über mehrere Zeilen ohne Überschreitung", () => {
    const rows = [row("a", { quantity: 4 }), row("b", { quantity: 3 })];
    const key = groupEquivalentStockRows(rows)[0].key;
    expect(allocateStockSelection({ key, rows, quantity: "5" })).toEqual([
      { id: "a", expectedVersion: 2, quantity: 4 }, { id: "b", expectedVersion: 6, quantity: 1 },
    ]);
  });

  it("trennt Sprache, Edition, Druck, Beobachtung und Standort", () => {
    const groups = groupEquivalentStockRows([
      row("base"), row("language", { language: "de" }), row("edition", { edition: "unlimited" }),
      row("printing", { printingId: "printing" }), row("observation", { sourceObservationId: "other-observation" }),
      row("location", { locationId: "other-location" }),
    ]);
    expect(groups).toHaveLength(6);
  });

  it("trennt identisch sichtbare Codes mit unterschiedlichen Beobachtungs-IDs", () => {
    expect(groupEquivalentStockRows([row("one"), row("two", { sourceObservationId: "observation-2" })])).toHaveLength(2);
  });

  it.each(["0", "-1", "1.5", "9007199254740992", "3", ""])("weist ungültige oder übergroße Mengen %s ab", (quantity) => {
    const rows = [row("a"), row("b")];
    const key = groupEquivalentStockRows(rows)[0].key;
    expect(allocateStockSelection({ key, rows, quantity })).toBeNull();
  });
});
