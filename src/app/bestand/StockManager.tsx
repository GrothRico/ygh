"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CardArtwork } from "../CardArtwork";
import type { LocationRow } from "../../server/locations";
import type { StockActivity, StockChoice, StockGroup, StockRow } from "../../server/stock";
import { mutateStockAction, type StockActionState } from "./actions";
import { choiceLabel, locationPath } from "./form-utils";
import { FolderActions } from "./FolderActions";
import { FolderCreate } from "./FolderCreate";
import { FolderSidebar } from "./FolderSidebar";
import { MoveStockDialog } from "./MoveStockDialog";
import { groupEquivalentStockRows, selectionReferenceLabel } from "./stock-selection";

const initialState: StockActionState = { ok: false, message: null };
const languageLabels = { unknown: "Unbekannt", de: "Deutsch", en: "Englisch" } as const;
const editionLabels = { unknown: "Unbekannt", first: "1st Edition", unlimited: "Unlimited", not_applicable: "Nicht anwendbar" } as const;
type SelectedMove = { key: string; rows: StockRow[]; quantity: string };

function ActionMessage({ state }: { state: StockActionState }) {
  return state.message ? <p role={state.ok ? "status" : "alert"} className={state.ok ? "form-success" : "form-error"}>{state.message}</p> : null;
}

function StockForm({ locations, cardId, choices, row }: { locations: LocationRow[]; cardId: string; choices: StockChoice[]; row?: StockRow }) {
  const [state, action, pending] = useActionState(mutateStockAction, initialState);
  const reference = row?.sourceObservationId ? `observation:${row.sourceObservationId}` : row?.printingId ? `printing:${row.printingId}` : row?.variantId ? `variant:${row.variantId}` : "";
  return <form action={action} onReset={(event) => event.preventDefault()} className="location-form">
    <input type="hidden" name="operation" value={row ? "correct" : "create"} />
    <input type="hidden" name="cardId" value={cardId} />
    {row && <><input type="hidden" name="id" value={row.id} /><input type="hidden" name="version" value={row.version} /><input type="hidden" name="locationId" value={row.locationId} /></>}
    <label>Druck oder Variante<select name="reference" defaultValue={reference}><option value="">Keine genaue Druckangabe</option>{choices.map((choice) => <option key={`${choice.kind}:${choice.id}`} value={`${choice.kind}:${choice.id}`}>{choiceLabel(choice)}</option>)}</select></label>
    <label>Sprache<select name="language" defaultValue={row?.language ?? "unknown"}><option value="unknown">Unbekannt</option><option value="de">Deutsch</option><option value="en">Englisch</option></select></label>
    <label>Edition<select name="edition" defaultValue={row?.edition ?? "unknown"}><option value="unknown">Unbekannt</option><option value="first">1st Edition</option><option value="unlimited">Unlimited</option><option value="not_applicable">Nicht anwendbar</option></select></label>
    <label>Menge<input name="quantity" type="number" min="1" step="1" max="9007199254740991" required defaultValue={row?.quantity ?? 1} /></label>
    <label>Standort<select name="locationId" required defaultValue={row?.locationId ?? ""} disabled={Boolean(row)}><option value="" disabled>Standort wählen</option>{locations.map((location) => <option key={location.id} value={location.id}>{locationPath(location, locations)}</option>)}</select></label>
    <button type="submit" disabled={pending}>{row ? "Korrektur speichern" : "Bestand erfassen"}</button>
    <ActionMessage state={state} />
  </form>;
}

function Activity({ entries }: { entries: StockActivity[] }) {
  return <details className="stock-history"><summary>Verlauf ({entries.length})</summary>{entries.length === 0 ? <p>Kein Verlauf vorhanden.</p> : <ul>{entries.map((entry, index) => <li key={`${entry.createdAt}-${index}`}><strong>{entry.action === "stock.created" ? "Erfasst" : entry.action === "stock.moved" ? "Verschoben" : "Korrigiert"}</strong> · {new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "medium" }).format(new Date(entry.createdAt))} · {entry.actorName}{entry.movement && <span> · {entry.movement.quantity} Exemplar(e) · Von: {entry.movement.sourcePath} · Nach: {entry.movement.destinationPath}</span>}{entry.before && <span> · Menge {String(entry.before.quantity)} → {String(entry.after.quantity)}, Sprache {languageLabels[String(entry.before.language) as keyof typeof languageLabels] ?? "Unbekannt"} → {languageLabels[String(entry.after.language) as keyof typeof languageLabels] ?? "Unbekannt"}, Edition {editionLabels[String(entry.before.edition) as keyof typeof editionLabels] ?? "Unbekannt"} → {editionLabels[String(entry.after.edition) as keyof typeof editionLabels] ?? "Unbekannt"}, Druck {String(entry.before.reference ?? "keine")} → {String(entry.after.reference ?? "keine")}</span>}</li>)}</ul>}</details>;
}

function FolderCards({ locations, currentLocationId }: { locations: LocationRow[]; currentLocationId: string | null }) {
  const children = locations.filter((location) => location.parentId === currentLocationId);
  if (!children.length) return null;
  return <ul className="stock-folders">{children.map((location) => <li key={location.id}>
    <Link href={`/bestand?locationId=${encodeURIComponent(location.id)}`} aria-label={`${location.name} öffnen`}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3.5 6.5h6l2 2h9v9.5a1.5 1.5 0 0 1-1.5 1.5h-14A1.5 1.5 0 0 1 3.5 18z" /></svg><strong>{location.name}</strong></Link>
    <FolderActions location={location} locations={locations} currentLocationId={currentLocationId} />
  </li>)}</ul>;
}

export function StockManager({ groups, hasNextPage, page, locations, choicesByCard, cardId, cardName, cardNameEn, activityByStock, locationId, invalidLocation }: {
  groups: StockGroup[]; hasNextPage: boolean; page: number; locations: LocationRow[]; choicesByCard: Record<string, StockChoice[]>; cardId: string | null; cardName: string | null; cardNameEn: string | null;
  activityByStock: Record<string, StockActivity[]>; locationId: string | null; invalidLocation: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedMoves, setSelectedMoves] = useState<Record<string, SelectedMove>>({});
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [movementMessage, setMovementMessage] = useState<string | null>(null);
  const movementAnnouncement = useRef<HTMLParagraphElement>(null);
  const pageRows = useMemo(() => groups.flatMap((group) => group.rows), [groups]);
  const visibleIds = new Set(pageRows.map((row) => row.id));
  const selectionGroups = groupEquivalentStockRows(pageRows);
  const visibleRowsByKey = Object.fromEntries(selectionGroups.map(({ key, rows }) => [key, rows.map((row) => row.id)]));
  const visibleSelections = Object.values(selectedMoves).filter(({ key, rows }) => {
    const currentIds = visibleRowsByKey[key];
    return currentIds !== undefined && rows.every((row) => visibleIds.has(row.id)) && currentIds.length === rows.length && currentIds.every((id) => rows.some((row) => row.id === id));
  });
  useEffect(() => {
    if (movementMessage && document.activeElement === document.body) movementAnnouncement.current?.focus();
  }, [groups, movementMessage]);
  const currentLocation = locations.find((location) => location.id === locationId) ?? null;
  const breadcrumbs: LocationRow[] = [];
  let cursor: LocationRow | undefined = currentLocation ?? undefined;
  while (cursor) {
    breadcrumbs.unshift(cursor);
    cursor = cursor.parentId ? locations.find((location) => location.id === cursor?.parentId) : undefined;
  }
  const parent = currentLocation?.parentId ? locations.find((location) => location.id === currentLocation.parentId) : null;
  return <div className="stock-layout">
    <FolderSidebar key={breadcrumbs.map((location) => location.id).join("/")} locations={locations} selectedId={locationId} />
    <div className="stock-main">
      {cardId && cardName && !invalidLocation && <section className="location-panel" aria-labelledby="capture-title">
        <h2 id="capture-title">Bestand erfassen: {cardName}</h2>{cardNameEn && cardNameEn !== cardName && <p>{cardNameEn}</p>}
        <StockForm cardId={cardId} locations={locations} choices={choicesByCard[cardId] ?? []} />
      </section>}
      <section className="location-panel" aria-labelledby="stock-title">
        <h2 id="stock-title" className="visually-hidden">Bestand</h2>
        {movementMessage && <p ref={movementAnnouncement} className="form-success movement-announcement" role="status" tabIndex={-1}>{movementMessage}</p>}
        <div className="stock-folder-toolbar">
          {!invalidLocation && currentLocation && <Link className="stock-folder-back" href={parent ? `/bestand?locationId=${encodeURIComponent(parent.id)}` : "/bestand"} aria-label={`Zum übergeordneten Ordner${parent ? ` ${parent.name}` : " Alle Karten"}`}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14.5 5-7 7 7 7M8 12h12"/></svg></Link>}
          <nav aria-label="Ordnerpfad" className="stock-breadcrumbs"><Link href="/bestand">Alle Karten</Link>{breadcrumbs.map((location, index) => <span className="stock-breadcrumb-item" key={location.id}><span aria-hidden="true">›</span><Link href={`/bestand?locationId=${encodeURIComponent(location.id)}`} aria-current={index === breadcrumbs.length - 1 ? "page" : undefined}>{location.name}</Link></span>)}</nav>
          {!invalidLocation && <div className="stock-toolbar-actions">
            {currentLocation && <FolderActions key={`toolbar-${currentLocation.id}`} location={currentLocation} locations={locations} currentLocationId={locationId} />}
            <MoveStockDialog selections={visibleSelections} visibleRowIds={visibleIds} visibleRowsByKey={visibleRowsByKey} locations={locations} onClear={() => setSelectedMoves({})} onSuccess={() => { setMovementMessage("Auswahl verschoben; Verlauf gespeichert."); setSelectedMoves({}); setQuantityDrafts({}); }} />
            <FolderCreate key={locationId ?? "root"} parentId={locationId} />
          </div>}
        </div>
        {invalidLocation ? <p className="form-error" role="alert">Der gewählte Ordner ist ungültig. Bitte wähle einen Ordner aus der Liste.</p> : <>
          <FolderCards locations={locations} currentLocationId={locationId} />
          {groups.length === 0 ? <p>{locationId ? "In diesem Ordner und seinen Unterordnern ist kein Bestand erfasst." : "Noch kein Bestand erfasst."}</p> : <ul className="location-tree stock-list">{groups.map((group) => {
            const detailId = `stock-details-${encodeURIComponent(group.key)}`;
            const location = locations.find((item) => item.id === group.locationId);
            return <li key={group.key}><article className="location-entry stock-entry">
              <CardArtwork cardId={group.cardImageId} label={group.cardName} />
              <div className="stock-entry-content">
              <strong>{group.cardName} · {editionLabels[group.edition]} · {location ? locationPath(location, locations) : group.locationName}</strong>
              <span className="location-meta">{group.total} Exemplare · {languageLabels.de}: {group.languageCounts.de} · {languageLabels.en}: {group.languageCounts.en} · {languageLabels.unknown}: {group.languageCounts.unknown}</span>
              <button className="details-toggle" type="button" aria-expanded={detailsOpen} aria-controls={detailId} onClick={() => setDetailsOpen((open) => !open)}>{detailsOpen ? "Details schließen" : "Druckdetails und Bearbeitung"}</button>
              </div>
              <div className="stock-row-move-selection" aria-label={`Verschiebung für ${group.cardName}`}>
                {selectionGroups.filter((selectionGroup) => selectionGroup.rows.some((row) => group.rows.some((displayRow) => displayRow.id === row.id))).map((selectionGroup) => {
                  const selection = visibleSelections.find((candidate) => candidate.key === selectionGroup.key);
                  const selectionMatches = selection !== undefined && selection.rows.length === selectionGroup.rows.length && selection.rows.every((selectedRow) => selectionGroup.rows.some((row) => row.id === selectedRow.id));
                  const displayRow = selectionMatches ? selection.rows[0] : selectionGroup.representative;
                  const label = `${displayRow.cardName}, ${languageLabels[displayRow.language]}, ${editionLabels[displayRow.edition]}`;
                  const checked = selectionMatches;
                  const value = quantityDrafts[selectionGroup.key] ?? "1";
                  const referenceDetails = [...new Set(selectionGroup.rows.map(selectionReferenceLabel).filter(Boolean))];
                  const detail = referenceDetails.length ? referenceDetails.join(" / ") : "ohne Druckangabe";
                  const referenceDisplay = displayRow.observationCode ? `${detail} (nicht bestätigt)` : detail;
                  return <div className="stock-row-select" key={selectionGroup.key}>
                    <label><input type="checkbox" checked={checked} aria-label={`${label}, ${detail} auswählen`} onChange={(event) => {
                      const isChecked = event.currentTarget.checked;
                      setMovementMessage(null);
                      setSelectedMoves((current) => {
                        if (!isChecked) { const next = { ...current }; delete next[selectionGroup.key]; return next; }
                        return { ...current, [selectionGroup.key]: { key: selectionGroup.key, rows: selectionGroup.rows.map((row) => ({ ...row })), quantity: quantityDrafts[selectionGroup.key] ?? "1" } };
                      });
                    }} />{languageLabels[displayRow.language]} · {referenceDisplay} · {selectionGroup.total} verfügbar</label>
                    <label className="stock-row-quantity">Menge<input type="number" min="1" max={selectionGroup.total} step="1" aria-label={`${label}, ${detail}: Verschiebemenge`} value={value} onChange={(event) => {
                      const quantity = event.currentTarget.value;
                      setMovementMessage(null);
                      setQuantityDrafts((current) => ({ ...current, [selectionGroup.key]: quantity }));
                      setSelectedMoves((current) => current[selectionGroup.key] ? { ...current, [selectionGroup.key]: { ...current[selectionGroup.key], quantity } } : current);
                    }} /></label>
                  </div>;
                })}
              </div>
              <div className="stock-entry-details" id={detailId} hidden={!detailsOpen}>{group.rows.map((row) => <div className="stock-row" key={row.id}>
                <p>{row.quantity} · {languageLabels[row.language]}{row.confirmedCode ? ` · ${row.confirmedCode}` : row.observationCode ? ` · ${row.observationCode} (nicht bestätigt)` : ""}{row.setName ? ` · ${row.setName}` : ""}{row.rarity ? ` · ${row.rarity}` : ""}{row.artworkKey && row.artworkKey !== "default" ? ` · Artwork ${row.artworkKey}` : ""}</p>
                <StockForm row={row} cardId={row.cardId} locations={locations} choices={choicesByCard[row.cardId] ?? []} />
                <Activity entries={activityByStock[row.id] ?? []} />
              </div>)}</div>
            </article></li>;
          })}</ul>}
          {(page > 0 || hasNextPage) && <nav aria-label="Bestandsseiten" className="stock-pagination">{page > 0 && <Link href={`/bestand?page=${page - 1}${locationId ? `&locationId=${encodeURIComponent(locationId)}` : ""}${cardId ? `&cardId=${encodeURIComponent(cardId)}` : ""}`}>Vorherige</Link>}{hasNextPage && <Link href={`/bestand?page=${page + 1}${locationId ? `&locationId=${encodeURIComponent(locationId)}` : ""}${cardId ? `&cardId=${encodeURIComponent(cardId)}` : ""}`}>Weitere Bestände</Link>}</nav>}
        </>}
      </section>
    </div>
  </div>;
}
