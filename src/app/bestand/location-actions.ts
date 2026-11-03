"use server";

import { revalidatePath } from "next/cache";
import { withActionWriteAccess } from "../../server/access";
import { LocationError, createLocation, deleteLocation, moveLocation, renameLocation } from "../../server/locations";

export type LocationActionState = { ok: boolean; message: string | null; navigateTo?: string };
const messages: Record<ConstructorParameters<typeof LocationError>[0], string> = {
  invalid_name: "Der Name muss 1 bis 100 Zeichen lang sein.",
  parent_missing: "Der ausgewählte Ordner ist nicht mehr vorhanden.",
  parent_invalid: "Der ausgewählte Zielordner ist nicht zulässig.",
  cycle: "Ein Ordner kann nicht in sich selbst oder einen eigenen Unterordner verschoben werden.",
  root_protected: "Der ungeklärte Eingang kann nicht verschoben oder gelöscht werden.",
  not_empty: "Der Ordner enthält noch Karten oder Unterordner.",
  location_missing: "Der Ordner ist nicht mehr vorhanden.",
};

export async function mutateLocationAction(_previous: LocationActionState, form: FormData): Promise<LocationActionState> {
  const operation = String(form.get("operation") ?? "");
  const id = String(form.get("id") ?? "");
  const result = await withActionWriteAccess(() => {
    try {
      const databasePath = process.env.DATABASE_PATH;
      if (!databasePath) throw new Error("database unavailable");
      let navigateTo: string | undefined;
      if (operation === "create") createLocation(databasePath, String(form.get("name") ?? ""), String(form.get("parentId") ?? "") || null);
      else if (operation === "rename") renameLocation(databasePath, id, String(form.get("name") ?? ""));
      else if (operation === "move") moveLocation(databasePath, id, String(form.get("parentId") ?? "") || null);
      else if (operation === "delete") {
        const selectedId = String(form.get("currentLocationId") ?? "");
        const parentId = deleteLocation(databasePath, id);
        if (selectedId === id) navigateTo = parentId ? `/bestand?locationId=${encodeURIComponent(parentId)}` : "/bestand";
      } else return { state: { ok: false, message: "Die Aktion ist nicht zulässig." } };
      revalidatePath("/bestand");
      revalidatePath("/");
      return { state: { ok: true, message: operation === "create" ? "Ordner angelegt." : operation === "rename" ? "Name gespeichert." : operation === "move" ? "Ordner verschoben." : "Ordner gelöscht.", ...(navigateTo ? { navigateTo } : {}) } };
    } catch (error) {
      if (error instanceof LocationError) return { state: { ok: false, message: messages[error.code] } };
      throw error;
    }
  });
  if (!result.ok) return { ok: false, message: `${result.error} Request-ID: ${result.requestId}` };
  return result.value.state;
}
