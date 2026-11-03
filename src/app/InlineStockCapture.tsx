"use client";

import { createContext, useActionState, useContext, useState, type ReactNode } from "react";
import type { LocationRow } from "../server/locations";
import type { StockChoice } from "../server/stock";
import { mutateStockAction, type StockActionState } from "./bestand/actions";
import { choiceLabel, locationPath } from "./bestand/form-utils";

const initialState: StockActionState = { ok: false, message: null };
type CaptureDefaults = { language: string; edition: string; locationId: string };
const CaptureDefaultsContext = createContext<{ defaults: CaptureDefaults; setDefaults: (defaults: CaptureDefaults) => void; expanded: boolean; toggle: () => void } | null>(null);

export function InlineStockCaptureGroup({ children }: { children: ReactNode }) {
  const [defaults, setDefaults] = useState<CaptureDefaults>({ language: "unknown", edition: "unknown", locationId: "" });
  const [expanded, setExpanded] = useState(false);
  return <CaptureDefaultsContext.Provider value={{ defaults, setDefaults, expanded, toggle: () => setExpanded((value) => !value) }}>{children}</CaptureDefaultsContext.Provider>;
}

export function SearchDetailsToggle({ cardId }: { cardId: string }) {
  const context = useContext(CaptureDefaultsContext);
  if (!context) throw new Error("SearchDetailsToggle must be inside InlineStockCaptureGroup");
  return <button className="details-toggle" type="button" aria-expanded={context.expanded} aria-controls={`search-details-${cardId}`} onClick={context.toggle}>{context.expanded ? "Details schließen" : "Details und Erfassung"}</button>;
}

export function SearchDetailsPanel({ cardId, children }: { cardId: string; children: ReactNode }) {
  const context = useContext(CaptureDefaultsContext);
  if (!context) throw new Error("SearchDetailsPanel must be inside InlineStockCaptureGroup");
  return <div id={`search-details-${cardId}`} className="search-card-details" hidden={!context.expanded}>{children}</div>;
}

function InlineStockForm({ cardId, cardName, locations, choices, defaults, onDefaultsChange }: {
  cardId: string; cardName: string; locations: LocationRow[]; choices: StockChoice[];
  defaults: CaptureDefaults; onDefaultsChange: (defaults: CaptureDefaults) => void;
}) {
  const [state, action, pending] = useActionState(mutateStockAction, initialState);
  const [reference, setReference] = useState("");
  const [quantity, setQuantity] = useState("1");
  return <form action={action} onReset={(event) => event.preventDefault()} className="location-form inline-stock-form" aria-label={`Bestand für ${cardName} erfassen`}>
    <input type="hidden" name="operation" value="create" />
    <input type="hidden" name="cardId" value={cardId} />
    <label>Druck oder Variante<select name="reference" value={reference} onChange={(event) => {
      const value = event.currentTarget.value;
      setReference(value);
      const choice = choices.find((candidate) => `${candidate.kind}:${candidate.id}` === value);
      if (choice?.kind === "variant" || choice?.kind === "printing") {
        onDefaultsChange({ ...defaults, edition: choice.edition ?? defaults.edition, language: choice.language ?? defaults.language });
      }
    }}><option value="">Keine genaue Druckangabe</option>{choices.map((choice) => <option key={`${choice.kind}:${choice.id}`} value={`${choice.kind}:${choice.id}`}>{choiceLabel(choice)}</option>)}</select></label>
    <label>Sprache<select name="language" value={defaults.language} onChange={(event) => onDefaultsChange({ ...defaults, language: event.currentTarget.value })}><option value="unknown">Unbekannt</option><option value="de">Deutsch</option><option value="en">Englisch</option></select></label>
    <label>Edition<select name="edition" value={defaults.edition} onChange={(event) => onDefaultsChange({ ...defaults, edition: event.currentTarget.value })}><option value="unknown">Unbekannt</option><option value="first">1st Edition</option><option value="unlimited">Unlimited</option><option value="not_applicable">Nicht anwendbar</option></select></label>
    <label>Menge<input name="quantity" type="number" min="1" step="1" max="9007199254740991" required value={quantity} onChange={(event) => setQuantity(event.currentTarget.value)} /></label>
    <label>Standort<select name="locationId" required value={defaults.locationId} onChange={(event) => onDefaultsChange({ ...defaults, locationId: event.currentTarget.value })}><option value="" disabled>Standort wählen</option>{locations.map((location) => <option key={location.id} value={location.id}>{locationPath(location, locations)}</option>)}</select></label>
    <button type="submit" disabled={pending}>Hinzufügen</button>
    {state.message && <p role={state.ok ? "status" : "alert"} className={state.ok ? "form-success" : "form-error"}>{state.message}</p>}
  </form>;
}

export function InlineStockCapture({ cardId, cardName, locations, choices }: { cardId: string; cardName: string; locations: LocationRow[]; choices: StockChoice[] }) {
  const context = useContext(CaptureDefaultsContext);
  if (!context) throw new Error("InlineStockCapture must be inside InlineStockCaptureGroup");
  return <section className="inline-capture" aria-label={`Bestand für ${cardName} erfassen`}>
    <InlineStockForm cardId={cardId} cardName={cardName} locations={locations} choices={choices} defaults={context.defaults} onDefaultsChange={context.setDefaults} />
    {locations.length === 0 && <p className="form-error">Noch kein Ordner vorhanden. Lege im Bestand einen Root-Ordner an, bevor du Karten erfasst.</p>}
    {choices.length === 0 && <p className="location-meta">Keine bestätigten oder beobachteten Druckangaben gespeichert. Eine Karte kann auch ohne genaue Druckangabe erfasst werden.</p>}
  </section>;
}
