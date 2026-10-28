# Zwischenbericht zur Yu-Gi-Oh Anwendung

Stand: 22. Oktober 2026. P1-01 bis P1-09 sind umgesetzt, unabhängig geprüft und vom Benutzer abgenommen. Mit der Abnahme von P1-09 wurde die Implementierung ausdrücklich pausiert. Kein weiteres Paket ist beauftragt.

Die technische Grundlage steht: lokale Anwendung, Benutzerprüfung, Zugriffsschutz, Anwendungslogging, Dockerbetrieb und vorbereitete Ansible-Einrichtung samt Deployment. Die eigentliche Kartenverwaltung ist noch nicht implementiert. Es gibt noch keinen eingerichteten Produktivbetrieb und keinen abgeschlossenen Nachweis der Sicherheit auf einem echten Server.

Dieser Bericht dient als Einstieg nach der Pause. Der [Aufgabenindex](aufgaben/README.md) bleibt die verbindliche Statusliste; [Entwicklung](entwicklung.md) enthält die ausführlichen Prüfprotokolle. Ältere Reviewvermerke in diesen Dokumenten beschreiben den damaligen Stand und werden durch spätere Abnahmen überholt.

## Ziel und vereinbarter Funktionsumfang

Die Anwendung soll ungefähr 15.000 Karten zweier Brüder verwalten. Ein großer Teil ist bereits in zwei Portfolios eines gemeinsamen Collectr-Kontos katalogisiert. Die Bedienung erfolgt auf Deutsch im Desktop-Browser, auf iPhone und Android. Eine Internetverbindung darf erforderlich sein; eine responsive, installierbare Web-App genügt. Native Apps und Offline-Synchronisation sind nicht geplant.

Der physische Standort ist die zentrale Bestandsinformation. Eine Kartenmenge kann nicht gleichzeitig an zwei Orten liegen. Boxen, lose Sammlungen, Decks und Cubes sollen auffindbar sein; ein ausgeliehenes Deck soll seinen tatsächlichen Aufenthaltsort zeigen. Nur physische Decks haben zusätzlich einen Besitzer. Ihre Karten zählen zur Sammlung des Besitzers; lose Karten und Cubes werden nach Standort zugeordnet. Mengen gleicher Ausprägung werden zusammengefasst, statt jedes Exemplar einzeln zu verfolgen.

Weitere vereinbarte Funktionen, sämtlich noch umzusetzen:

- Kartensuche und Erfassung über Namen oder Setcode mit unscharfer Suche und Auswahl der konkreten Variante. Bestand unterscheidet Sprache, 1st Edition/Unlimited, Set sowie bei Bedarf Seltenheit und Artwork. Unbekannte Edition bleibt unbekannt und ist manuell erfassbar.
- Kartenbilder in Organisationsansichten. Englische Bilder sind akzeptiert. Deutsche und englische Exemplare bleiben im Bestand erkennbar, ohne die Setvollständigkeit nach Sprache aufzuteilen.
- Setübersichten mit vorhandenen und fehlenden Varianten sowie Vollständigkeitsquote für beide Brüder gemeinsam und jeweils einzeln. Vollständigkeit darf nur so belastbar dargestellt werden, wie der zugrunde liegende Variantenkatalog es erlaubt.
- Theoretischer Deckbau mit dem gesamten Katalog und praktischer Deckbau aus physisch verfügbaren Karten; Anzeige fehlender Karten, verschiedene Formate und eigene Bannlisten. Dueling Nexus und YGO Omega dienen als funktionale Orientierung.
- Cube-Rezepte, physische Cube-Standorte und lokaler Draft hauptsächlich zu zweit. Konfigurierbare eigene Packs, darunter getrennte Extra-Deck-Packs beziehungsweise Draftphasen; die genauen Verfahrensregeln werden noch festgelegt.
- Einfaches manuelles Testfeld und Möglichkeit, Draftabläufe zu testen; keine vollständige automatische Yu-Gi-Oh!-Regelengine.
- Collectr-Import mit Vorschau und Prüfung sowie später vollständiger Anwendungsexport. Cardmarket-Preise sind optional und nur bei vertretbarer Datenanbindung vorgesehen.

Details stehen in [Projektspezifikation](projektspezifikation.md) und [Datenmodell](datenmodell.md). Das Datenmodell ist überwiegend ein Entwurf; umgesetzt ist bislang nur das Benutzerschema mit Migrationsmetadaten.

## Technische Entscheidungen und Gründe

| Entscheidung | Warum diese Lösung gewählt wurde |
| --- | --- |
| TypeScript und Next.js, eine Anwendung | Gemeinsame Sprache für Oberfläche und Server; überschaubares Projekt, das der Benutzer selbst nachvollziehen und debuggen kann. |
| SQLite mit Drizzle, eine Instanz | Für zwei Benutzer und den geplanten Umfang genügt eine lokale Datenbank. Kein zusätzlicher Datenbankdienst; versionierte SQL-Migrationen bleiben nachvollziehbar. |
| Docker Compose für Entwicklung und Produktion | Portable Linux-Laufzeit und getrennte Datenvolumes. Der native SQLite-Treiber wird im Linux-Zielimage geprüft, statt macOS-Module zu übernehmen. |
| Ansible auf gemietetem VPS | Bekanntes Werkzeug des Benutzers; reproduzierbare Konfiguration ohne zusätzlichen Terraform-/Kubernetes-Unterbau. Bestellung bleibt manuell. |
| Ubuntu 26.04 LTS amd64 | Auf Benutzerhinweis als Zielplattform gewählt; Paketquellen und Ansible-Versionen wurden dafür angepasst. Die frühere 24.04-Planung ist abgelöst. |
| Tailscale mit privatem HTTPS | Beide Smartphones und der Desktop verwenden Tailscale und den Browser. Keine öffentliche App, kein Funnel und keine eigene Domain erforderlich. |
| Tailscale Serve plus serverseitige Zwei-Benutzer-Allowlist | Vermeidet eine zweite Loginplattform. Jeder Zugriff prüft die vom vertrauenswürdigen Proxy übergebene Identität, den aktiven DB-Benutzer und erforderliche Berechtigungen. |
| Oxlint statt der ursprünglichen ESLint-Kette | Die ursprüngliche Werkzeugkette hatte EOL-/Auditprobleme. 80 von 86 aktiven Regeln wurden übernommen; sechs fehlende Gegenstücke sind ausdrücklich dokumentiert. |
| YGOPRODeck als primäre Katalogquelle | Verfügbare API für Karten, Druckcodes, Bilder und weitere Daten. Eigene interne IDs und manuelle Editionsangaben fangen bekannte Datenlücken auf. Keine automatische Konami-Datenübernahme vorgesehen. |
| Kleine Implementierungspakete mit getrenntem Review | Luna übernimmt abgegrenzte Arbeit; der Hauptagent prüft kritisch und verlangt gezielte Korrekturen. Menschliche Abnahme bleibt Voraussetzung für den nächsten Auftrag. |

Die Hostingplanung sieht Hetzner CX23 mit IPv4 vor. Historischer Planwert vom 21. Oktober 2026: etwa 7,13 € brutto monatlich vor externem Backup, etwa 7,21 € mit den damaligen Backupannahmen. Damit wurde das anfängliche Ziel von ungefähr 5 € bewusst überschritten. Endpreis und Verfügbarkeit sind bei der manuellen Bestellung erneut zu prüfen; Backupanbieter und Alarmdienst sind noch nicht endgültig freigegeben.

Geprüfter Versionsstand: Node 24.22.1, Next.js 16.4.2, React 19.3.0, TypeScript 5.9.3, Drizzle ORM 0.45.4, better-sqlite3 13.0.3, Vitest 5.0.5 und Oxlint 1.89.0. Ansible: Core 2.21.5 mit community.general 13.5.0. Maßgeblich für die spätere Installation sind Manifest, Lockfile und Ansible-Requirements; diese Angaben sind keine Aussage über künftig neueste Versionen.

## Abgeschlossene Pakete

| Paket | Ergebnis und wichtige Dateien |
| --- | --- |
| P1-01 | TypeScript-/Next.js-Grundgerüst, deutsche Startseite, npm-Prüfbefehle und Oxlint. `package.json`, `package-lock.json`, `.oxlintrc.json`, `src/app/`. |
| P1-02 | SQLite-Verbindung mit aktivierten Fremdschlüsseln, ausschließlich `users`-Schema, erste Drizzle-Migration und echte temporäre DB-Tests. `src/server/db/`, `drizzle.config.ts`. |
| P1-03 | Auflösung genau zweier konfigurierter Identitäten auf aktive Benutzer; Rico alleiniger App-Admin. Fehlende oder ungültige Konfiguration gibt keinen Zugriff. `src/server/auth/`. |
| P1-04 | Gemeinsame Prüfhelfer für Lesen, Schreiben, Dateien und Server Actions; HTTPS-Origin-/Host-/Methodenprüfung und private Cache-Regeln. Startseite geschützt. `src/server/access.ts`. |
| P1-05 | Strukturiertes JSON-Anwendungslogging mit serverseitiger Request-ID, kontrollierten Feldern und generischen Fehlermeldungen. Keine ungefilterten Cookies, Tokens, SQL-Texte oder Anfragekörper. `src/server/logging.ts`. |
| P1-06 | Produktionsimage als nicht privilegierter Benutzer, persistentes Datenvolume und nur Loopback-Portbindung. `Dockerfile`, `compose.yaml`, `.dockerignore`. |
| P1-07 | Getrennter Entwicklungsstack mit Hot Reload und eigenem Datenvolume. `Dockerfile.dev`, `compose.dev.yaml`. |
| P1-08 | Ubuntu-/Docker-/Benutzergrundlage und separate Firewallfinalisierung. Vor dem Schließen öffentlicher Zugänge wird eine frische Tailscale-SSH-Verbindung samt sudo geprüft. `infra/ansible/bootstrap.yml`, `finalize-firewall.yml`. |
| P1-09 | Tailscale-Installation, lokal renderbare Netzwerkpolicy, privates HTTPS und kontrolliertes Image-Deployment mit Datenbanksicherung und Migration. `infra/ansible/install-tailscale.yml`, `render-tailnet-policy.yml`, `configure-serve.yml`, `deploy.yml`, Vorlagen und `scripts/deploy-database.ts`. |

P0-01, P0-03, P0-04 und P0-05 sind als Planungspakete abgenommen. **P0-02 zum Collectr-Vertrag und P0-06 zu Sicherung und Betriebsprüfung stehen weiterhin auf Review.** Die Abnahme von P1-09 schließt diese offenen Planungspakete nicht automatisch ein.

## Sicherheitsgrenzen und Deploymentverhalten

Die vorgesehene Verbindung lautet: persönliches Gerät mit Tailscale → privates HTTPS über Serve → Host-Loopback → App-Container → SQLite im persistenten Volume. Die Policy erlaubt beiden Benutzern TCP/443 zum Server, nur Rico TCP/22 und Tailscale SSH zum Linux-Konto `deploy`. Persönliche Geräte bleiben ungetaggt. MFA/Passkeys, Gerätefreigaben und die tatsächlichen Identitäten müssen später eingerichtet werden.

Die App vertraut dem Serve-Identitätsheader nur innerhalb dieser Netzgrenze. Ein lokaler privilegierter Prozess könnte den Upstream direkt ansprechen; der Host gehört deshalb zur Vertrauensbasis. Es gibt keine zusätzliche App-Cookie-Sitzung und keinen unabhängigen App-Logout. `active=false` sperrt folgende App-Anfragen; Netzwerkzugriff wird zusätzlich über Tailscale entzogen. Eine verweigerte HTML-Startseite liefert derzeit HTTP 200 ohne private Inhalte; API-/Dateihelfer liefern die entsprechenden Fehlerstatus. Diese Grenze wurde abgenommen.

Das Deployment verwendet einen lokal gebauten Image-Tarball. SHA-256 wird vor und nach Übertragung geprüft, das geladene Image gegen seine erwartete ID abgeglichen. Vor Migration stoppt die App. Eine vorhandene SQLite-Datei wird konsistent gesichert und die Kopie auf Integrität geprüft. Erst nach erfolgreicher Migration und Benutzerprüfung startet die App wieder. Bei Fehler erfolgt kein automatischer Rollback und kein Startschritt.

Eine fehlende DB wird ohne ausdrücklichen Erstinitialisierungsschalter nicht neu angelegt. Die beiden Benutzer werden nur bei dieser Erstinitialisierung angelegt; bestehende gesperrte Benutzer bleiben gesperrt. **Die lokale Sicherung im Datenvolume ist noch kein regelmäßiges externes Backup.**

## Was tatsächlich geprüft wurde

Der Hauptagent prüfte Lunas Ergebnisse unabhängig und ließ konkrete Fehler beheben. Bei P1-09 betraf das unter anderem die Verwechslung von SHA-1 und SHA-256, den fehlenden Netzwerkgrant für SSH, das tatsächliche Tailscale-JSON-Format, den leeren `null`-Zustand bei Erstinstallation, die Variablenübertragung und fehlende Migrationsmodule im Container.

Die letzten relevanten Ergebnisse sind in [Entwicklung](entwicklung.md) nachvollziehbar dokumentiert:

- Typprüfung, Lint und 20 Anwendungstests in fünf Dateien erfolgreich; Produktionsbuild erfolgreich, zuletzt auch im eigenen Linux/amd64-Reviewimage.
- SQLite-Migration, Wiederholung, Datenerhalt, konsistente Sicherung und Integritätsprüfung mit synthetischen Daten geprüft. Absichtlich fehlerhafte Migration rollt teilweise Schemaänderungen zurück und verhindert den anschließenden App-Start im geprüften Ablauf.
- Containerlauf als UID 1000, nativer SQLite-Treiber, persistentes Volume, Loopback-Bindung sowie tatsächlicher HTTP-Zugriff mit erlaubter beziehungsweise fehlender Identität geprüft. Entwicklungs-Hot-Reload ebenfalls geprüft.
- Alle sechs Ansible-Playbooks bestanden Syntaxprüfungen. Elf gespeicherte Serve-Tests und neun zusätzliche lokale Eingabe-/DNS-/Firewallprüfungen bestanden. Erfolgs- und Fehlerablauf des Deployments wurden mit einem lokalen Docker-Dummy geprüft.
- Policy und Compose wurden lokal gerendert; ein isolierter Compose-Lauf bestätigte die korrekte Übergabe von Sonderzeichen. Eigene Testcontainer, Netzwerke und Datenvolumes wurden entfernt.

Die Dockerprüfungen liefen auf einem Mac mit arm64 unter emuliertem Linux/amd64. Der Benutzer hat diese Prüfung für die bisherigen Pakete akzeptiert. Sie ersetzt nicht den späteren nativen VPS-Test. Ansible wurde nicht gegen einen echten Server ausgeführt; Live-Tailscale, Headerersetzung, öffentliche IPv4-/IPv6-Unerreichbarkeit, Gerätezugriff und Recovery sind noch nicht praktisch abgenommen.

Letzter dokumentierter npm-Auditstand aus P1-02: Produktionsabhängigkeiten ohne Befund, vier moderate Einträge derselben esbuild-Entwicklungsserverursache in der Drizzle-Kit-Werkzeugkette. Der betroffene Serverpfad wird im eingerichteten Ablauf nicht verwendet. Das bleibt ein Wartungspunkt, insbesondere vor Drizzle Studio oder neuen Entwicklungsservern; vor Wiederaufnahme ist dies bei Bedarf aktuell zu prüfen.

## Was als Nächstes ansteht

**Der nächste fachliche Schritt nach einer ausdrücklichen Wiederaufnahme ist die Prüfung und Freigabe von P0-06.** P1-10 hängt laut Paketvertrag von P0-06 ab. Die frühere Ankündigung „als Nächstes P1-10“ ist daher nur nach dieser Freigabe zutreffend.

P0-06/E06 schlägt Restic mit Backblaze B2, tägliche konsistente Sicherung, 30 tägliche und zwölf monatliche Wiederherstellungspunkte, getrennte Schlüsselverwahrung, begrenzte journald-Logs und externe Healthchecks.io-Alarme vor. Zielanbieter, Kosten, Retention, Alarmempfänger, Schlüsselbereitstellung und Restoreverfahren sind noch zu bestätigen. Der Vorschlag steht in [Betriebsuntersuchung](untersuchungen/betrieb.md) und [Entscheidungsregister](entscheidungen.md).

| Bereich | Noch ausstehende Arbeit |
| --- | --- |
| P1-10 bis P1-12 | System-/Sicherheitslogs begrenzen, regelmäßige verschlüsselte externe Backups, Restoreverfahren und Betriebsalarme umsetzen. |
| P1-13 | Responsive deutsche Anwendungshülle und PWA-Installation; keine privaten Offlinecaches. |
| P1-14 | Separat beauftragte Einrichtung und praktische Sicherheits-/Backup-/Restoreabnahme auf echtem Zielserver und Geräten. Erst danach echte Sammlungsdaten verwenden. |
| P1-15 | Repositoryprüfungen automatisieren, sobald das tatsächlich gewünschte private Remote festgelegt ist. Kein automatisches Deployment. |
| P2 | Katalogschema/-synchronisierung, Bilder und Suche, Standorte, Bestandsmengen und atomare Bewegungen. |
| P3 | Collectr-Import, Vorschau/Matching, Setquoten und Anwendungsexport. P0-02 zuerst freigeben; echte Migration zusätzlich anhand eines tatsächlichen Collectr-Exports in P3-05 prüfen. |
| P4 | Deckregeln, Rezepte, Bannlisten einschließlich eigener Listen, visueller Editor, Verfügbarkeitsprüfung, physischer Deckbau und Ausleihe. E07 wird in P4-01 konkretisiert. |
| P5 | Cube-Rezepte, physische Cubes, Packbildung, lokaler Draft und weitere vereinbarte Verfahren. E08 wird in P5-01 konkretisiert. |
| P6 | Manuelles Testfeld. |
| P7 | Optionale Preise, Gesamtprüfung und weitere ausdrücklich beauftragte Ergänzungen. |

Ein echter Collectr-Export fehlt weiterhin. Die recherchierten Exportfelder sind ein vorläufiger Vertrag, keine verifizierte Collectr-Spezifikation. Die Kartenkatalogabdeckung ist ebenfalls nicht als vollständig nachgewiesen. Diese Punkte dürfen später weder durch erfundene Felder noch durch scheinbar exakte Vollständigkeitsquoten verdeckt werden.

## Wiedereinstieg nach der Pause

Zuerst diesen Bericht, `AGENTS.md`, [Arbeitsablauf](arbeit-mit-llm.md) und den [Aufgabenindex](aufgaben/README.md) lesen, anschließend das konkret beauftragte Paket und seine Fachabschnitte. Nicht alle geplanten Aufgaben gleichzeitig beginnen.

Der Arbeitsbaum enthält umfangreiche noch nicht committete Änderungen einschließlich der bisherigen Implementierung. Beim Berichtsstand zeigt Git zuletzt `9487449 scaffolding`; dieser Commit repräsentiert den Implementierungsstand nicht. Keine Bereinigung, kein Reset und kein Überschreiben dieser Dateien. Eine bewusste Sicherung beziehungsweise ein Commit ist ein gesonderter nächster Organisationsschritt, wurde hier aber nicht ausgeführt.

Für lokale Prüfungen sind die npm-Skripte `typecheck`, `lint`, `test` und `build` vorhanden. Migrationsbefehle ausschließlich gegen bewusst gewählte lokale Testdatenbanken ausführen. Die bisherigen Prüfumgebungen unter `/tmp` und lokale Docker-Reviewimages sind entbehrliche Sitzungsartefakte; auf ihre spätere Existenz darf kein neuer Auftrag bauen. Einige zusätzliche Reviewfixtures lagen nur dort. Dauerhaft vorhanden sind die Anwendungstests, Serve-Tests und Prüfprotokolle im Repository.

Luna bleibt ausführender Agent, der Hauptagent kritischer Reviewer. Reasoning wird pro Aufgabe gewählt: gewöhnlich Medium, High bei Sicherheit, Integrität, Restore oder schwieriger Fehlersuche; Low für einfache Dokumentationskorrekturen. Kein pauschales High, keine parallelen schreibenden Agenten, keine Ausweitung des Pakets zur Lösung hypothetischer Randfälle. Ein Paket endet nach Prüfung auf Review und wartet auf menschliche Abnahme.

Ein passender späterer Startauftrag wäre:

> Lies den Zwischenbericht vom 22. Oktober 2026 und den aktuellen Aufgabenindex. Die Implementierung war nach der Abnahme von P1-09 pausiert. Prüfe zunächst P0-06/E06 anhand des vorhandenen Standes und benenne die noch nötigen konkreten Entscheidungen. Implementiere dabei noch keine Betriebsjobs und führe nichts gegen echte Server aus.

Bis zu einem neuen Auftrag bleiben Implementierung, Bestellung, Deployment und Migration echter Daten pausiert.
