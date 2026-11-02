import { requireReadAccess } from "../server/access";
import { MAX_SEARCH_RESULTS, searchCards } from "../server/catalog/search";
import { logEvent, withRequestContext } from "../server/logging";
import { CardArtwork } from "./CardArtwork";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage({ searchParams = Promise.resolve({}) }: { searchParams?: Promise<{ q?: string | string[] }> } = {}) {
  return withRequestContext(async (requestId) => {
    let accessMessage: string | null = null;
    let currentUser: Awaited<ReturnType<typeof requireReadAccess>> | null = null;
    try {
      currentUser = await requireReadAccess();
    } catch {
      // requireReadAccess already records failures in this request context.
      accessMessage = "Zugriff verweigert.";
    }

    if (accessMessage || !currentUser) {
      return (
        <main className="startseite">
          <p className="marke">YGH</p>
          <h1>{accessMessage}</h1>
          <p>Request-ID: {requestId}</p>
        </main>
      );
    }

    const params = await searchParams;
    const query = (Array.isArray(params.q) ? params.q[0] : params.q ?? "").slice(0, 100);
    const databasePath = process.env.DATABASE_PATH;
    let results: ReturnType<typeof searchCards> = [];
    let searchUnavailable = false;
    if (query && databasePath) {
      try {
        results = searchCards(databasePath, query);
      } catch {
        searchUnavailable = true;
        logEvent({ event: "request.failed", status: 500, durationMs: 0, reason: "internal" });
      }
    }

    return (
      <div className="app-shell">
        <a className="skip-link" href="#inhalt">Zum Inhalt springen</a>
        <header className="app-header" id="start">
          <a className="brand" href="#start" aria-label="YGH – Startseite">
            <span className="brand-mark" aria-hidden="true">Y</span>
            <span><strong>YGH</strong><small>Sammlung</small></span>
          </a>
          <nav aria-label="Hauptnavigation">
            <a className="nav-link" href="#start" aria-current="page">Startseite</a>
          </nav>
          <span className="private-label"><span aria-hidden="true" />Privat</span>
        </header>
        {currentUser.authMode === "local" && (
          <aside className="local-dev-banner" role="status">
            Lokale Entwicklung · {currentUser.displayName} ({currentUser.role === "admin" ? "Admin" : "Mitglied"}) · nur synthetische Daten
          </aside>
        )}
        <main className="content" id="inhalt">
          <section className="welcome" aria-labelledby="welcome-title">
            <p className="eyebrow">Deine Sammlung</p>
            <h1 id="welcome-title">Deine Yu-Gi-Oh!-Sammlung</h1>
            <p className="intro">Finde Karten über deutschen oder englischen Namen und gedruckte Codes.</p>
          </section>
          <section className="catalog-search" aria-labelledby="search-title">
            <h2 id="search-title">Kartensuche</h2>
            <form action="/" method="get" role="search">
              <label htmlFor="card-query">Kartenname oder gedruckter Code</label>
              <div className="search-row">
                <input id="card-query" name="q" type="search" maxLength={100} defaultValue={query} autoComplete="off" />
                <button type="submit">Suchen</button>
              </div>
            </form>
            {query && (
              <div className="search-results" aria-live="polite">
                <h3>Treffer für „{query}“</h3>
                {searchUnavailable ? <p role="status">Die Kartensuche ist derzeit nicht verfügbar. Request-ID: {requestId}</p> : results.length === 0 ? <p>Keine Karten gefunden.</p> : <p>{results.length === MAX_SEARCH_RESULTS ? `${results.length} oder mehr Treffer` : `${results.length} Treffer`}</p>}
                {!searchUnavailable && <p className="image-note">Kartenbilder zeigen die englische Quellenabbildung; sie bestätigen keine konkrete Druckvariante.</p>}
                <ul>
                  {!searchUnavailable && results.map((card) => {
                    const label = card.nameDe ?? card.nameEn ?? "Karte";
                    return (
                      <li className="search-card" key={card.id}>
                        <CardArtwork cardId={card.sourceId ? card.id : null} label={label} />
                        <div className="search-card-content">
                          <h4>{card.nameDe ?? card.nameEn}</h4>
                          {card.nameDe && card.nameEn && <p>{card.nameEn}</p>}
                          {card.printings.length > 0 ? (
                            <ul className="printing-list">
                              {card.printings.map((printing, index) => (
                                <li key={`${printing.kind}-${printing.variantId ?? printing.code}-${index}`}>
                                  <strong>{printing.code}</strong> · {printing.setName} · {printing.rarity}
                                  {printing.kind === "confirmed" ? ` · ${printing.language === "de" ? "Deutsch" : printing.language === "en" ? "Englisch" : printing.language} · ${printing.edition === "first" ? "1st Edition" : printing.edition === "unlimited" ? "Unlimited" : "Nicht anwendbar"}` : " · Druckangabe nicht bestätigt"}
                                  {printing.kind === "confirmed" && printing.artworkKey !== "default" ? ` · Artwork ${printing.artworkKey}` : ""}
                                </li>
                              ))}
                            </ul>
                          ) : <p>Keine Druckangaben gespeichert.</p>}
                          {card.morePrintings > 0 && <p>Weitere Druckangaben: {card.morePrintings}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </main>
        <footer className="app-footer">YGH · private Sammlungsverwaltung</footer>
      </div>
    );
  });
}
