# Entwicklung

Stand mit Repository abgeglichen: 2. November 2026. Diese Datei beschreibt den vorhandenen Entwicklungsweg. Paketstatus und Aufträge stehen ausschließlich im [Aufgabenindex](aufgaben/README.md). Frühere Prüfergebnisse sind in der [Prüfchronik](historie/pruefprotokolle-p1.md) erhalten; Servereinrichtung und offene Live-Prüfungen stehen unter [Betrieb](betrieb.md).

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

`typecheck` erzeugt Next-Routentypen und prüft TypeScript; `lint` verwendet Oxlint. Vitest nutzt temporäre Datenbanken, keine echte Sammlung. Auf macOS überspringen sechs Linux-spezifische Tests ihre Ausführung. Auf Linux benötigen vier Tests in `scripts/backup-runner.test.ts` Rootrechte für das unveränderte Hostskript. Für einen unprivilegierten Linux-Lauf diese gezielt mit `npm test -- --exclude scripts/backup-runner.test.ts` ausnehmen und die vier Hosttests separat in einer entbehrlichen isolierten Linux-Umgebung oder der vorhandenen CI prüfen. Ein Teillauf ist kein vollständiger Nachweis; nicht einfach `sudo npm test` auf dem Arbeitsplatz ausführen.

Der Workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) ist die ausführbare Referenz für CI-Befehle. Er läuft bei Push und Pull Request auf GitHub-hosted Ubuntu 26.04: Installation, Typprüfung, Lint, normale Node-Tests, vier Hosttests, beide Python-Gruppen und Build. Nur der Hosttestschritt nutzt sudo. Read-only Repositoryberechtigung, keine gespeicherten Checkout-Credentials, keine Produktionsgeheimnisse, keine Deployments. Root führt dabei auch npm/Vitest-Abhängigkeiten aus; dies ist keine Vorlage für dauerhafte Self-hosted Runner. Actions sind auf Commit-SHAs gepinnt.

Letzter dokumentierter vollständiger Lauf: [28. Oktober 2026, Commit c4322bd](https://github.com/GrothRico/ygh/actions/runs/40679032774), 31 Node- und 26 Python-Tests sowie Typprüfung, Lint und Build erfolgreich. Die zusätzlichen lokalen P2-01-Prüfungen vom 2. November stehen im [Paketprotokoll](historie/p2-01-2026-11-02.md); für diesen neuen Arbeitsstand wurde kein Hosted-Lauf ausgelöst. CI deckt weder Ansible-Livebetrieb noch echte Geräte oder B2 ab.

## Datenbank und Migrationen

Implementiert sind `users`, `cards`, `sets`, `variants` und `printings` samt Drizzle-Migrationsmetadaten in `src/server/db/`. Die Migration `0001_catalog.sql` ergänzt die vier Katalogtabellen; `0000` bleibt unverändert. Das [Datenmodell](datenmodell.md) beschreibt zusätzlich geplante Tabellen, die noch nicht existieren. Die Verbindung aktiviert Fremdschlüssel. Migrationen werden versioniert; kein `drizzle-kit push`.

```sh
npm run db:generate
DATABASE_PATH=/absoluter/pfad/zur/entbehrlichen/test.sqlite npm run db:migrate
```

Vor Ausführung einen existierenden Testordner und bewusst gewählten Datenbankpfad einsetzen. Generierte SQL-Dateien prüfen; Migration echter Daten ist kein Entwicklungstest. Das Schema oder die Verbindung nicht beim normalen Modulimport automatisch migrieren.

## Manueller Katalogimport

P2-02 ergänzt einen manuellen YGOPRODeck-v7-Import. Er lädt die vollständigen englischen und deutschen Kartenantworten, die Setliste und den Datenbankversionsstand. Die Netzantworten werden vollständig geprüft, bevor eine einzige Schreibtransaktion startet. Deutsche Einträge werden nur über dieselbe Karten-ID zugeordnet; fehlende deutsche Datensätze überschreiben keine vorhandene Übersetzung. Unbestätigte Setcode-/Seltenheitsangaben bleiben Quellbeobachtungen und erzeugen keine bestätigten Varianten oder Drucke.

Nur eine bewusst gewählte lokale Katalogdatenbank verwenden. Die CLI migriert nie selbst und verlangt eine bereits migrierte Datenbank. Für eine neue entbehrliche Datei muss das Elternverzeichnis existieren; einen bewusst gewählten absoluten Datenbankpfad einsetzen:

```sh
DATABASE_PATH=/absoluter/pfad/zur/lokalen-katalog.sqlite npm run db:migrate
DATABASE_PATH=/absoluter/pfad/zur/lokalen-katalog.sqlite npm run catalog:sync -- sync
DATABASE_PATH=/absoluter/pfad/zur/lokalen-katalog.sqlite npm run catalog:sync -- status
```

Der Synchronisationsaufruf benötigt Netzwerkzugriff auf die fest eingetragenen HTTPS-Endpunkte. Er importiert keine Bilder, Preise oder Kartenspielwerte und löscht keine vorhandenen Karten, Sets, Varianten oder Drucke. Der Status zeigt letzten Versuch und Erfolg, Quellversion/-datum, Fehlercode und erkannte Konflikte. Ein Quellfehler lässt den Katalog unverändert; letzter erfolgreicher Zeitstempel, Quellversion und Konflikthinweise bleiben erhalten. Der offizielle Guide dokumentiert Datenbankversion und Datum, aber nicht die konkrete JSON-Hülle der Versionsantwort. Der Parser akzeptiert defensiv ein Objekt oder ein Array mit genau einem Objekt; die aktuelle Liveform wurde nicht belegt. Druckcode-/Raritätsbeobachtungen belegen keine Sprache, Edition oder Artworkzuordnung. Es gibt keinen Cronlauf oder Anwendungsbildschirm für den Import.

Im lokalen Stack kann die CLI direkt gegen dessen Datenbankvolume laufen, ohne den Datenbankpfad im Container zu verändern:

```sh
docker compose -p ygh-local -f compose.local.yaml exec local node scripts/catalog-sync.mts status
docker compose -p ygh-local -f compose.local.yaml exec local node scripts/catalog-sync.mts sync
```

Nach diesem Codeupdate muss das Entwicklungsimage neu gebaut und die lokale Testdatenbank migriert werden. Der ausdrücklich gestartete lokale E09-Stack erledigt seine Migration beim Start; echte Daten dürfen nur im Rahmen eines gesonderten Betriebsauftrags migriert werden. `sync` startet selbst keine Migration; der Katalogimport wird weder beim Containerstart noch beim Anwendungsstart automatisch ausgeführt. Der Produktionsrunner enthält dieselbe manuelle CLI, führt sie aber ebenfalls nicht beim Start aus.

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

Der getrennte E09-Stack öffnet die geschützte Oberfläche mit zwei fest definierten synthetischen Testbenutzern. Er benötigt weder persönliche Tailscale-Logins noch `APP_ORIGIN`. Nur die Datei `compose.local.yaml` setzt den lokalen Modus und bindet den Hostport ausschließlich an `127.0.0.1:3001`. Nicht gleichzeitig mit `ygh-dev` starten, weil beide den Hostport 3001 verwenden.

```sh
docker compose -p ygh-local -f compose.local.yaml up --build
# Browser: http://127.0.0.1:3001
```

Standardmäßig meldet sich der Test-Admin an. Für die Mitgliedsrolle den Stack stoppen und vor demselben `up`-Befehl `YGH_LOCAL_DEV_USER=member` setzen:

```sh
docker compose -p ygh-local -f compose.local.yaml down
YGH_LOCAL_DEV_USER=member docker compose -p ygh-local -f compose.local.yaml up --build
```

Zurück zum Test-Admin wird `YGH_LOCAL_DEV_USER` weggelassen. `down` erhält das Volume `ygh-local_local-data`; die Datenbank liegt fest unter `/data/collection-local.sqlite`. Der Start migriert eine neue Datenbank und richtet einmalig die zwei `.invalid`-Identitäten ein. Wiederstarts bewahren Benutzer-IDs, Aktivstatus und Daten. Fehlende Testbenutzer werden nicht wiederhergestellt. Eine bereits vorhandene Datenbank ohne genau diese beiden Testidentitäten wird vor Migration abgewiesen. Katalogfixtures und echte Sammlungen werden nicht geladen.

`YGH_LOCAL_DEV_USER` wählt nur `admin` oder `member`; ein gesetzter ungültiger Wert sperrt den Zugriff. Requestheader, Cookies und URL-Parameter wählen keine Rolle. Lokale Lesezugriffe verlangen den exakten Host `127.0.0.1:3001`; Schreibzugriffe zusätzlich `POST` mit Origin `http://127.0.0.1:3001`. Next.js erhält in der Dev-Server-Phase ausschließlich die Hostfreigabe `127.0.0.1` für seine internen Entwicklungsressourcen. Das ist getrennt von Server-Action-Origin-Prüfungen; deren Konfiguration wird nicht gelockert. Der Anwendungshinweis zeigt Modus, Benutzer und Rolle dauerhaft. Logs kennzeichnen `local` und enthalten keine Login- oder Requestheader.

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
