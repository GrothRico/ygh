# Aufgabenindex

Stand: Planung abgeschlossen, Implementierung nicht begonnen. Jede Zeile ist ein separat zu beauftragendes Paket. Statusänderungen nur anhand tatsächlicher Arbeit und Freigabe.

Für ein günstiges Modell: eine ID pro Chat/Durchgang. Der [Startprompt](../arbeit-mit-llm.md) und [AGENTS.md](../../AGENTS.md) gelten für jedes Paket. Offene Architekturentscheidungen zuerst klären; das Modell soll sie nicht während einer Implementierung improvisieren.

## Start und Freigabepunkte

1. Historischer Planungshinweis: P0-01 bis P0-06 waren als getrennte Recherche-/Entscheidungspakete vorgesehen. Der aktuelle Stand steht ausschließlich in der Statustabelle; P0-02 und P0-06 sind weiterhin Review.
2. E04/E05 sind als Planungsgrundlage freigegeben. Daraus folgt keine Auth- oder Paketimplementierung; P1-Pakete brauchen ihren eigenen Auftrag.
3. P1-01 einzeln starten, dann in Abhängigkeitsreihenfolge fortfahren. Lokale Prototypen brauchen keinen bestellten Server.
4. P1-14 benötigt einen separaten Betriebsauftrag und eine freigegebene Kostenentscheidung. Vor echten Sammlungsdaten muss dieser Sicherheits-/Restore-Gate bestanden sein.
5. Reale Collectr-Migration braucht zusätzlich P3-05. Ohne Export können die übrigen Funktionen mit synthetischen Daten weiterentwickelt werden.
6. Vor jedem späteren Meilenstein Paketgrenzen gegen tatsächlichen Code prüfen und konkrete Pfade ergänzen. Keine Änderung der Produktanforderungen.

## Arbeitspakete

| ID | Paket | Voraussetzungen | Status |
| --- | --- | --- | --- |
| P0-01 | [Katalogabdeckung untersuchen](m0.md) | — | Abgenommen |
| P0-02 | [Collectr-Vertrag beschreiben](m0.md) | — | Review |
| P0-03 | [Betriebskosten vergleichen](m0.md) | — | Abgenommen |
| P0-04 | [Privaten Zugriff und Identität festlegen](m0.md) | P0-03 | Abgenommen |
| P0-05 | [Entwicklungsvertrag festlegen](m0.md) | P0-04 | Abgenommen |
| P0-06 | [Sicherung und Betriebsprüfung festlegen](m0.md) | P0-03, P0-04 | Review |
| P1-01 | [Minimales TypeScript-Projekt](m1.md) | P0-05 | Review |
| P1-02 | [SQLite und Migrationen einführen](m1.md) | P1-01 | Geplant |
| P1-03 | [Identität und Sitzungen anbinden](m1.md) | P1-02, P0-04 | Geplant |
| P1-04 | [Zugriffsschutz für Server und Dateien](m1.md) | P1-03 | Geplant |
| P1-05 | [Strukturiertes Anwendungslogging](m1.md) | P1-04 | Geplant |
| P1-06 | [Produktionscontainer bauen](m1.md) | P1-05 | Geplant |
| P1-07 | [Docker-Entwicklungsbetrieb](m1.md) | P1-06 | Geplant |
| P1-08 | [Ansible-Servergrundlage](m1.md) | P1-06, P0-03, P0-04 | Geplant |
| P1-09 | [Privates HTTPS und Deployment](m1.md) | P1-08, P1-04 | Geplant |
| P1-10 | [Betriebslogs begrenzen](m1.md) | P1-09, P0-06 | Geplant |
| P1-11 | [Backupjob implementieren](m1.md) | P1-10, P0-06 | Geplant |
| P1-12 | [Restore und Betriebsalarme](m1.md) | P1-11 | Geplant |
| P1-13 | [Mobile Hülle und PWA](m1.md) | P1-07, P1-04 | Geplant |
| P1-14 | [Privaten Betrieb abnehmen](m1.md) | P1-09, P1-12, P1-13 | Geplant |
| P1-15 | [Automatische Repository-Prüfungen](m1.md) | P1-06 | Geplant |
| P2-01 | [Katalogschema und Beispieldaten](m2.md) | P1-02, P0-01 | Geplant |
| P2-02 | [Katalogdaten synchronisieren](m2.md) | P2-01 | Geplant |
| P2-03 | [Bilder und Kartensuche](m2.md) | P2-02, P1-04 | Geplant |
| P2-04 | [Standorte verwalten](m2.md) | P1-04, P1-02 | Geplant |
| P2-05 | [Bestand erfassen und anzeigen](m2.md) | P2-03, P2-04 | Geplant |
| P2-06 | [Teilmengen atomar verschieben](m2.md) | P2-05 | Geplant |
| P2-07 | [Bestandsbedienung vervollständigen](m2.md) | P2-06 | Geplant |
| P3-01 | [Collectr-CSV parsen](m3.md) | P0-02, P2-05 | Geplant |
| P3-02 | [Importvorschau und Matching](m3.md) | P3-01 | Geplant |
| P3-03 | [Import bestätigen und korrigieren](m3.md) | P3-02, P2-06 | Geplant |
| P3-04 | [Setquoten berechnen und anzeigen](m3.md) | P3-03 | Geplant |
| P3-05 | [Realen Import prüfen](m3.md) | P3-03, P1-14 | Geplant |
| P3-06 | [Sammlung vollständig exportieren](m3.md) | P3-03 | Geplant |
| P4-01 | [Deckregeln konkretisieren](m4.md) | P2-07 | Geplant |
| P4-02 | [Deckrezepte speichern](m4.md) | P4-01 | Geplant |
| P4-03 | [Bannlisten und Validierung](m4.md) | P4-02 | Geplant |
| P4-04 | [Visueller Deckeditor](m4.md) | P4-03, P2-03 | Geplant |
| P4-05 | [Verfügbarkeit und physischer Deckbau](m4.md) | P4-04, P2-06 | Geplant |
| P4-06 | [Decklisten austauschen](m4.md) | P4-02, P4-01 | Geplant |
| P4-07 | [Deckausleihe und Sammlungszuordnung](m4.md) | P4-05, P3-04 | Geplant |
| P5-01 | [Draftregeln exakt beschreiben](m5.md) | P4-02 | Geplant |
| P5-02 | [Cube-Rezepte und Editor](m5.md) | P5-01, P4-04 | Geplant |
| P5-03 | [Physischen Cube zusammenstellen](m5.md) | P5-02, P4-05, P4-07 | Geplant |
| P5-04 | [Packs reproduzierbar erzeugen](m5.md) | P5-02 | Geplant |
| P5-05 | [Pack-Draft-Zustand implementieren](m5.md) | P5-04 | Geplant |
| P5-06 | [Lokale Draftoberfläche und Speicherung](m5.md) | P5-05, P1-04 | Geplant |
| P5-07 | [Grid-Draft ergänzen](m5.md) | P5-06, P5-01 | Geplant |
| P5-08 | [Sealed und Pooldeckbau](m5.md) | P5-06, P4-04 | Geplant |
| P6-01 | [Testfeldzustand und Aktionen](m6.md) | P4-02 | Geplant |
| P6-02 | [Testfeld bedienen](m6.md) | P6-01, P5-08 | Geplant |
| P7-01 | [Preiszuordnung untersuchen](m7.md) | P0-01 | Geplant |
| P7-02 | [Optionale Preise anzeigen](m7.md) | P7-01, P2-03 | Geplant |
| P7-03 | [Betrieb und Gesamtabnahme](m7.md) | P1-14, P3-04, P3-06, P4-06, P4-07, P5-03, P5-07, P5-08, P6-02 | Geplant |
| P7-04 | [Optionale Kategoriepacks](m7.md) | P5-07, P5-08 | Geplant |

## Abnahmevermerke

P0-01 (Recherche vom 2026-10-21): Befunde und Quellen stehen in [Katalogabdeckung](../untersuchungen/katalog.md). Konami ist als Primärquelle für manuelle Prüfung geeignet; automatisierter Abruf und Bildnutzung sind nicht freigegeben. Ein konkreter 1st-/Unlimited-Vergleich ist durch Händler-Produktbeschreibungen für Blue-Eyes White Dragon, LOB-001, Ultra Rare belegt; dies ist keine Herstellerbestätigung und belegt keine Artworkgleichheit. YGOPRODecks Stichprobe führt für diesen Druck kein Editionsfeld. Eine vollständige Katalogabdeckung ist nicht nachgewiesen. Die folgende historische Reviewnotiz wurde durch den Freigabevermerk weiter unten abgelöst.

Der aktuelle Status steht in der Tabelle oben; die folgenden Vermerke dokumentieren die Prüf- und Freigabehistorie. Forschungsergebnisse allein sind keine Architekturfreigabe.

Historische Reviewnotiz P0-01 vom 2026-10-21 (vor Benutzerfreigabe): Quellen und Dateiumfang gegengeprüft; zwei fachliche Formulierungen korrigiert, API-Stichprobe ergänzt. Die gezielte Nacharbeit zum Editionsvergleich wurde unabhängig geprüft und fachlich zur Abnahme empfohlen. Der damalige Reviewstatus wurde durch den nachfolgenden Freigabevermerk abgelöst. [Prüfbericht](../untersuchungen/katalog-review.md). Keine Folgeaufgabe gestartet.

Freigabe am 2026-10-21: Der Benutzer hat P0-01 einschließlich der oben beschriebenen Grenzen und YGOPRODeck als primärer Quelle abgenommen und P0-02 beauftragt. Dies ersetzt den früheren Reviewstatus und den offenen E01-Vorschlag. Ausgangsstand weiterhin uncommittete Planungsdateien; keine Implementierung freigegeben.

P0-05 (Recherche vom 2026-10-21): [Entwicklungsvertrag](../untersuchungen/entwicklungsvertrag.md) und E05-Vorschlag in [Entscheidungen](../entscheidungen.md). Offizielle Release-/Paketquellen belegen die ausgewählten stabilen Pins und deklarierte Drizzle-/SQLite-Treiberkompatibilität. Der Vertrag legt npm, Next.js App Router/React, SQLite-Treiber, Testwerkzeuge, Modulgrenzen und Sollbefehle fest. Keine Pakete installiert, kein Lockfile, Install-/Typecheck-/Test-/Build- oder Zielimage-Lauf. Nativer Standalone-Ladevorgang ist P1-06-Gate. Status Review bis zur unabhängigen Prüfung und menschlichen Freigabe; keine Folgeaufgabe gestartet.

P0-02 (Recherche vom 2026-10-21): [Collectr-Vertrag](../untersuchungen/collectr.md) und E02-Vorschlag in [Entscheidungen](../entscheidungen.md). Offizielle Collectr-Hilfe bestätigt nur den PRO-Exportweg, nicht die Exportheader; Fremdprofile liefern eine vorläufige Headergrundlage. Eine echte Exportdatei liegt nicht vor. Status Review bis zur menschlichen Prüfung; Validierung mit der echten Datei bleibt für P3-05 offen. Keine Implementierung, Migration oder Folgeaufgabe gestartet.

Review P0-02 durch den Hauptagenten am 2026-10-21: Offizielle Exporthilfe sowie CardCurrent- und TCG-OS-Headerbeschreibungen unabhängig geöffnet und abgeglichen. Nacharbeit trennt ungeklärte Kartenidentität von ungeklärter Menge/Besitzzuordnung und konkretisiert deutsche Karten mit englischem Namen. CSV-Beispiel geprüft: vier Datenzeilen, je zwölf Spalten, zwei Portfolios und identische Zeilen 1/2. Watchlist-Platzhalter ist bewusst kein bestätigter Exportwert. Änderungsumfang gegen Dateisnapshot, lokale Links und Formatierung geprüft. Fachlich zur Abnahme als vorläufiger Importvertrag empfohlen; echte Exportvalidierung und Implementierung wurden nicht durchgeführt. Status bleibt Review.

P0-03 (Recherche vom 2026-10-21): [Hosting- und Backupkosten](../untersuchungen/hosting.md) und E03-Vorschlag in [Entscheidungen](../entscheidungen.md). Zwei Kombinationen liegen mit externer B2-Sicherung unter 5 € brutto bei angenommener Größe bis 20 GB: netcup VPS nano (2 GB RAM, 3,69–3,77 €) sowie bedingt OVHcloud VPS-1 (4 GB RAM, ca. 4,53–4,61 €, Bestellbedingungen offen). Hetzner CX23 wurde auf Nutzerhinweis als dritte Kombination ergänzt; mit IPv4 liegt die grobe Summe bei ca. 7,21 € brutto. B2-Kosten verwenden 1 USD = 1 € plus 19 % USt. als konservative Annahme. Healthchecks.io-Alarmierung und Tailscale Personal/Serve sind unter den dokumentierten Nutzungsbedingungen kostenfrei angenommen. Sicherungsgröße ist mangels Anwendung nur geschätzt; Restore, Schlüsselaufbewahrung und Betriebsverfahren bleiben P0-06. Status Review bis zur menschlichen Prüfung. Keine Bestellung, Accounts oder Folgeaufgabe gestartet.

Review P0-03 durch den Hauptagenten am 2026-10-21: netcup-Produktseite, Hetzner-Preisanpassung/IPv4-Preis und Tarifressourcen, OVH-Übersichtsangebot, B2-Freikontingent/-Tarif und Healthchecks-Preise unabhängig geprüft. Umsatzsteuer, Vorauszahlung und Backup-Kosten nachgerechnet. OVH-Backup-Retention als unklar korrigiert; unbekannte Lieferbarkeit und Bestellbedingungen bleiben offen. Dateisnapshot bestätigt nur drei beauftragte Dokumente geändert; lokale Links und Formatierung geprüft. Keine Last-, Betriebs- oder Restoretests durchgeführt. Als Kostenvergleich zur Abnahme empfohlen. Die konkrete Anbieterwahl wurde danach auf Hetzner gesetzt (siehe Freigabevermerk und E03); die frühere netcup-Empfehlung ist historisch.

Freigabe P0-03 am 2026-10-21: Benutzer setzt nach der Hetzner-Empfehlung die Planung fort und übernimmt die Bestellung manuell. Hetzner CX23 mit IPv4 und ca. 7,13 € brutto/Monat ist Planungsgrundlage; externer Backup-/Alarmvorschlag wird in P0-06 konkretisiert. Kostenvergleich mit seinen Einschränkungen abgenommen, P0-04 beauftragt; keine Bestellung oder Implementierung freigegeben.

P0-04 (Recherche vom 2026-10-21): [Privater Zugriff und Identität](../untersuchungen/zugriff.md), E04-Vorschlag in [Entscheidungen](../entscheidungen.md). Empfehlung: zwei Tailscale-Benutzer mit MFA/Passkeys, Gerätefreigabe, expliziten Grants, Tailscale Serve/HTTPS und serverseitiger App-Allowlist nach Loginname; Rico allein Admin. Serve-Loginname ist keine unveränderliche ID. Loopback-Upstream, Docker-Engine-Grenze, Route-/Dateiprüfungen, Origin/Host, Cache/Offline und Revoke/Recovery sind konkret beschrieben. E04 und P0-04 bleiben Review bis zur menschlichen Freigabe. Keine Installation, Accounts, Bestellung oder Implementierung gestartet.

Review P0-04 durch den Hauptagenten am 2026-10-21: Serve-Header/Spoofinggrenze, Docker-Loopback-Hinweis und Tailscale-SSH-Regeln unabhängig mit Primärdokumentation abgeglichen. Nacharbeit konkretisiert Owner/Member, Server-Tag, separate SSH-Regel, Docker-Netz, appseitige Sperre und Recovery; lokale Hostprozesse ausdrücklich als Vertrauensgrenze benannt. Logout-Wirkung verständlich ergänzt. Snapshotabgleich bestätigt drei beauftragte Dateien; lokale Links/Formatierung geprüft. Fachlich zur Abnahme empfohlen. Google-Konten/MFA und konkrete Login-Namen sind vor Einrichtung zu bestätigen; praktische Zugriffs-, Sperr- und Recoverytests bleiben offen. Keine Sicherheitsgarantie oder Implementierung. Die damalige Prüfungsempfehlung wurde durch die Freigabe weiter unten abgelöst.

Freigabe P0-04 am 2026-10-21: Benutzer bestätigt mit „go“ die Fortsetzung zu P0-05 auf Grundlage des geprüften Zugriffskonzepts. P0-04 als Planungsgrundlage abgenommen; konkrete Konten/MFA-Konfiguration und praktische Sicherheitstests bleiben vor Einrichtung offen. P0-05 ist beauftragt, weiterhin keine Implementierung.

Historische Reviewnotiz P0-05 vom 2026-10-21 (vor Benutzerfreigabe): Next-/better-sqlite3-Registry-Metadaten, versionierte Drizzle-0.45.4-Peerangabe sowie Next-CLI und Vitest-Supportlinie wurden unabhängig abgeglichen. Nacharbeit ergänzte Loopback im lokalen Dev-Befehl, typegen vor tsc, server-only erst ab P1-02 und Prüfung des nativen Moduls im finalen Dockerimage. Direkter Registryabruf aus der Shell scheiterte zunächst an DNS; spätere Versionsmatrix basiert auf dem direkt geprüften Rohbeleg in der Untersuchung. Keine Paketinstallation, kein Lockfile, kein Build oder Anwendungstest erfolgt. Exakter Docker-Tag, npm-Peerauflösung und gemeinsame Laufzeitkompatibilität bleiben praktische Prüfungen in P1. Der damalige Reviewstatus wurde durch die Freigabe weiter unten abgelöst.

Freigabe P0-05 am 2026-10-21: Benutzer bestätigt Fortsetzung zu P0-06. Entwicklungsvertrag als Planungsgrundlage abgenommen; echte Installations-/Buildprüfungen bleiben den Implementierungspaketen vorbehalten. Hauptagent bleibt ausdrücklich kritischer Reviewer, Luna ausführender Agent. P0-06 beauftragt; keine Implementierung freigegeben.

P0-06 (Recherche vom 2026-10-21): [Sicherung und Betriebsprüfung](../untersuchungen/betrieb.md), E06-Vorschlag in [Entscheidungen](../entscheidungen.md). Vertrag beschreibt SQLite Online Backup API samt abgestimmtem kurzen Schreibfenster für DB und Importoriginale, Restic/B2 EU Central, Schlüsselverwahrung außerhalb des VPS, Daten- und Log-Retention, Größen-/Alarmgrenzen, Tailscale-Logverfügbarkeit und isolierten vierteljährlichen Restore-Test. Der Vorschlag grenzt Upload-/Repositoryprüfungen ausdrücklich vom echten Restore ab. Keine Jobs, Konten, Backups, Uploads, Alarme oder Restoretests ausgeführt; Zielsystem, Schlüssel, Mailzustellung und Zieltreiber bleiben praktische Prüfungen in P1-11/P1-12/P1-14. Status Review bis unabhängiger Prüfung und menschlicher Freigabe; keine Folgeaufgabe gestartet.

Review P0-06 durch den Hauptagenten am 2026-10-21: SQLite-, Restic-, Docker-/journald-, Tailscale- und Healthchecks-Dokumentation unabhängig gegengeprüft. Konkrete Fehler zu Tages-Retention, Logarchiven und unbelegten Speicherlimits zur Nacharbeit zurückgegeben und korrigierte Fassung geprüft. Stabile Snapshotpfade, Prune-Takt, B2-Lifecycle-Grenzen und lesender Restore ergänzt. Einheitliche lokale Loghistorie von etwa 14 Tagen, externe Sicherheits-/Betriebsarchive von etwa 30 Tagen sind der konkrete E06-Vorschlag; Zeitgranularität und spätere physische Löschung sind dokumentiert. Änderungsumfang, lokale Markdownlinks und Formatierung geprüft. Fachlich zur Abnahme empfohlen; keine Installationen, Backups, Alarme oder Restoretests durchgeführt. Status bleibt Review; kein Folgepaket begonnen.

Nacharbeit P0-01 bis P0-05 am 2026-10-21: Luna ergänzte die versionierte Kompatibilitätsmatrix, eindeutige manuelle Collectr-Szenarien und bereinigte historische Statusaussagen. Der Hauptagent prüfte alle 15 exakten npm-Pins direkt gegen die öffentliche Registry (ohne Installation), glich die Engine-/Peerangaben ab und ließ insbesondere den erforderlichen Vite-Peer sowie unbekannte Kartensprache im Collectr-Basisfall präzisieren. CSV-Struktur und Sollmengen geprüft: vier Zeilen, zwölf Spalten, Bestand A=2/B=1, Watchlist B=1 separat. Abschlussprüfung gegen Dateisnapshot: nur die neun vorgesehenen Dokumente geändert, keine Dateien gelöscht, lokale Links und Whitespace fehlerfrei; Statuszeilen unverändert. Die identifizierte Dokumentationsnacharbeit ist fachlich abgeschlossen. P0-02 bleibt Review; reale Exportvalidierung und praktische P1-Prüfungen bleiben offen. Keine Implementierung, Installation, neue Freigabe oder Folgeaufgabe.

P1-01 (2026-10-21): Minimales Next.js-App-Router-/TypeScript-Grundgerüst mit deutscher Startseite, exakten Pins, Lockfile, Loopback-Dev-Skript und Vitest-Smoke-Test eingerichtet. Verwendet: Node 24.22.1/npm 11.19.1. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` und `npm run build` erfolgreich; `npm run dev` auf `127.0.0.1:3000` gestartet und HTTP-GET mit Status 200 geprüft. Vitest-Peer `vite@8.3.5` wurde durch npm automatisch aufgelöst und im Lockfile festgehalten. npm meldete fünf „high“-Auditbefunde; Detailbewertung offen. Status Review bis zur unabhängigen Prüfung; keine Folgeaufgabe gestartet.

Unabhängiger Review P1-01 am 2026-10-21: Hauptagent wiederholte npm ci, typecheck, lint, den einen Render-Smoke-Test und build erfolgreich unter Node 24.22.1/npm 11.19.1; Startseite im Browser geprüft. Umfang bleibt minimales Grundgerüst. Sicherheitsnachprüfung: keine npm-Auditbefunde in Produktionsabhängigkeiten; fünf High-Einträge aus einer ungepatchten braces-Lücke in der Lint-Kette. ESLint-9-EOL und Konflikt eines direkten ESLint-10-Upgrades mit Plugin-Peers sind in docs/entwicklung.md dokumentiert. Daher Review mit offenem Wartungs-/Sicherheitsbefund, keine uneingeschränkte Abnahmeempfehlung. Kein Folgepaket, Commit oder Deployment.
