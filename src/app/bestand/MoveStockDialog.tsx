"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LocationRow } from "../../server/locations";
import type { StockMove } from "../../server/stock";
import { allocateStockSelection, selectionReferenceLabel, type SelectedStockGroup } from "./stock-selection";
import { mutateStockAction, type StockActionState } from "./actions";
import { locationPath } from "./form-utils";

const initialState: StockActionState = { ok: false, message: null };
export type SelectedMove = SelectedStockGroup;

function TargetBranch({ locations, parentId, sourceIds, selectedId, onSelect }: {
  locations: LocationRow[]; parentId: string | null; sourceIds: Set<string>; selectedId: string; onSelect: (id: string) => void;
}) {
  const children = locations.filter((location) => location.parentId === parentId);
  if (!children.length) return null;
  return <ul>{children.map((location) => {
    const disabled = sourceIds.has(location.id);
    return <li key={location.id}>
      <label><input type="radio" name="destinationId" required value={location.id} disabled={disabled} checked={selectedId === location.id} onChange={() => onSelect(location.id)} />{location.name}{disabled ? " (Quelle einer Auswahl)" : ""}</label>
      <TargetBranch locations={locations} parentId={location.id} sourceIds={sourceIds} selectedId={selectedId} onSelect={onSelect} />
    </li>;
  })}</ul>;
}

function MoveForm({ selections, visibleRowIds, visibleRowsByKey, locations, titleId, onCancel, onSuccess, onRefresh }: {
  selections: SelectedMove[]; visibleRowIds: Set<string>; visibleRowsByKey: Record<string, string[]>; locations: LocationRow[]; titleId: string; onCancel: () => void; onSuccess: () => void; onRefresh: () => void;
}) {
  const [destinationId, setDestinationId] = useState("");
  const [state, action, pending] = useActionState(async (previous: StockActionState, formData: FormData) => {
    const result = await mutateStockAction(previous, formData);
    if (result.ok) onSuccess();
    return result;
  }, initialState);
  const sourceIds = new Set(selections.flatMap(({ rows }) => rows.map((row) => row.locationId)));
  const allocatedMoves = selections.map(allocateStockSelection);
  const moves: StockMove[] = allocatedMoves.flatMap((allocation) => allocation ?? []);
  const movesValid = selections.length > 0 && allocatedMoves.every((allocation) => allocation !== null) && selections.every(({ key, rows }) => {
    const currentIds = visibleRowsByKey[key];
    return currentIds !== undefined && rows.every((row) => visibleRowIds.has(row.id)) && currentIds.length === rows.length && currentIds.every((id) => rows.some((row) => row.id === id));
  });
  return <form action={action} onReset={(event) => event.preventDefault()} className="folder-dialog-content">
    <input type="hidden" name="operation" value="move_many" />
    <input type="hidden" name="moves" value={JSON.stringify(moves)} />
    <h2 id={titleId}>Auswahl verschieben</h2>
    <ul className="bulk-move-summary">{selections.map(({ rows, quantity, key }) => {
      const row = rows[0];
      const location = locations.find((candidate) => candidate.id === row.locationId);
      const detail = [...new Set(rows.map(selectionReferenceLabel).filter(Boolean))].join(" / ");
      const edition = row.edition === "first" ? "1st Edition" : row.edition === "unlimited" ? "Unlimited" : row.edition === "not_applicable" ? "Nicht anwendbar" : "Edition unbekannt";
      const total = rows.reduce((sum, candidate) => sum + candidate.quantity, 0);
      return <li key={key}><strong>{row.cardName} · {row.language === "de" ? "Deutsch" : row.language === "en" ? "Englisch" : "Sprache unbekannt"} · {edition}</strong>{detail && <span>{detail}</span>}<span>{quantity} von {total} · {location ? locationPath(location, locations) : `Standort-ID ${row.locationId}`}</span></li>;
    })}</ul>
    <p className="bulk-move-count">{selections.length} {selections.length === 1 ? "Bestand" : "Bestände"} ausgewählt</p>
    <fieldset className="move-targets"><legend>Zielordner</legend><TargetBranch locations={locations} parentId={null} sourceIds={sourceIds} selectedId={destinationId} onSelect={setDestinationId} /></fieldset>
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "form-success" : "form-error"}>{state.message}{state.message.includes("zwischenzeitlich geändert") && <button type="button" className="move-refresh" onClick={onRefresh}>Neu laden</button>}</p>}
    <div className="folder-dialog-buttons"><button type="button" onClick={onCancel}>{state.ok ? "Schließen" : "Abbrechen"}</button><button type="submit" disabled={pending || state.ok || !destinationId || !movesValid}>Verschieben</button></div>
  </form>;
}

export function MoveStockDialog({ selections, visibleRowIds, visibleRowsByKey, locations, onClear, onSuccess }: {
  selections: SelectedMove[]; visibleRowIds: Set<string>; visibleRowsByKey: Record<string, string[]>; locations: LocationRow[]; onClear: () => void; onSuccess: () => void;
}) {
  const [snapshot, setSnapshot] = useState<SelectedMove[] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const router = useRouter();
  const valid = selections.length > 0 && selections.every((selection) => {
    const currentIds = visibleRowsByKey[selection.key];
    return allocateStockSelection(selection) !== null && currentIds !== undefined && selection.rows.every((row) => visibleRowIds.has(row.id)) && currentIds.length === selection.rows.length && currentIds.every((id) => selection.rows.some((row) => row.id === id));
  });
  useEffect(() => {
    if (snapshot && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!snapshot && dialog.current?.open) dialog.current.close();
  }, [snapshot]);
  function close() {
    setSnapshot(null);
    requestAnimationFrame(() => trigger.current?.isConnected && trigger.current.focus());
  }
  function succeeded() {
    onSuccess();
    close();
    router.refresh();
  }
  return <>
    <button ref={trigger} type="button" className="bulk-move-trigger" aria-label="Auswahl verschieben" title={selections.length === 0 ? "Keine Karte ausgewählt" : valid ? "Auswahl verschieben" : "Verschiebemengen prüfen"} disabled={!valid} onClick={() => setSnapshot(selections.map((selection) => ({ ...selection, rows: selection.rows.map((row) => ({ ...row })) })))}>
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3.5 6.5h6l2 2h9v9.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18z" /><path d="M12 12v5m-2-2 2 2 2-2" /></svg>
    </button>
    <span className="bulk-move-count" aria-live="polite">{selections.length ? `${selections.length} ${selections.length === 1 ? "Bestand" : "Bestände"} ausgewählt` : ""}</span>
    {selections.length > 0 && <button type="button" className="bulk-move-clear" onClick={onClear}>Auswahl leeren</button>}
    <dialog ref={dialog} className="folder-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => requestAnimationFrame(() => trigger.current?.isConnected && trigger.current.focus())}>
      {snapshot && <MoveForm key={snapshot.map(({ key, rows }) => `${key}:${rows.map((row) => `${row.id}:${row.version}`).join(",")}`).join("|")} selections={snapshot} visibleRowIds={visibleRowIds} visibleRowsByKey={visibleRowsByKey} locations={locations} titleId={titleId} onCancel={close} onSuccess={succeeded} onRefresh={() => { close(); onClear(); router.refresh(); }} />}
    </dialog>
  </>;
}
