"use server";

import { revalidatePath } from "next/cache";
import { withActionWriteAccess } from "../../server/access";
import { currentRequestId } from "../../server/logging";
import { correctStock, getStockChoices, moveStock, moveStocks, recordStock, StockError, type StockInput, type StockMove } from "../../server/stock";

export type StockActionState = { message: string | null; ok: boolean };
const messages: Record<ConstructorParameters<typeof StockError>[0], string> = {
  invalid_input: "Bitte alle Angaben prüfen. Die Menge muss eine positive ganze Zahl sein.",
  card_missing: "Die Karte ist nicht mehr vorhanden.",
  variant_mismatch: "Die bestätigte Variante gehört nicht zu dieser Karte oder passt nicht zur Edition.",
  printing_mismatch: "Der Druck gehört nicht zur ausgewählten Variante oder passt nicht zur Sprache.",
  observation_mismatch: "Die unbestätigte Druckangabe gehört nicht zu dieser Karte.",
  location_missing: "Der Standort ist nicht mehr vorhanden.",
  stock_missing: "Dieser Bestand ist nicht mehr vorhanden.",
  stale_version: "Der Bestand wurde zwischenzeitlich geändert. Bitte neu laden und erneut prüfen.",
  invalid_move_quantity: "Die Verschiebemenge muss eine positive ganze Zahl sein.",
  move_quantity_exceeds_stock: "Die Verschiebemenge ist größer als der aktuelle Bestand.",
  same_location: "Quell- und Zielordner müssen verschieden sein.",
};
function inputFrom(databasePath: string, form: FormData): StockInput {
  const number = Number(form.get("quantity"));
  const cardId = String(form.get("cardId") ?? "");
  const reference = String(form.get("reference") ?? "");
  const selected = reference ? getStockChoices(databasePath, cardId).find((choice) => `${choice.kind}:${choice.id}` === reference) : undefined;
  if (reference && !selected) throw new StockError("invalid_input");
  return {
    cardId,
    variantId: selected?.kind === "variant" || selected?.kind === "printing" ? selected.variantId : null,
    printingId: selected?.kind === "printing" ? selected.id : null,
    sourceObservationId: selected?.kind === "observation" ? selected.id : null,
    language: String(form.get("language") ?? "unknown") as StockInput["language"],
    edition: selected && selected.edition && selected.kind !== "observation" && String(form.get("edition") ?? "unknown") === "unknown"
      ? selected.edition as StockInput["edition"]
      : String(form.get("edition") ?? "unknown") as StockInput["edition"],
    locationId: String(form.get("locationId") ?? ""),
    quantity: number,
  };
}
function movesFrom(value: FormDataEntryValue | null): StockMove[] {
  if (typeof value !== "string") throw new StockError("invalid_input");
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new StockError("invalid_input"); }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new StockError("invalid_input");
  const moves: StockMove[] = [];
  for (const item of parsed) {
    if (!isMoveRecord(item)) throw new StockError("invalid_input");
    moves.push({ id: item.id, expectedVersion: item.expectedVersion, quantity: item.quantity });
  }
  return moves;
}
function isMoveRecord(value: unknown): value is StockMove {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    "id" in value && typeof value.id === "string" &&
    "expectedVersion" in value && typeof value.expectedVersion === "number" &&
    "quantity" in value && typeof value.quantity === "number";
}
export async function mutateStockAction(_previous: StockActionState, form: FormData): Promise<StockActionState> {
  const operation = String(form.get("operation") ?? "");
  const result = await withActionWriteAccess((user) => {
    try {
      const databasePath = process.env.DATABASE_PATH;
      if (!databasePath) throw new Error("database unavailable");
      const requestId = currentRequestId();
      if (!requestId) throw new Error("request context unavailable");
      if (operation === "move") moveStock(databasePath, String(form.get("id") ?? ""), Number(form.get("version")), String(form.get("destinationId") ?? ""), Number(form.get("quantity")), user.id, requestId);
      else if (operation === "move_many") moveStocks(databasePath, movesFrom(form.get("moves")), String(form.get("destinationId") ?? ""), user.id, requestId);
      else if (operation === "create") recordStock(databasePath, inputFrom(databasePath, form), user.id, requestId);
      else if (operation === "correct") correctStock(databasePath, String(form.get("id") ?? ""), Number(form.get("version")), inputFrom(databasePath, form), user.id, requestId);
      else return { ok: false, message: "Die Aktion ist nicht zulässig." };
      revalidatePath("/bestand");
      revalidatePath("/");
      return { ok: true, message: operation === "create" ? "Bestand erfasst." : operation === "move" || operation === "move_many" ? "Bestand verschoben; Verlauf gespeichert." : "Bestand korrigiert; Verlauf gespeichert." };
    } catch (error) {
      if (error instanceof StockError) return { ok: false, message: messages[error.code] };
      throw error;
    }
  });
  if (!result.ok) return { ok: false, message: `${result.error} Request-ID: ${result.requestId}` };
  return result.value;
}
