import type { StockRow } from "../../server/stock";

export type StockSelectionGroup = {
  key: string;
  rows: StockRow[];
  representative: StockRow;
  total: number;
};

export type SelectedStockGroup = { key: string; rows: StockRow[]; quantity: string };

export function groupEquivalentStockRows(rows: StockRow[]): StockSelectionGroup[] {
  const groups = new Map<string, StockSelectionGroup>();
  for (const row of rows) {
    const key = JSON.stringify([
      row.cardId,
      row.variantId,
      row.printingId,
      row.sourceObservationId,
      row.language,
      row.edition,
      row.locationId,
    ]);
    const group = groups.get(key);
    if (group) {
      group.rows.push(row);
      group.total += row.quantity;
    } else {
      groups.set(key, { key, rows: [row], representative: row, total: row.quantity });
    }
  }
  return [...groups.values()].map((group) => ({
    ...group,
    rows: [...group.rows].sort((left, right) => left.id.localeCompare(right.id)),
  }));
}

export function allocateStockSelection(selection: SelectedStockGroup): Array<{ id: string; expectedVersion: number; quantity: number }> | null {
  if (!/^\d+$/.test(selection.quantity)) return null;
  const requested = Number(selection.quantity);
  if (!Number.isSafeInteger(requested) || requested < 1) return null;
  const rows = [...selection.rows].sort((left, right) => left.id.localeCompare(right.id));
  if (!rows.length || rows.some((row) => !Number.isSafeInteger(row.quantity) || row.quantity < 1)) return null;
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  if (!Number.isSafeInteger(total) || requested > total) return null;

  let remaining = requested;
  const moves: Array<{ id: string; expectedVersion: number; quantity: number }> = [];
  for (const row of rows) {
    if (remaining === 0) break;
    const quantity = Math.min(remaining, row.quantity);
    moves.push({ id: row.id, expectedVersion: row.version, quantity });
    remaining -= quantity;
  }
  return remaining === 0 ? moves : null;
}

export function selectionReferenceLabel(row: StockRow): string {
  return [
    row.confirmedCode ?? row.observationCode,
    row.setName,
    row.rarity,
    row.artworkKey && row.artworkKey !== "default" ? `Artwork ${row.artworkKey}` : null,
  ].filter(Boolean).join(" · ");
}
