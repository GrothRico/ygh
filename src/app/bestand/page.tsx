import Link from "next/link";
import { requireReadAccess } from "../../server/access";
import { listLocations } from "../../server/locations";
import { logEvent, withRequestContext } from "../../server/logging";
import { getStockCard, getStockChoices, listStock, listStockActivity, type StockActivity, type StockChoice, type StockGroup } from "../../server/stock";
import { StockManager } from "./StockManager";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function StockPage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ cardId?: string | string[]; page?: string | string[]; locationId?: string | string[] }> } = {}) {
  return withRequestContext(async (requestId) => {
    let user: Awaited<ReturnType<typeof requireReadAccess>>;
    try { user = await requireReadAccess(); }
    catch { return <main className="startseite"><p className="marke">YGH</p><h1>Zugriff verweigert.</h1><p>Request-ID: {requestId}</p></main>; }
    let groups: StockGroup[] = [];
    let hasNextPage = false;
    let page = 0;
    let locations: ReturnType<typeof listLocations> = [];
    const choicesByCard: Record<string, StockChoice[]> = {};
    const activityByStock: Record<string, StockActivity[]> = {};
    let card: ReturnType<typeof getStockCard> = null;
    let unavailable = false;
    let invalidLocation = false;
    let locationId: string | null = null;
    try {
      const path = process.env.DATABASE_PATH;
      if (!path) throw new Error("database unavailable");
      const params = await searchParams;
      locations = listLocations(path);
      locationId = Array.isArray(params.locationId) ? params.locationId[0] ?? null : params.locationId ?? null;
      if (locationId && !locations.some((location) => location.id === locationId)) invalidLocation = true;
      const requestedPage = Number(Array.isArray(params.page) ? params.page[0] : params.page ?? "0");
      page = Number.isSafeInteger(requestedPage) && requestedPage >= 0 ? Math.min(requestedPage, 10000) : 0;
      if (!invalidLocation) {
        groups = listStock(path, 25, page * 25, locationId ?? undefined);
        hasNextPage = groups.length > 25;
        groups = groups.slice(0, 25);
      }
      const cardId = Array.isArray(params.cardId) ? params.cardId[0] : params.cardId;
      if (!invalidLocation && cardId && cardId.length <= 100) card = getStockCard(path, cardId);
      const cardIds = new Set(groups.flatMap((group) => [group.cardId]));
      if (card) cardIds.add(card.id);
      for (const id of cardIds) choicesByCard[id] = getStockChoices(path, id);
      for (const group of groups) for (const row of group.rows) activityByStock[row.id] = listStockActivity(path, row.id, 5);
    } catch {
      unavailable = true;
      logEvent({ event: "request.failed", status: 500, durationMs: 0, reason: "internal" });
    }
    const params = await searchParams;
    const selectedCardId = Array.isArray(params.cardId) ? params.cardId[0] : params.cardId ?? null;
    return <div className="app-shell">
      <a className="skip-link" href="#inhalt">Zum Inhalt springen</a>
      <header className="app-header" id="start"><Link className="brand" href="/" aria-label="YGH – Startseite"><span className="brand-mark" aria-hidden="true">Y</span><span><strong>YGH</strong><small>Sammlung</small></span></Link><nav aria-label="Hauptnavigation"><Link className="nav-link" href="/">Startseite</Link><Link className="nav-link" href="/bestand" aria-current="page">Bestand</Link></nav><span className="private-label"><span aria-hidden="true" />Privat</span></header>
      {user.authMode === "local" && <aside className="local-dev-banner" role="status">Lokale Entwicklung · {user.displayName} ({user.role === "admin" ? "Admin" : "Mitglied"}) · nur synthetische Daten</aside>}
      <main className="content bestand-page" id="inhalt"><section className="welcome"><p className="eyebrow">Sammlung</p><h1>Bestand</h1><p className="intro">Öffne einen Ordner, lege Ordner an und verwalte deine Karten direkt im gewählten Bereich.</p></section>
      {unavailable ? <section className="location-panel" role="alert"><h2>Bestand nicht verfügbar</h2><p>Die Datenbank konnte nicht gelesen werden. Bitte später erneut versuchen.</p><p>Request-ID: {requestId}</p></section> : <StockManager key={`${locationId ?? "root"}:${page}`} groups={groups} hasNextPage={hasNextPage} page={page} locations={locations} choicesByCard={choicesByCard} cardId={card?.id ?? null} cardName={card?.name ?? null} cardNameEn={card?.nameEn ?? null} activityByStock={activityByStock} locationId={locationId} invalidLocation={invalidLocation} />}
      {!unavailable && !invalidLocation && selectedCardId && !card && <p className="form-error">Die angeforderte Karte wurde nicht gefunden.</p>}</main><footer className="app-footer">YGH · private Sammlungsverwaltung</footer>
    </div>;
  });
}
