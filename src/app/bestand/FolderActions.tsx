"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState, useId, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { LocationRow } from "../../server/locations";
import { locationPath } from "./form-utils";
import { mutateLocationAction, type LocationActionState } from "./location-actions";

const initialState: LocationActionState = { ok: false, message: null };
type DialogMode = "rename" | "move" | "delete";

function descendantsOf(locationId: string, locations: LocationRow[]): Set<string> {
  const descendants = new Set<string>([locationId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const location of locations) {
      if (location.parentId && descendants.has(location.parentId) && !descendants.has(location.id)) {
        descendants.add(location.id);
        changed = true;
      }
    }
  }
  return descendants;
}

function MoveTargets({ locations, excluded, selected, onSelect }: {
  locations: LocationRow[]; excluded: Set<string>; selected: string; onSelect: (id: string) => void;
}) {
  const children = (parentId: string | null) => locations.filter((location) => location.parentId === parentId);
  const renderBranch = (location: LocationRow): ReactNode => {
    const blocked = excluded.has(location.id);
    const nested = children(location.id);
    return <li key={location.id}>
      <label><input type="radio" name="moveTarget" checked={selected === location.id} disabled={blocked} onChange={() => onSelect(location.id)} />{location.name}{blocked && <span className="location-meta"> · aktueller Ordner oder Unterordner</span>}</label>
      {nested.length > 0 && <details className="move-target-branch" open={nested.some((child) => child.id === selected || excluded.has(child.id))}><summary>Unterordner von {location.name}</summary><ul>{nested.map(renderBranch)}</ul></details>}
    </li>;
  };
  return <fieldset className="move-targets"><legend>Zielordner</legend>
    <label><input type="radio" name="moveTarget" checked={selected === ""} onChange={() => onSelect("")} />Oberste Ebene</label>
    {children(null).length ? <ul>{children(null).map(renderBranch)}</ul> : <p>Keine Root-Ordner vorhanden.</p>}
    <input type="hidden" name="parentId" value={selected} />
  </fieldset>;
}

function FolderDialogForm({ mode, location, locations, currentLocationId, dialogId, target, onTarget, onCancel }: {
  mode: DialogMode; location: LocationRow; locations: LocationRow[]; currentLocationId: string | null; dialogId: string;
  target: string; onTarget: (value: string) => void; onCancel: () => void;
}) {
  const router = useRouter();
  const submit = useCallback(async (previous: LocationActionState, form: FormData) => {
    const result = await mutateLocationAction(previous, form);
    if (result.ok && result.navigateTo) router.replace(result.navigateTo);
    return result;
  }, [router]);
  const [state, action, pending] = useActionState(submit, initialState);
  const excluded = useMemo(() => descendantsOf(location.id, locations), [location.id, locations]);
  const heading = mode === "rename" ? "Ordner umbenennen" : mode === "move" ? "Ordner bewegen" : "Ordner löschen";
  return <form action={action} onReset={(event) => event.preventDefault()} className="folder-dialog-content">
    <input type="hidden" name="operation" value={mode} />
    <input type="hidden" name="id" value={location.id} />
    <input type="hidden" name="currentLocationId" value={currentLocationId ?? ""} />
    <h2 id={dialogId}>{heading}</h2>
    {mode === "rename" && <label>Neuer Name<input name="name" required minLength={1} maxLength={100} defaultValue={location.name} autoFocus /></label>}
    {mode === "move" && <>
      <p>Aktueller Pfad: {locationPath(location, locations)}</p>
      <p>Ziel: {target ? locationPath(locations.find((item) => item.id === target) ?? location, locations) : "Oberste Ebene"}</p>
      <MoveTargets locations={locations} excluded={excluded} selected={target} onSelect={onTarget} />
    </>}
    {mode === "delete" && <p>Bist du sicher, dass du „{location.name}“ löschen möchtest? Das Löschen ist nur möglich, wenn der Ordner keine Karten und keine Unterordner enthält.</p>}
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}
    <div className="folder-dialog-buttons">
      <button type="button" onClick={onCancel}>{state.ok ? "Schließen" : "Abbrechen"}</button>
      <button type="submit" className={mode === "delete" ? "danger-button" : undefined} disabled={pending || state.ok}>{mode === "rename" ? "Speichern" : mode === "move" ? "Bewegen" : "Ja, sicher löschen"}</button>
    </div>
  </form>;
}

export function FolderActions({ location, locations, currentLocationId }: { location: LocationRow; locations: LocationRow[]; currentLocationId: string | null }) {
  const [mode, setMode] = useState<DialogMode | null>(null);
  const dialogId = useId();
  const [target, setTarget] = useState(location.parentId ?? "");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (mode && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!mode && dialog.current?.open) dialog.current.close();
  }, [mode]);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (menu.current?.open && event.target instanceof Node && !menu.current.contains(event.target)) menu.current.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menu.current?.open) {
        menu.current.open = false;
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function closeDialog() {
    setMode(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  function selectMode(next: DialogMode) {
    setTarget(location.parentId ?? "");
    if (menu.current) menu.current.open = false;
    setMode(next);
  }

  return <>
    <details className="folder-actions" ref={menu}>
      <summary ref={trigger} aria-label={`Aktionen für ${location.name}`}>⋯</summary>
      <div className="folder-action-menu">
        <button type="button" onClick={() => selectMode("rename")}>Umbenennen</button>
        {location.kind === "folder" && <>
          <button type="button" onClick={() => selectMode("move")}>Bewegen</button>
          <button type="button" onClick={() => selectMode("delete")}>Löschen</button>
        </>}
      </div>
    </details>
    <dialog ref={dialog} className="folder-dialog" aria-labelledby={dialogId} onCancel={(event) => { event.preventDefault(); closeDialog(); }} onClose={() => requestAnimationFrame(() => trigger.current?.focus())}>
      {mode && <FolderDialogForm key={mode} mode={mode} location={location} locations={locations} currentLocationId={currentLocationId} dialogId={dialogId} target={target} onTarget={setTarget} onCancel={closeDialog} />}
    </dialog>
  </>;
}
