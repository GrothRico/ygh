# Wiedereinstiegsbericht zum Projekt Yu-Gi-Oh Sammlung und Deckbau

Stand: 28. Oktober 2026. P1-01 bis P1-13 und P1-15 sind vom Benutzer abgenommen. P1-14 wurde ausdrücklich zurückgestellt. Die weitere Implementierung ist bis zu einem neuen Einzelauftrag pausiert. Der historische [Zwischenbericht vom 22. Oktober](zwischenbericht-2026-10-22.md) bleibt unverändert; er beschreibt den früheren Stand nach P1-09.

Dieser Bericht fasst Ziele, Entscheidungen, Ergebnisse und offene Grenzen zusammen, damit eine spätere Arbeit in einem frischen Chat an der richtigen Stelle beginnen kann. Der [Aufgabenindex](aufgaben/README.md) bleibt die verbindliche Statusliste; [Entwicklung und Prüfungen](entwicklung.md), das [Entscheidungsregister](entscheidungen.md), die [Projektspezifikation](projektspezifikation.md) und [AGENTS.md](../AGENTS.md) enthalten die maßgeblichen Einzelheiten.

## Projektziel und aktueller Produktstand

Geplant ist eine private, deutschsprachige Webanwendung für zwei Brüder zur Verwaltung von ungefähr 15.000 Yu-Gi-Oh!-Karten. Desktopbrowser, iPhone und Android sollen sie über Tailscale verwenden können. Die Anwendung soll Karten und Varianten suchen, physische Standorte samt Mengen verwalten, Setvollständigkeit darstellen, theoretische und physische Decks unterstützen sowie Cubes und lokale Drafts ermöglichen. Collectr-Import und vollständiger Export sind vorgesehen; Cardmarket-Preise bleiben optional.

Diese Produktfunktionen sind noch nicht implementiert. Es gibt weder Katalog- noch Sammlungs-, Standort-, Deck-, Cube-, Draft- oder Kartenmengenschema. Das einzige fachliche Tabellenschema ist `users`. Es gibt keine echten Sammlungsdaten in der Anwendung und keinen Collectr-Import. Die vorhandene Oberfläche ist eine geschützte, responsive Anwendungshülle mit Manifest und lokalen Icons; sie ist keine fertige Kartenverwaltung. Bislang verwendete Testdaten sind synthetisch.

Die zentrale Bestandsregel für spätere Pakete bleibt: Ein physisches Exemplar hat genau einen Standort. Teilmengen und ihr Verlauf müssen atomar geändert werden; Mengen dürfen nicht negativ werden. Deckkarten zählen zur Sammlung ihres Besitzers, andere Karten einschließlich Cubes zum jeweiligen Standort, ohne Doppelzählung. Rezeptänderungen verschieben keinen physischen Bestand. Sprache wird nicht aus einem Kartennamen abgeleitet. Diese Regeln stehen in der [Projektspezifikation](projektspezifikation.md) und müssen für jede Implementierung gelten.

Die vereinbarten Funktionsdetails bleiben für die weitere Umsetzung verbindlich:

- Erfassung per unscharfer Suche nach Setcode oder Name mit Auswahl der konkreten Druckvariante. Sprache, 1st Edition/Unlimited, Set und bei Mehrdeutigkeit Seltenheit/Artwork unterscheiden. Fehlende Edition bleibt unbekannt und kann manuell gesetzt werden; keine erfundenen Variantenkombinationen.
- Deutsche und englische Exemplare im Bestand unterscheiden, für Setvollständigkeit aber sprachübergreifend zählen. Alle Varianten sind Sammelziele; Quoten bei unvollständigem Katalog ausdrücklich als vorläufig darstellen. Englische Kartenbilder sind akzeptiert.
- Physische Boxen, lose Karten, Decks und Cubes mit tatsächlichem Standort. Nur Decks besitzen zusätzlich einen Eigentümer; Ausleihe ändert ihren Aufenthaltsort, nicht die Sammlungszuordnung.
- Deckeditor nach funktionaler Orientierung an Dueling Nexus/YGO Omega: theoretische Rezepte mit allen Karten, praktischer Aufbau aus verfügbaren Karten, Fehlkartenanzeige, mehrere Formate und eigene Bannlisten. Exakte Formatregeln werden erst in P4-01 festgelegt.
- Cubes ähnlich wie Deckrezepte entwerfen; lokaler Draft hauptsächlich zu zweit, eigene Packs (beispielsweise 15 Karten) und getrennte Extra-Deck-Phasen. Konkrete Draftregeln folgen in P5-01. Einfaches manuelles Testfeld und Drafttests, keine automatische Regelengine.
- Collectr-Ausgangslage: zwei Portfolios innerhalb eines gemeinsamen Kontos; ein großer Teil des Bestands ist dort katalogisiert. Es fehlt weiterhin eine echte Exportdatei. Import erst mit Vorschau, Matching und Mengenabgleich; Sprache nicht aus englischen Namen ableiten.

## Architektur und beschlossene Gründe

- Eine TypeScript-/Next.js-Anwendung mit App Router, eine SQLite-Datenbank mit Drizzle und normale TypeScript-Funktionen für die Fachlogik. Das passt zum Umfang für zwei Benutzer und hält den Betrieb nachvollziehbar. Es gibt keine Microservices, kein Kubernetes, kein Event-Sourcing, kein allgemeines Repository-Framework und keine Regel-DSL.
- npm mit Lockfile; Zielruntime Node.js 24.22.1. Native SQLite-Abhängigkeiten werden auf der Linux-Plattform geprüft. Docker Compose dient Entwicklung und späterer Produktion; der Produktionscontainer läuft unprivilegiert, bindet den App-Port nur an Loopback und hält die Daten in einem benannten Volume.
- Geplanter Zielhost ist Ubuntu 26.04 LTS amd64 auf einem manuell zu bestellenden VPS. Ansible enthält Bootstrap, Tailscale-Konfiguration, Firewallfinalisierung, Deployment, Logs, Backup und Restore-Helfer. Kein Playbook wurde auf einem realen Zielhost ausgeführt.
- Zugriff soll ausschließlich privat über Tailscale und HTTPS/Serve erfolgen. Die Anwendung prüft serverseitig genau zwei konfigurierte Identitäten und die aktive Benutzerzuordnung. Eine zweite Loginplattform, öffentliche Registrierung und produktive Auth-Bypässe sind ausgeschlossen.
- Die Anwendungshülle hat keinen Service Worker und keinen privaten Offlinecache. Installation auf echten Geräten und Safari/WebKit-Verhalten wurden nicht vollständig geprüft.
- YGOPRODeck ist als primäre Katalogquelle für eine spätere Umsetzung beschlossen. Vollständigkeit, Editionen und Rechte an Bilddaten sind nicht durchgehend belegt; Konami-Daten sollen nicht automatisiert übernommen werden. Diese Entscheidung startet keinen Adapter oder Import.

Die Hostingkostenzahl in bestehenden Unterlagen ist eine historische Planungsannahme (zuletzt etwa 7,21 € monatlich einschließlich damaliger Backupannahmen), keine neue Preisprüfung oder Bestellung. Planungswahl ist Hetzner CX23 mit IPv4; die Bestellung übernimmt der Benutzer manuell. Es gibt keinen Server und keinen Betriebsauftrag. GitHub-Kontingent und Kontoeinstellungen wurden nicht geändert; eine Abrechnungsprüfung war nicht Teil dieses Auftrags.

Oxlint ersetzt die ursprüngliche ESLint-Kette wegen der damals festgestellten EOL-/Auditprobleme. 80 von 86 zuvor aktiven Regeln sind abgebildet; sechs fehlende Gegenstücke sind im Entwicklungsvertrag dokumentiert. Historischer Auditbefund aus P1-02: keine Produktionsbefunde, vier moderate Einträge einer gemeinsamen esbuild-Entwicklungsserverursache in Drizzle Kit. Der betroffene Serverpfad wird im eingerichteten Ablauf nicht genutzt; bei späteren Abhängigkeitsupdates oder Einführung von Drizzle Studio erneut bewerten. Das ist kein aktueller Auditlauf.

## Paketstatus

### Planungspakete

- **P0-01 – Abgenommen:** Katalogabdeckung untersucht. Katalogvollständigkeit und belastbare Editionsabdeckung bleiben begrenzt.
- **P0-02 – Review:** Vorläufiger Collectr-Importvertrag. Es liegt kein echter Export vor; Exportheader und Werte müssen vor einer realen Migration geprüft werden.
- **P0-03 – Abgenommen:** Hosting- und Kostenvergleich. Zahlen sind historische Annahmen und vor Bestellung neu zu prüfen.
- **P0-04 – Abgenommen:** Private Erreichbarkeit und Identitätsweg über Tailscale/Serve festgelegt.
- **P0-05 – Abgenommen:** Entwicklungsvertrag festgelegt; Implementierung erfolgte anschließend in eigenen Paketen.
- **P0-06/E06 – Abgenommen als Planungsgrundlage:** Backup, Logbegrenzung, Alarm und manueller Restore wurden vereinfacht festgelegt. Das ist keine Einrichtung externer Konten oder Betriebssystemdienste.

### Implementierungspakete

- **P1-01 – Abgenommen:** Next.js-/TypeScript-Grundgerüst, npm-Skripte und Oxlint.
- **P1-02 – Abgenommen:** SQLite-/Drizzle-Verbindung, Migrationen und ausschließlich `users`-Tabelle.
- **P1-03 – Abgenommen:** Auflösung der beiden konfigurierten Tailscale-Identitäten und Adminrolle.
- **P1-04 – Abgenommen:** Lese-/Schreib-/Datei-/Action-Zugriffsschutz und Origin-Prüfung.
- **P1-05 – Abgenommen:** Strukturiertes, redigiertes Anwendungslogging mit Request-ID.
- **P1-06 – Abgenommen:** Linux-Produktionsimage, unprivilegierter Lauf, Loopbackbindung und persistentes Volume.
- **P1-07 – Abgenommen:** Getrennter lokaler Docker-Entwicklungsbetrieb mit Hot Reload.
- **P1-08 – Abgenommen:** Ansible-Hostgrundlage und getrennte Firewallfinalisierung; nur lokale Syntax-/Fixtureprüfungen.
- **P1-09 – Abgenommen:** Tailscale-Policyvorlage, Serve-/HTTPS-Konfiguration und kontrolliertes Deployment mit Datenbanksicherung/Migration. Nicht auf einem Server ausgeführt.
- **P1-10 – Abgenommen:** journald-/Logbegrenzung als Ansible-Konfiguration. Keine echte Hostintegration.
- **P1-11 – Abgenommen:** Konsistenter Backup-Snapshot, Hostrunner, Retention-Gates und täglicher Timer als Dateien/Code. Lokale synthetische Prüfung, kein produktiver Lauf.
- **P1-12 – Abgenommen:** Isolierter Restore-Verifier und Alarm-/Liveness-Helfer. Synthetischer Restic-Upload und Restore gegen ein lokales Repository wurden geprüft; kein B2, produktives Backup oder Alarmdienst.
- **P1-13 – Abgenommen:** Responsive deutsche Hülle, Manifest und Icons. WebKit-Prüfung blieb unvollständig; keine echte iPhone-/Android-Installation.
- **P1-14 – Geplant und ausdrücklich zurückgestellt:** Private Betriebsabnahme. Es gibt keinen echten Server und keinen Betriebsauftrag. Dieses Paket darf nicht durch die Abnahmen P1-09 bis P1-13 als erledigt gelten.
- **P1-15 – Abgenommen:** Automatische Repository-Prüfungen, siehe CI-Nachweis unten.

Keine weiteren Pakete sind beauftragt. Der mögliche nächste fachliche Einzelauftrag ist **P2-01 – Katalogschema und Beispieldaten**. Er bleibt Geplant und kann später ausdrücklich einzeln beauftragt werden. Die Pause endet nicht automatisch mit diesem Bericht.

## Backup-, Betriebs- und Wiederherstellungsgrenzen

E06 sieht eine kurze Betriebsunterbrechung vor: Die App wird für einen konsistenten Datenbank-/Dateisnapshot gestoppt und vor Manifestabschluss, Verschlüsselung und Upload wieder gestartet. Der Backupcode und ein täglicher 03:15-UTC-Timer sind implementiert; Retention bleibt aus, bis ein root-only Dry-run manuell geprüft und ausdrücklich aktiviert wurde. Vorgesehen sind 30 tägliche und 12 monatliche Datenpunkte, getrennte Logsnapshots und externe Healthchecks-Alarme. Lokale Fehlerpfade wurden mit synthetischen Tests geprüft; Fehlerfälle und Zeitplanverhalten auf dem echten Zielhost sowie externe E-Mail-Zustellung bleiben offen.

P1-12 stellte einen synthetischen Restic-Snapshot isoliert wieder her. Das belegt einzelne Wiederherstellungsbausteine, nicht die Verfügbarkeit einer unabhängigen Kopie. Es wurde kein B2-Konto eingerichtet, kein B2-Key verwendet, kein Healthchecks-Ping gesendet, keine E-Mail zugestellt und kein vollständiger Produktivrestore ausgeführt. Externe Alarmzustellung, unabhängig verwahrte Recoverykopie, vollständiger Restore und Zusammenspiel von Docker/systemd auf dem Zielhost bleiben Live-Gates vor echten Sammlungsdaten. Ebenso offen sind die tatsächliche Tailscale-/Firewall-/HTTPS-Abnahme und Geräteprüfung.

Für einen späteren Restore muss das exakte, durch Manifest referenzierte App-Image verfügbar sein. Den geprüften Image-Tarball samt SHA-256-Prüfsumme getrennt vom VPS und vom Backupziel verwahren. Ein Neubau aus demselben Quellstand garantiert keine gleiche Docker-Image-ID und ersetzt diesen Tarball nicht. Systemd-`EnvironmentFile`-Dateien niemals mit `source` oder `.` in einer Shell laden; sie sind Konfiguration und kein Shellcode. Die detaillierten Abläufe und Sicherheitsannahmen stehen in [Entwicklung](entwicklung.md) und der [Betriebsuntersuchung](untersuchungen/betrieb.md).

Das vorgesehene externe Ziel ist Restic bei Backblaze B2 EU Central (Amsterdam), getrennt vom geplanten Hetzner-VPS in Deutschland. Diese physische Trennung ist Planungsstand, noch kein eingerichtetes oder geprüftes Backup. Repositoryadresse, Restic-Passwort, getrennte Zugangsschlüssel und Recovery-Codes unabhängig vom VPS verwahren. Der normale Sicherungsschlüssel braucht für Retention Löschrechte; das ist keine unveränderliche Sicherung gegen kompromittierte Zugangsdaten.

Lokales journald: etwa 14 Tage, zusätzlich 250 MB Budget und 5 GB Freiplatzreserve; Größenlimit und Dateirotation können die tatsächliche Historie verkürzen. Externe Logsnapshots: 30 Tage. Datenretention bedeutet 30 Tage mit vorhandenen Snapshots und zwölf monatliche Wiederherstellungspunkte. Healthchecks.io soll Rico per E-Mail informieren: Hostcheck alle fünf Minuten mit zehn Minuten Grace, Backup täglich mit zwei Stunden Grace. Unter 8 GiB nach zwei Messungen beziehungsweise unter 4 GiB sofort wird ein Platzproblem gemeldet. Kein zusätzlicher zentraler Logstack oder Alarmdienst für Repositorygrößen. Vollständigen Restore initial und anschließend vierteljährlich manuell prüfen; automatische Repositorychecks ersetzen diesen nicht.

## Bisherige Prüfungen und ihre Grenzen

Neben der aktuellen CI wurden Anwendungsauthentifizierung, Schreibschutz/Originprüfung, private Antworten, synthetische SQLite-Migrationen und Datenerhalt geprüft. Dockerprüfungen belegten UID 1000, nativen SQLite-Treiber, persistente Volumes, Loopbackbindung und Entwicklungs-Hot-Reload. Deployment-/Backup-Fixtures prüften gemeinsamen Wartungs-Lock, Wiederanlauf und Fehlerpfade; Ansible-Syntax, Vorlagen und Serve-Validator wurden lokal geprüft. Ubuntu-journald-Tests bestätigten Rotation mit verkürzten Testlimits, nicht 14 Tage reale Laufzeit.

Der synthetische Restic-Restore prüfte Datenbank, Importdatei und Manifest einschließlich Integrität, Versions-/Migrationsabgleich und gezielter Fehlerfälle. Fachliche Kartenmengen konnten mangels Bestandsschema noch nicht geprüft werden. Chromium prüfte die Anwendungshülle bei 320, 390 und 1440 Pixeln, Tastatur-Sprunglink, Manifest/Icons und fehlende private Offlinecaches. Der WebKit-Lauf hing beziehungsweise erreichte das Zeitlimit; er ist ausdrücklich kein bestandener Safari-Test.

Lokale Linux/amd64-Container liefen auf einem arm64-Mac unter Emulation; der Benutzer akzeptierte dies für die bisherigen lokalen Paketprüfungen. Die GitHub-CI prüfte den Code anschließend auf einem Hosted-Ubuntu-Runner. Beides ersetzt weder reale Smartphones noch die VPS-/Tailscale-/Firewall-/Backup-Betriebsabnahme. Vollständige Protokolle und verbleibende manuelle Schritte stehen in [Entwicklung](entwicklung.md). Temporäre Testumgebungen unter `/tmp` und lokale Reviewimages sind keine dauerhaft voraussetzbaren Projektartefakte.

## Repository und CI

Das vom Benutzer bestimmte private GitHub-Repository ist `GrothRico/ygh`. Das SSH-Remote `origin` zeigt darauf; der Prüfbranch ist `codex/p1-15-ci`. Der letzte zuvor gepushte Commit ist `c4322bd`. Der GitHub Actions Workflow in `.github/workflows/ci.yml` läuft auf einem regulären `ubuntu-26.04`-Hosted-Runner bei Push und Pull Request. Er pinnt Checkout und setup-node auf geprüfte Commit-SHAs, setzt Node 24.22.1 aus `.nvmrc`, führt `npm ci --ignore-scripts`, TypeScript-Prüfung, Oxlint, 31 Vitest-Tests, 26 Python-Tests und Produktionsbuild aus. Die Testpipeline trennt die 27 normalen Node-Tests von vier synthetischen Backup-Hostrunner-Fixtures, die `sudo` benötigen, weil der Produktionscode sein Restic-Cacheverzeichnis root-eigen anlegt. Beide Schritte sind Pflicht; keine Assertions oder Produktionsrechte wurden abgeschwächt.

Die finale Hosted-Ausführung für Commit `c4322bd`, [Run 40679032774](https://github.com/GrothRico/ygh/actions/runs/40679032774), war erfolgreich. Ein vorheriger Lauf scheiterte an der Runner-UID bei den vier Hostrunner-Fixtures; die gezielte Trennung behebt dies. Der Workflow hat nur `contents: read`, Checkout-Credentials werden nicht gespeichert, und er nutzt keine Produktivgeheimnisse, Datenbankmigration, Deployments oder Artefakte. Die Root-Tests laufen auf der kurzlebigen Hosted-VM mit synthetischen Daten; diese Methode nicht auf Arbeitsplätzen oder dauerhaften Self-hosted Runnern verwenden. GitHub-Kontingent und Kontoeinstellungen wurden nicht geändert.

## Aktuelle Git-Arbeit und Wiederaufnahme

Die oben als abgenommen aufgeführten Implementierungspakete sind abgeschlossen; der Benutzer hat die Arbeit bis zu einem späteren ausdrücklichen Auftrag pausiert. Der Bericht sowie die dazugehörigen Änderungen in README, Arbeitsablauf, Aufgabenindex und Entwicklungsdokumentation liegen nach `c4322bd` lokal und sind noch nicht committet oder gepusht. Es wurden für diesen Bericht keine Tests oder Implementierungsbefehle ausgeführt.

Beim Wiedereinstieg zuerst `AGENTS.md`, diesen Bericht, `docs/arbeit-mit-llm.md`, den [Aufgabenindex](aufgaben/README.md), die aktuelle Paketbeschreibung und nur deren genannte Fachabschnitte lesen. Den tatsächlichen Git- und Dateistand neu prüfen; keine historischen Pfade oder Befehle als gegenwärtig voraussetzen. Danach genau ein Paket einzeln beauftragen. Als nächster möglicher Fachschritt gilt P2-01, aber weder P2-01 noch P1-14 ist durch diesen Bericht autorisiert.

Vor einem Livebetrieb mit echten Sammlungsdaten müssen P1-14 und die dazugehörigen Betriebs-Gates ausdrücklich behandelt werden. Vor Collectr-Migration müssen zusätzlich P0-02 geklärt und P3-05 mit einem tatsächlichen Export ausgeführt werden. Der Importvertrag ist vorläufig; keine Beispieldaten oder vermeintlich vollständige Setquoten als reale Sammlung ausgeben.

## Noch ausstehender Funktionsausbau

| Bereich | Noch zu erledigen |
| --- | --- |
| P2 | Katalogschema und Beispieldaten, Synchronisierung, Bilder/Suche, Standorte, Bestand und atomare Teilmengenbewegungen. |
| P3 | Collectr-Parsing, Importvorschau/Matching/Übernahme, Setquoten, reale Importabnahme und vollständiger Export. P0-02 vorher freigeben; echte Migration zusätzlich P1-14 und P3-05. |
| P4 | Deckregeln konkretisieren, Rezepte, Bannlisten einschließlich eigener Listen, visueller Editor, Verfügbarkeit, physischer Deckbau, Austausch und Ausleihe. |
| P5 | Draftregeln konkretisieren, Cube-Rezepte und physische Cubes, reproduzierbare Packs, lokaler Pack-/Grid-Draft sowie Sealed/Pooldeckbau. |
| P6 | Manuelles Testfeld und Bedienung. |
| P7 | Optionale Preiszuordnung, Gesamt-/Betriebsabnahme und optionale Kategoriepacks. |

## Arbeitsweise mit dem LLM

Luna übernimmt weiterhin klar abgegrenzte Ausführung; der Hauptagent bleibt die unabhängig und kritisch prüfende Instanz. Reasoning passend zur Aufgabe: Medium als Standard, High bei Sicherheit, Integrität, Restore oder schwieriger Fehlersuche, Low für einfache Dokumentationsänderungen. Kein pauschales High und keine parallelen schreibenden Agenten. Ein Paket nach dem anderen; Selbstprüfung führt zu Review, erst menschliche Abnahme zu Abgenommen. Nach zwei erfolglosen Reparaturversuchen derselben Ursache Diagnose übergeben statt breite Änderungen anzuhäufen.

Beim späteren Start keine vorweggenommenen Tabellen oder allgemeinen Frameworks bauen. Den jeweiligen Paketumfang an den tatsächlichen Dateien prüfen, sinnvolle Verhaltenstests ausführen und Abweichungen offen melden. Sobald der Anwendungsexport existiert, ihn bei neuen fachlichen Tabellen gezielt ergänzen. Keine echten Daten, Produktionsgeheimnisse oder serverseitigen Betriebsaktionen aus einem normalen Implementierungsauftrag ableiten.

Möglicher späterer Startauftrag, **jetzt noch nicht erteilt**:

> Lies den Zwischenbericht vom 28. Oktober 2026, AGENTS.md und den aktuellen Aufgabenindex. Prüfe den tatsächlichen Git- und Dateistand und bearbeite ausschließlich P2-01 mit Luna als ausführendem Agenten und unabhängigem kritischem Review. P1-14 bleibt zurückgestellt; keine Liveeinrichtung, echte Datenmigration oder weiteren Pakete starten.
