import { requireReadAccess } from "../server/access";
import { withRequestContext } from "../server/logging";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  return withRequestContext(async (requestId) => {
    let accessMessage: string | null = null;
    try {
      await requireReadAccess();
    } catch {
      // requireReadAccess already records failures in this request context.
      accessMessage = "Zugriff verweigert.";
    }

    if (accessMessage) {
      return (
        <main className="startseite">
          <p className="marke">YGH</p>
          <h1>{accessMessage}</h1>
          <p>Request-ID: {requestId}</p>
        </main>
      );
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
        <main className="content" id="inhalt">
          <section className="welcome" aria-labelledby="welcome-title">
            <p className="eyebrow">Deine Sammlung</p>
            <h1 id="welcome-title">Deine Yu-Gi-Oh!-Sammlung</h1>
            <p className="intro">Der private Überblick für eure gemeinsame Kartensammlung.</p>
            <p className="connection-note">Zum Verwenden brauchst du eine Internetverbindung und die freigegebene Tailscale-Verbindung.</p>
          </section>
          <section className="empty-state" aria-labelledby="ready-title">
            <div className="empty-icon" aria-hidden="true">✦</div>
            <div>
              <h2 id="ready-title">Der Sammlungsbereich ist bereit</h2>
              <p>Weitere Sammlungsansichten erscheinen hier, sobald sie verfügbar sind.</p>
            </div>
          </section>
        </main>
        <footer className="app-footer">YGH · private Sammlungsverwaltung</footer>
      </div>
    );
  });
}
