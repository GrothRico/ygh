# Entwicklung

Stand mit Repository abgeglichen: 5. November 2026. Diese Datei beschreibt den vorhandenen Entwicklungsweg. Paketstatus und Aufträge stehen ausschließlich im [Aufgabenindex](aufgaben/README.md). Frühere Prüfergebnisse sind in der [Prüfchronik](historie/pruefprotokolle-p1.md) erhalten; Servereinrichtung und offene Live-Prüfungen stehen unter [Betrieb](betrieb.md).

## Voraussetzungen und lokale Einrichtung

Aus dem Projektverzeichnis arbeiten. Node-Version aus `.nvmrc` verwenden (derzeit 24.22.1, Manifestbereich 24.22.x); bei vorhandenem nvm: `nvm install` und `nvm use`. npm ist der einzige Paketmanager. Maßgeblich sind `package.json`, `package-lock.json` und die Ansible-Requirements, keine Versionsliste in einem alten Bericht.

```sh
npm ci --ignore-scripts
npm run dev
```

Der Entwicklungsserver bindet an `http://127.0.0.1:3000`; Ctrl-C beendet ihn. `.env.example` beschreibt die erforderlichen Variablen; lokale Werte in einer ignorierten `.env` verwahren. Für gewöhnliche Tests nur synthetische Identitäten und temporäre Datenbanken verwenden. Native SQLite-Module sind plattformspezifisch: Host-`node_modules` niemals ins Linux-Image kopieren. Der bestehende CI-/Dockerweg funktioniert mit `--ignore-scripts`; bei einem später fehlenden Prebuild die Ursache prüfen statt pauschal Installationsskripte freizuschalten.

| Variable | Bedeutung |
| --- | --- |
| `DATABASE_PATH` | Pfad zur lokalen SQLite-Datei; Elternverzeichnis muss existieren. |
| `TAILSCALE_RICO_LOGIN` | Exakter Login des alleinigen App-Admins. |
| `TAILSCALE_SECOND_USER_LOGIN` | Davon verschiedener Login des zweiten Benutzers. |
| `APP_ORIGIN` | Private reine HTTPS-Origin ohne Pfad, Query oder Fragment; erforderlich für Schreibzugriffe. |

Ohne vertrauenswürdige Identität ist „Zugriff verweigert“ erwartetes Verhalten. Im normalen Entwicklungsweg werden der freigegebene Serve-Identitätsweg und zwei passende aktive DB-Benutzer benötigt. Migrationen erzeugen das Schema, **keine Benutzer**. Der bestehende Stack `ygh-dev` seedet keine Benutzer; Tests richten ihre synthetischen Benutzer selbst ein. Der getrennte lokale Testzugang mit Seed ist ausschließlich der eigene Stack `ygh-local` unter [Lokaler Entwicklungszugang](#lokaler-entwicklungszugang-ohne-tailscale). Der Erstinitialisierungspfad im Deployment bleibt ein gesonderter Betriebsablauf.

## Prüfungen

```sh
npm run typecheck
npm run lint
npm test
npm run build
python3 -m unittest discover -s scripts -p 'test_p112_*.py' -v
python3 -m unittest discover -s infra/ansible/files -p 'test_verify_tailscale_serve.py' -v
```

`typecheck` erzeugt Next-Routentypen und prüft TypeScript; `lint` verwendet Oxlint. Vitest nutzt temporäre Datenbanken, keine echte Sammlung. Auf macOS überspringen 13 Linux-spezifische Tests ihre Ausführung: sechs bestehende Backup-/Deploymenttests und sieben Katalog-Hostrunnertests. Die Katalog-Hostrunnertests verwenden synthetische Docker-/Node-Ersatzbefehle und benötigen auf Linux keine Rootrechte. Auf Linux benötigen vier Tests in `scripts/backup-runner.test.ts` Rootrechte für das unveränderte Hostskript. Für einen unprivilegierten Linux-Lauf diese gezielt mit `npm test -- --exclude scripts/backup-runner.test.ts` ausnehmen und die vier Hosttests separat in einer entbehrlichen isolierten Linux-Umgebung oder der vorhandenen CI prüfen. Ein Teillauf ist kein vollständiger Nachweis; nicht einfach `sudo npm test` auf dem Arbeitsplatz ausführen.

Der Workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) ist die ausführbare Referenz für CI-Befehle. Er läuft bei Push und Pull Request auf GitHub-hosted Ubuntu 26.04: Installation, Typprüfung, Lint, normale Node-Tests, vier Hosttests, beide Python-Gruppen und Build. Nur der Hosttestschritt nutzt sudo. Read-only Repositoryberechtigung, keine gespeicherten Checkout-Credentials, keine Produktionsgeheimnisse, keine Deployments. Root führt dabei auch npm/Vitest-Abhängigkeiten aus; dies ist keine Vorlage für dauerhafte Self-hosted Runner. Actions sind auf Commit-SHAs gepinnt.

Letzter dokumentierter vollständiger Lauf: [2. November 2026, Commit af15810](https://github.com/GrothRico/ygh/actions/runs/41453406616), 77 Node-Tests (73 normale und vier Root-Hosttests), 26 Python-Tests sowie Typprüfung, Lint und Build erfolgreich. Die zusätzlichen lokalen P2-01-Prüfungen vom 2. November stehen im [Paketprotokoll](historie/p2-01-2026-11-02.md); die zusätzlichen P2-03-Prüfungen einschließlich Backup-Testkorrektur stehen im [Paketprotokoll](historie/p2-03-2026-11-02.md). CI deckt weder Ansible-Livebetrieb noch echte Geräte oder B2 ab.

Der Hauptbranch heißt seit dem 2. November 2026 auf ausdrücklichen Benutzerwunsch `main`, lokal mit `origin/main` verknüpft. Die GitHub-Umbenennung von `codex/p1-15-ci` erhielt den Commit `aa25cef` unverändert. Historische Branchangaben bleiben als damaliger Stand erhalten.

## Collectr-Parser

`src/server/imports/collectr-csv.ts` stellt `parseCollectrCsv` für UTF-8-Bytes oder Text bereit. Die Funktion liest keine Dateien und schreibt keine Datenbank. Sie erhält Rohdatensätze und Quellfelder; Feldbreiten-, Mengen- und Watchlist-Probleme stehen an jeder betroffenen Zeile. `ok: true` bestätigt nur auswertbare CSV-Syntax, nicht eine fehlerfreie oder importierbare Sammlung. Die zusammengefasste Fehlerliste ist begrenzt; `diagnosticsTruncated` weist darauf hin, während alle Zeilenbefunde erhalten bleiben.

Grenzen: 10 MiB, 50.000 CSV-Datensätze einschließlich Header und 256 Spalten. Unlesbare Syntax, ungültiges UTF-8 oder ungültige Header führen zum Datei-Fehler. Der fokussierte synthetische Test läuft mit `npm test -- src/server/imports/collectr-csv.test.ts`. Upload, Vorschau und Übernahme sind noch nicht implementiert; echte Exporte gehören nicht in gewöhnliche Tests oder Git.

## Datenbank und Migrationen

Implementiert sind `users`, `locations`, `cards`, `sets`, `variants`, `printings`, `source_printing_observations`, `catalog_sync_status`, `catalog_source_payloads`, `stock` und `activity_log` samt Drizzle-Migrationsmetadaten in `src/server/db/`. Die Migrationen `0001_catalog.sql`, `0002_catalog_sync.sql` und `0003_catalog_source_payloads.sql` ergänzen den Katalog; `0004_locations.sql` ergänzt den physischen Standortbaum; `0005_stock.sql` ergänzt Kartenbestand und Verlauf. Das [Datenmodell](datenmodell.md) beschreibt zusätzlich geplante Tabellen, die noch nicht existieren. Die Verbindung aktiviert Fremdschlüssel. Migration `0009_limited_edition` erweitert die Editionswerte von Varianten und Beständen um `limited`. Dabei werden die abhängigen Tabellen in einer Transaktion mit aktiven Fremdschlüsseln neu aufgebaut und vorhandene Daten/Indizes erhalten. Vor tatsächlicher Verwendung von Limited muss die Migration auf der gewählten Datenbank angewendet sein; eine Migration bestehender echter Daten benötigt einen separaten Betriebsauftrag. Migrationen werden versioniert; kein `drizzle-kit push`.

```sh
npm run db:generate
DATABASE_PATH=/absoluter/pfad/zur/entbehrlichen/test.sqlite npm run db:migrate
```

Vor Ausführung einen existierenden Testordner und bewusst gewählten Datenbankpfad einsetzen. Generierte SQL-Dateien prüfen; Migration echter Daten ist kein Entwicklungstest. Das Schema oder die Verbindung nicht beim normalen Modulimport automatisch migrieren.

### Bestand und Ordner verwalten

Die geschützte Ansicht `/bestand` bündelt Ordnerverwaltung und Kartenbestand. Auf Desktop steht links ein kompakter, klappbarer Baum; mobil bleiben rahmenlose Ordnerlinks, der größere Pfad und ein Zurück-Pfeil zum Parent. Einen zusätzlichen Standortfilter oder Startstandort-Assistenten gibt es nicht. `/standorte` leitet nach Identitätsprüfung nach `/bestand` weiter.

Normale Ordner haben nur Name und Parent, keine Benutzer-/Typzuordnung. Den Ordner-plus-Button neben dem Pfad wählen; im Dialog den Namen eingeben und „Ordner anlegen“ bestätigen. Jeder neu geöffnete Dialog startet ohne alte Meldungen. Der separate Hinweis „Aktueller Ordner“ und die bisherige Eingabezeile entfallen; Pfadteile werden bei Hover/Fokus blau unterstrichen. Drei Punkte am Ordner öffnen Umbenennen, Bewegen und Löschen; auf Desktop bei Hover/Tastaturfokus, mobil dauerhaft sichtbar. Ein Klick außerhalb oder Escape schließt das Menü. Dialoge erhalten Eingaben bei Fehlern und unterstützen Abbrechen/Escape. Der Bewegungsdialog zeigt Ziele als Baum, den gewählten Pfad und „Oberste Ebene“. Eigener Ordner und Nachfahren sind gesperrt. Löschen verlangt Bestätigung und prüft erneut, ob weder Karten noch Unterordner vorhanden sind. Nach Löschen des geöffneten Ordners navigiert der Browser zum serverseitig ermittelten Parent. Alle Mutationen behalten Identitäts-, Aktivstatus-, Host-/Origin-Prüfungen.

Migration `0007_unowned_location_folders` entfernt die bisherige Benutzerbindung bei erhaltenen IDs, Namen, Verschachtelungen, Beständen und Verlauf. Ein Standardordner „Ungeklärt“ wird bei fehlendem Eingang automatisch angelegt; vorhandene ID/Bezeichnung bleiben erhalten. Dieser Standardordner bleibt gegen Löschen und Verschieben geschützt. Der lokale Initialisierungsweg wendet Migrationen beim Start an; der normale lokale Stack wurde nach konsistenter Sicherung damit aktualisiert. Dies ist kein Produktivauftrag.

### Karten erfassen und korrigieren

Auf der Startseite eine Karte suchen und „Details und Erfassung“ öffnen; derselbe Detailschalter gilt für alle Suchtreffer. Druck/Variante, Sprache, Edition, Menge und Standort wählen und direkt hinzufügen. Sprache, Edition und Standort bleiben bei weiterer Suche im aktuellen Seitenzustand erhalten; Druck und Menge gelten je Treffer. Erfolgreiches Speichern und Fehler erhalten die Auswahlwerte, Einklappen erhält die Eingaben. Bilder werden weiterhin ausschließlich lokal geladen.

Die kompakte Bestandsansicht zeigt das Kartenbild neben den Angaben; ausgeklappte Bearbeitungsformulare nutzen die volle Zeilenbreite. Dialoge unterscheiden Abbrechen und Speichern visuell. Die Bestandsansicht gruppiert bestätigte Zeilen je Variante, Edition und Standort sprachübergreifend mit Sprachaufteilung; unbestätigte Druckbeobachtungen bleiben getrennt. „Druckdetails und Bearbeitung“ öffnet alle sichtbaren Gruppen gemeinsam für Einzelzeilen, versionsgeprüfte Korrekturen und Verlauf. Korrekturen behalten Karte und Standort bei. Bis zu 25 Gruppen je Seite: SQLite wählt die Gruppen samt Sprachmengen nach Ordnerfilter aus, danach werden nur die Detailzeilen dieser Seite geladen. Ein zusätzlicher Gruppendatensatz ohne Detailzeilen zeigt eine Folgeseite an. Beide Leseabfragen laufen in derselben Lesetransaktion. Bis zu fünf jüngste Verlaufsangaben je Einzelzeile; Ordnerwechsel beginnt auf Seite 1, Seitenlinks behalten den Ordnerumfang. P2-06 ergänzt `moveStock` und die geschützte Serveraktion `mutateStockAction` mit `operation=move`, `id`, `version`, `destinationId` und `quantity`. Die Funktion übernimmt alle Kartenmerkmale aus dem gespeicherten Quellbestand. Vor Verwendung ist Migration `0008_stock_movements` nötig. Der normale Anwendungsstart migriert keine Datenbank; die Initialisierung des ausdrücklich gestarteten lokalen Entwicklungsstacks führt dagegen die Migrationen aus. Das Verschieben ist in der kompakten Ansicht verfügbar: je Sprach-/Druckbestand Checkbox und Menge wählen, dann den Ordnerpfeil neben „Ordner anlegen“ verwenden. Identische Kartenbestände derselben Sprache, Edition und Druckreferenz am selben Ort erscheinen als eine Checkbox mit Gesamtmenge, auch wenn sie intern aus mehreren Teilbeständen bestehen. Die angeforderte Menge wird stabil auf diese Teilbestände mit ihren ursprünglichen Versionen aufgeteilt. Ein gemeinsamer Dialog zeigt die Auswahl und fragt nach dem Ziel. Die Auswahl gilt nur für die sichtbare Seite und wird bei Ordner-/Seitenwechsel aufgehoben. Quellordner der Auswahl sind als Ziel gesperrt; deren andere Unterordner bleiben erreichbar. Die Mengen und Quellversionen werden beim Auswählen festgehalten. Fehler erhalten Auswahl und Ziel; bei Versionskonflikt schließt „Neu laden“ den Dialog, leert die Auswahl und aktualisiert die Ansicht. Mehrere unterschiedliche Karten werden durch `moveStocks` und `operation=move_many` gemeinsam in einer unmittelbaren Transaktion verschoben; ein Fehler bei einer späteren Position rollt sämtliche Änderungen zurück. Der bestehende Einzelaufruf bleibt kompatibel. Nach Erfolg wird die Auswahl geleert und die bleibende Meldung fokussiert. Der Verlauf zeigt Menge sowie „Von“-/„Nach“-Pfade anhand der aktuellen Ordnernamen; bei inzwischen gelöschten Ordnern bleibt deren ID sichtbar. Beide Benutzer dürfen alle Bestände bearbeiten; jede geschützte Aktion prüft Identität und Host/Origin.

## Katalogimport

P2-02 ergänzt einen manuellen YGOPRODeck-v7-Import. Er lädt die vollständigen englischen und deutschen Kartenantworten (mit `misc=yes`), die Setliste und den Datenbankversionsstand. Nach erfolgreicher Validierung speichert er diese vier vollständigen geparsten JSON-Dokumente zusätzlich zu den normalisierten Feldern in `catalog_source_payloads`. Das bewahrt unbekannte Felder, weitere Antwortfelder und Karten ohne englische Zuordnung; es ist jeweils nur der letzte erfolgreiche Stand, kein Rohdatenverlauf oder Einzelkartenindex. Die Tabellenzeilen, JSON-Hüllen und unbekannten verschachtelten Felder werden erhalten, nicht die ursprüngliche Bytefolge der HTTP-Antwort. `misc=yes` liefert zusätzliche Kartenfelder, aber keine eigens angeforderten Antworten für alle formatabhängigen Sonderfälle. Alle Antworten werden vor der Schreibtransaktion als JSON eingelesen; die für den Katalog benötigten Felder werden validiert. Unbekannte Zusatzfelder bleiben ohne fachliche Interpretation erhalten. Deutsche Einträge werden nur über dieselbe Karten-ID zugeordnet; fehlende deutsche Datensätze überschreiben keine vorhandene Übersetzung. Unbestätigte Setcode-/Seltenheitsangaben bleiben Quellbeobachtungen und erzeugen keine bestätigten Varianten oder Drucke.

Nur eine bewusst gewählte lokale Katalogdatenbank verwenden. Die CLI migriert nie selbst und verlangt eine bereits migrierte Datenbank. Für eine neue entbehrliche Datei muss das Elternverzeichnis existieren; einen bewusst gewählten absoluten Datenbankpfad einsetzen:

```sh
DATABASE_PATH=/absoluter/pfad/zur/lokalen-katalog.sqlite npm run db:migrate
DATABASE_PATH=/absoluter/pfad/zur/lokalen-katalog.sqlite npm run catalog:sync -- sync
DATABASE_PATH=/absoluter/pfad/zur/lokalen-katalog.sqlite npm run catalog:sync -- status
```

Der Synchronisationsaufruf benötigt Netzwerkzugriff auf die fest eingetragenen HTTPS-Endpunkte. Er lädt keine Bilder herunter. In den vollständigen JSON-Antworten enthaltene Preisangaben werden mitgespeichert; es gibt keine gesonderte Preisabfrage, normalisierte Preiszuordnung oder Anzeige. Kartenspielwerte können ebenfalls in den Payloads stehen, werden von der Anwendung aber nicht als Fachspalten verwendet. Der Import löscht keine vorhandenen Karten, Sets, Varianten oder Drucke. Payloads, normalisierte Projektionen und Erfolgsstatus werden gemeinsam transaktional gespeichert. `fetched_at` entspricht dem bisherigen `attemptedAt`, also dem Beginn des Synchronisationsversuchs. Ein Netzwerk-, Parse- oder Schreibfehler lässt den letzten erfolgreichen Payload- und Katalogstand unverändert; der Fehlversuch wird separat im Syncstatus geführt. Die normale SQLite-Sicherung umfasst die Payload-Dokumente. Der offizielle Guide dokumentiert Datenbankversion und Datum, aber nicht die konkrete JSON-Hülle der Versionsantwort. Der Parser akzeptiert defensiv ein Objekt oder ein Array mit genau einem Objekt; die aktuelle Liveform wurde nicht belegt. Druckcode-/Raritätsbeobachtungen belegen keine Sprache, Edition oder Artworkzuordnung.

Ein separater Hostrunner ist für die wöchentliche Aktualisierung sonntags um 06:00 UTC mit systemd vorbereitet; er führt den Katalogimport vor dem Bildimport im Worker aus und teilt den Wartungs-Lock mit Backup und Deployment. Das Ansible-Playbook ist nicht an andere Playbooks angehängt und nicht auf einem Host ausgeführt. Der lokale Entwicklungsstack hat keinen automatischen Kataloglauf; seine CLI-Aufrufe bleiben manuell und verwenden nur den angegebenen Datenbankpfad. Voraussetzungen, Lock-/Worker-Verhalten und Grenzen stehen in [Betrieb: Katalogspeicher und automatische Aktualisierung](betrieb.md#katalogspeicher-und-automatische-aktualisierung).

Im lokalen Stack kann die CLI direkt gegen dessen Datenbankvolume laufen, ohne den Datenbankpfad im Container zu verändern:

```sh
docker compose -p ygh-local -f compose.local.yaml exec local node scripts/catalog-sync.mts status
docker compose -p ygh-local -f compose.local.yaml exec local node scripts/catalog-sync.mts sync
```

Nach diesem Codeupdate muss das Entwicklungsimage neu gebaut und die lokale Testdatenbank migriert werden. Der ausdrücklich gestartete lokale E09-Stack erledigt seine Migration beim Start; echte Daten dürfen nur im Rahmen eines gesonderten Betriebsauftrags migriert werden. `sync` startet selbst keine Migration; der Katalogimport wird weder beim Containerstart noch beim Anwendungsstart automatisch ausgeführt. Der Produktionsrunner enthält dieselbe manuelle CLI, führt sie aber ebenfalls nicht beim Start aus.

## Kartensuche und Bilder

Die geschützte Startseite sucht in deutschen und englischen Kartennamen sowie bestätigten Druckcodes und unbestätigten Quellbeobachtungen. Exakte Codes stehen zuerst; kleine Schreibfehler werden bei Namen und ausreichend langen Codes toleriert. Die Trefferzahl ist auf 30 begrenzt. Drucke mit expliziter Variante bleiben als bestätigt gekennzeichnet; Quellbeobachtungen werden sichtbar als nicht bestätigt dargestellt. Verschiedene bestätigte Artworks bleiben getrennt. Eine englische Quellenabbildung ist nur eine Kartenreferenz und bestätigt keine konkrete Druckvariante.

Die geschützte Route `/api/cards/[cardId]/image` prüft zuerst die Identität, liest danach den Katalog und liefert ausschließlich einen vorhandenen gültigen JPG-Cache. Sie ruft den Bildanbieter beim Suchen oder Anzeigen nie auf; Cachemiss oder ungültiges Bild ergibt HTTP 404 und die UI zeigt einen Platzhalter. Die Cachedatei liegt in `card-images/` neben der Datenbank, im Container unter `/data/card-images`. Die Backupskripte sichern Datenbank und Importdateien, nicht diesen regenerierbaren Bildcache.

Der Bildcache wird durch die Import-CLI befüllt: lokal manuell, auf dem späteren Server zusätzlich über den separat eingerichteten Hosttimer. Der manuelle Aufruf lautet:

```sh
DATABASE_PATH=/absoluter/pfad/zur/lokalen-katalog.sqlite npm run catalog:images -- sync
```

Die CLI öffnet die bereits migrierte SQLite-Datenbank nur lesend und betrachtet ausschließlich Karten mit Quelle `ygoprodeck` und numerischer Quell-ID. Sie lädt das kleine englische Referenzbild `cards_small/{ID}.jpg`; es behauptet keine Zuordnung zu einzelnen Drucken und lädt keine abweichenden Artworks. Gültige Cachedateien werden übersprungen, sodass ein späterer manueller Lauf nach einem Abbruch fortsetzen kann. Eine 404-Antwort wird als nicht verfügbares Bild gezählt und übersprungen. Netzwerk-/Serverfehler, ungültige oder zu große Antworten, Cachefehler sowie HTTP 403/429 beenden den Lauf; bei 403/429 gibt es keinen sofortigen Wiederholungsversuch. Zuvor erfolgreich gespeicherte Dateien bleiben erhalten.

Pro Cacheverzeichnis läuft höchstens ein Import gleichzeitig; der Sperrmarker heißt `/data/card-images/.catalog-images.lock` im Container. Nach einem harten Prozessabbruch den Marker nur entfernen, nachdem feststeht, dass kein Bildimport mehr läuft. Verwaiste Dateien `.*.tmp` dürfen ebenfalls erst nach dieser Prüfung entfernt werden. Jeder Abruf hat acht Sekunden Timeout, Redirects werden abgewiesen, Antworttyp und JPEG-Signatur geprüft, Größe ist auf zwei MiB begrenzt. Der Import startet pro Quelle höchstens eine Anfrage pro Sekunde. Das ist eine vorsichtige lokale Begrenzung, keine vom Anbieter bestätigte Bildrate oder Garantie gegen Blockierung: Der [YGOPRODeck-API-Guide](https://ygoprodeck.com/api-guide/) nennt allgemein 20 API-Anfragen pro Sekunde und eine mögliche einstündige Sperre, gibt für Bildabrufe bei hoher Last aber keine numerische Grenze an. Bei 15.000 fehlenden Kartenbildern dauert ein erster Lauf mit der gewählten Pause rechnerisch rund 4,2 Stunden; diese Dauer wurde nicht gemessen. Im lokalen Entwicklungsstack gibt es keinen automatischen Lauf; Seitenaufrufe lösen auch auf dem Server niemals Provideranfragen aus.

Im lokalen Stack kann der gleiche bewusste CLI-Aufruf gegen dessen eigenes Datenvolume laufen:

```sh
docker compose -p ygh-local -f compose.local.yaml exec local npm run catalog:images -- sync
```

Der Entwicklungs- und Produktionscontainer enthalten den CLI-Code, führen ihn aber weder beim Start noch eigenständig in einem Hintergrundjob aus. Der separate Hosttimer muss auf einem freigegebenen Zielhost bewusst mit `configure-catalog-update.yml` eingerichtet werden. Die Backupskripte sichern den regenerierbaren JPG-Cache nicht.

## Docker-Entwicklung

Der eigenständige Stack nutzt `Dockerfile.dev`, Linux/amd64, den nicht privilegierten Benutzer `node`, Loopback-Port 3001 und das getrennte Volume `ygh-dev_dev-data`.

```sh
docker compose -p ygh-dev -f compose.dev.yaml build
docker compose -p ygh-dev -f compose.dev.yaml up -d
docker compose -p ygh-dev -f compose.dev.yaml logs -f dev
docker compose -p ygh-dev -f compose.dev.yaml down
```

`down` erhält das Datenvolume. Explizite lokale Schemamigration bei laufendem Stack: `docker compose -p ygh-dev -f compose.dev.yaml exec dev npm run db:migrate`. Auch dabei entstehen keine Benutzer. Nur `src/` ist lesend eingebunden; Änderungen daran unterstützen Hot Reload. Andere Dateien, Abhängigkeiten und Konfiguration erfordern einen Neubau (`up -d --build dev`). `Dockerfile.dev` kopiert `public/` ins Image, damit Icons im Entwicklungscontainer verfügbar sind.

## Lokaler Entwicklungszugang ohne Tailscale

Der getrennte E09-Stack öffnet die geschützte Oberfläche mit zwei fest definierten synthetischen Testbenutzern. Er benötigt weder persönliche Tailscale-Logins noch `APP_ORIGIN`. Nur die Datei `compose.local.yaml` setzt den lokalen Modus und bindet den Hostport ausschließlich an `127.0.0.1:13001`. Der separate Tailscale-Entwicklungsstack `ygh-dev` bleibt auf Port 3001. Der lokale Zugang nutzt seit dem 3. November 2026 den eigenen Port 13001, um Kollisionen mit anderen Entwicklungsprojekten zu vermeiden.

```sh
docker compose -p ygh-local -f compose.local.yaml up --build
# Browser: http://127.0.0.1:13001
```

Standardmäßig meldet sich der Test-Admin an. Für die Mitgliedsrolle den Stack stoppen und vor demselben `up`-Befehl `YGH_LOCAL_DEV_USER=member` setzen:

```sh
docker compose -p ygh-local -f compose.local.yaml down
YGH_LOCAL_DEV_USER=member docker compose -p ygh-local -f compose.local.yaml up --build
```

Zurück zum Test-Admin wird `YGH_LOCAL_DEV_USER` weggelassen. `down` erhält das Volume `ygh-local_local-data`; die Datenbank liegt fest unter `/data/collection-local.sqlite`. Der Start migriert eine neue Datenbank und richtet einmalig die zwei `.invalid`-Identitäten ein. Wiederstarts bewahren Benutzer-IDs, Aktivstatus und Daten. Fehlende Testbenutzer werden nicht wiederhergestellt. Eine bereits vorhandene Datenbank ohne genau diese beiden Testidentitäten wird vor Migration abgewiesen. Katalogfixtures und echte Sammlungen werden nicht geladen.

`YGH_LOCAL_DEV_USER` wählt nur `admin` oder `member`; ein gesetzter ungültiger Wert sperrt den Zugriff. Requestheader, Cookies und URL-Parameter wählen keine Rolle. Lokale Lesezugriffe verlangen den exakten Host `127.0.0.1:13001`; Schreibzugriffe zusätzlich `POST` mit Origin `http://127.0.0.1:13001`. Next.js erhält in der Dev-Server-Phase ausschließlich die Hostfreigabe `127.0.0.1` für seine internen Entwicklungsressourcen. Das ist getrennt von Server-Action-Origin-Prüfungen; deren Konfiguration wird nicht gelockert. Der Anwendungshinweis zeigt Modus, Benutzer und Rolle dauerhaft. Logs kennzeichnen `local` und enthalten keine Login- oder Requestheader.

Die lokale Auswahl wird nur in einem `next dev`-Build freigeschaltet. `next build` schreibt die Buildphase als feste Konstante ins Artefakt; veränderte Laufzeitflags können daraus keinen lokalen Authpfad machen. Diese Grenze kann nach `npm run build` mit dem echten Standalone-Artefakt geprüft werden:

```sh
node scripts/test-local-production-boundary.ts
```

Der Test startet das Standalone-Artefakt kurzzeitig an Loopback, verlangt die Ablehnung des lokalen Modus trotz gesetztem Schalter und verändertem `NODE_ENV`, und prüft danach den bestehenden Tailscale-Identitätspfad mit einer isolierten synthetischen Datenbank. Der lokale E09-Stack ist nur für synthetische Daten auf dem Entwicklungsrechner. Er ersetzt weder Tailscale-/MFA-Prüfungen noch P1-14, bietet keinen Smartphonezugriff und ist keine Produktionskonfiguration.

Das Produktionsimage verwendet `Dockerfile`/`compose.yaml`, Port 3000 und ein separates `app-data`-Volume. Lokal bauen: `docker compose build`. Ein Start initialisiert keine Benutzer oder produktive Datenbank automatisch. Deployment, Migration und Backup sind im [Betriebshandbuch](betrieb.md) beschrieben. Auf arm64 läuft das amd64-Ziel gegebenenfalls emuliert; das ersetzt die Zielhostprüfung nicht.

## Serverfunktionen und Fehlersuche

`src/server/auth/index.ts` löst den Serve-Login bei jedem Zugriff auf einen aktiven Benutzer auf. Der Host und die Loopback-/Serve-Topologie gehören zur Vertrauensgrenze. Es gibt keine App-Cookie-Sitzung oder App-Logout; `active=false` sperrt folgende App-Anfragen, Netzwerkentzug erfolgt zusätzlich in Tailscale.

Neue Serverfunktionen verwenden die Helfer in `src/server/access.ts`: `requireReadAccess`, `withReadAccess`, `withFileAccess`, `withWriteAccess` und für vollständige Action-Fehlerkorrelation `withActionWriteAccess`. Jede geschützte Funktion prüft selbst, nicht nur das Layout. Schreibzugriffe verlangen passende Methode, Origin und Host; Forwarded-Header begründen kein Vertrauen. Private Antworten werden nicht gemeinsam gecacht. Die abgewiesene HTML-Startseite liefert derzeit eine neutrale Meldung mit HTTP 200; HTTP-Wrapper liefern tatsächliche Fehlerstatus.

Der Logger schreibt kontrollierte JSON-Ereignisse mit UTC-Zeit und servergenerierter Request-ID. Bei HTTP-Fehlern korrelieren `X-Request-ID`, sichtbare Meldung und Logfeld `requestId`. Terminal- oder Compose-Logs nach dieser ID durchsuchen. Keine Tokens, Cookies, Loginheader, vollständigen Importzeilen oder ungefilterten Fehlerobjekte zum Debuggen ausgeben. Die Filterung gilt für den eigenen Logger, nicht automatisch für beliebige `console.log`-Aufrufe oder Fremdwerkzeuge.

`/api/health/live` liefert ohne Identitätsanforderung nur 204 und `no-store`; es prüft Prozess-Liveness, weder DB-Inhalt noch Benutzerzugriff. Es ist keine Route für private Daten. Die Anwendungshülle hat keinen Service Worker und keinen privaten Offlinecache.

## Ansible lokal prüfen

Pins: `infra/ansible/requirements.txt` und `requirements.yml`. In einer eigens angelegten Python-Umgebung installieren, Collections ebenfalls getrennt halten. Beispiel mit frei gewählten temporären Pfaden:

```sh
python3 -m venv /tmp/ygh-ansible-docs
/tmp/ygh-ansible-docs/bin/python -m pip install -r infra/ansible/requirements.txt
/tmp/ygh-ansible-docs/bin/ansible-galaxy collection install -p /tmp/ygh-ansible-collections -r infra/ansible/requirements.yml
ANSIBLE_COLLECTIONS_PATH=/tmp/ygh-ansible-collections /tmp/ygh-ansible-docs/bin/ansible-playbook -i infra/ansible/inventory/hosts.example.yml infra/ansible/bootstrap.yml --syntax-check
```

Die Syntaxprüfung für weitere tatsächlich vorhandene Playbooks entsprechend wiederholen. Ein `--check`-Lauf ist keine reine Syntaxprüfung und kann Zielserver kontaktieren. Keine echten Inventories, Vault-Werte oder Ansible-Liveausführung für gewöhnliche Entwicklung verwenden. SSH-Hostschlüsselprüfung bleibt aktiviert.
