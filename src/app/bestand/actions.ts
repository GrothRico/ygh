"use server";

import { revalidatePath } from "next/cache";
import { withActionWriteAccess } from "../../server/access";
import { currentRequestId } from "../../server/logging";
import { correctStock, getStockChoices, recordStock, StockError, type StockInput } from "../../server/stock";

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
export async function mutateStockAction(_previous: StockActionState, form: FormData): Promise<StockActionState> {
  const operation = String(form.get("operation") ?? "");
  const result = await withActionWriteAccess((user) => {
    try {
      const databasePath = process.env.DATABASE_PATH;
      if (!databasePath) throw new Error("database unavailable");
      const input = inputFrom(databasePath, form);
      const requestId = currentRequestId();
      if (!requestId) throw new Error("request context unavailable");
      if (operation === "create") recordStock(databasePath, input, user.id, requestId);
      else if (operation === "correct") correctStock(databasePath, String(form.get("id") ?? ""), Number(form.get("version")), input, user.id, requestId);
      else return { ok: false, message: "Die Aktion ist nicht zulässig." };
      revalidatePath("/bestand");
      revalidatePath("/");
      return { ok: true, message: operation === "create" ? "Bestand erfasst." : "Bestand korrigiert; Verlauf gespeichert." };
    } catch (error) {
      if (error instanceof StockError) return { ok: false, message: messages[error.code] };
      throw error;
    }
  });
  if (!result.ok) return { ok: false, message: `${result.error} Request-ID: ${result.requestId}` };
  return result.value;
}
