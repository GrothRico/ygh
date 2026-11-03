"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { mutateLocationAction, type LocationActionState } from "./location-actions";

const initialState: LocationActionState = { ok: false, message: null };

function CreateFolderForm({ parentId, titleId, nameId, onCancel }: { parentId: string | null; titleId: string; nameId: string; onCancel: () => void }) {
  const [state, action, pending] = useActionState(mutateLocationAction, initialState);
  return <form action={action} onReset={(event) => event.preventDefault()} className="folder-dialog-content">
    <input type="hidden" name="operation" value="create" />
    <input type="hidden" name="parentId" value={parentId ?? ""} />
    <h2 id={titleId}>Ordner anlegen</h2>
    <label htmlFor={nameId}>Ordnername<input id={nameId} name="name" required minLength={1} maxLength={100} autoFocus /></label>
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}
    <div className="folder-dialog-buttons"><button type="button" onClick={onCancel}>{state.ok ? "Schließen" : "Abbrechen"}</button><button type="submit" disabled={pending || state.ok}>Ordner anlegen</button></div>
  </form>;
}

export function FolderCreate({ parentId }: { parentId: string | null }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const nameId = useId();
  const titleId = useId();
  useEffect(() => {
    if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  function close() {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return <div className="folder-create">
    <button ref={trigger} type="button" className="folder-create-trigger" aria-label="Ordner anlegen" title="Ordner anlegen" onClick={() => setOpen(true)}>
      <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3.5 6.5h6l2 2h9v9.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18z"/><path d="M12 11v6m-3-3h6"/></svg>
    </button>
    <dialog ref={dialog} className="folder-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => requestAnimationFrame(() => trigger.current?.focus())}>
      {open && <CreateFolderForm key={parentId ?? "root"} parentId={parentId} titleId={titleId} nameId={nameId} onCancel={close} />}
    </dialog>
  </div>;
}
