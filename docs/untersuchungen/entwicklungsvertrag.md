# P0-05 – Entwicklungsvertrag

Stand: 2026-10-21. Der Benutzer hat diesen Entwicklungsplan als Planungsgrundlage freigegeben; damit ist keine Implementierung freigegeben. Keine Pakete wurden installiert; die Versions- und Kompatibilitätsprüfung stützt sich auf die an diesem Datum sichtbaren offiziellen Releaseangaben, Paketmetadaten und Projektdokumentation. Installation und Lockfile-Auflösung bleiben P1-01/P1-02, native Builds und Produktionsimage P1-06 vorbehalten.

## Auswahl

| Bereich | Vorgeschlagene Version | Grund |
| --- | --- | --- |
| Laufzeit | Node.js `24.22.1` (LTS), npm aus dieser Node-Distribution | Unterstützte LTS-Linie. Eine feste Patchversion macht lokale und Containerumgebung vergleichbar. |
| Anwendung | Next.js `16.4.2`, React und React DOM `19.3.0` | Bewusste feste Pins für diesen Plan; React `19.3.0` ist nicht die neueste Registry-Version. Next verlangt Node mindestens 20.9. Der App Router passt zur Ein-Anwendungs-Architektur. |
| SQLite-Zugriff | Drizzle ORM `0.45.4`, `better-sqlite3` `13.0.3` | Drizzle dokumentiert den Treiber direkt; die ORM-Peer-Abhängigkeit erlaubt `better-sqlite3 >=7`, die Treiberversion liegt darin. Synchroner Zugriff passt zur einzelnen lokalen SQLite-Instanz und kurzen Transaktionen. |
| Schema/Migrationen | Drizzle Kit `0.31.11` | Für diesen Vorschlag bestätigter stabiler Pin; erzeugt SQL-Migrationen und führt sie aus. Es wird ausschließlich der versionierte `generate`/`migrate`-Pfad verwendet. |
| TypeScript | `5.9.3` | Stabile Version mit breiter Bibliothekskompatibilität; kein Nightly/Prerelease. |
| Linting | ESLint `9.39.1`, `eslint-config-next` `16.4.2` | Next-Konfiguration auf gleicher Frameworkversion; Lint läuft über die ESLint-CLI, nicht über `next lint`. |
| Verhaltenstests | Vitest `5.0.5` | Aktuelle stabile Vitest-Linie; Node-Anforderung ab 22.12 ist mit Node 24 erfüllt. Für Fachlogik und temporäre SQLite-Dateien; keine Browserplattform als Grundgerüst-Abhängigkeit. |
| Servergrenze | `server-only` `0.0.1` | Next.js-üblicher Marker, damit DB- und Authmodule nicht in Client-Bundles importiert werden. |
| Typdefinitionen | `@types/node` `24.19.2`, `@types/react` und `@types/react-dom` `19.3.0`, `@types/better-sqlite3` `9.6.0` | Passen zu den gewählten Laufzeit-/Bibliothekslinien; sie sind Entwicklungsabhängigkeiten. |

Alle direkten Abhängigkeiten werden bei Einrichtung exakt gepinnt (npm `--save-exact`) und mit `package-lock.json` fixiert. `engines.node` wird auf `24.22.x` begrenzt; `.nvmrc` enthält `24.22.1`. Der konkrete npm-Patchstand kommt mit Node und wird beim Start von P1-01 dokumentiert. Keine `latest`-Angabe im Manifest, keine Beta-, Canary-, RC- oder Experimental-Tags.

## Versions- und Kompatibilitätsnachweis

Die folgenden versionierten npm-Registry-Metadaten wurden am **2026-10-21** direkt geprüft. `— (nicht deklariert)` bedeutet, dass das betreffende Feld im Paketmanifest fehlt; es ist kein zusätzlicher Kompatibilitätsbeleg. Bei umfangreichen Peerlisten stehen nur für diese Auswahl relevante Einträge in der Matrix; optionale Peer-Abhängigkeiten bleiben optional. Die Links führen jeweils auf das exakte Manifest und nicht auf `latest`.

| Pin | `engines` (Node) | Relevante `peerDependencies` | Einordnung |
| --- | --- | --- | --- |
| Node.js `24.22.1` | Release ist als LTS ausgewiesen | — | [Versionierter Releasebeleg](https://nodejs.org/en/blog/release/v24.22.1); npm-Patchstand aus derselben Distribution wird erst bei P1-01 festgehalten. |
| `next@16.4.2` | `>=20.9.0` | `react`, `react-dom`: `^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0` | [Registrymetadaten](https://registry.npmjs.org/next/16.4.2); Node-Pin und beide React-Pins erfüllen die deklarierten stabilen Bereiche. |
| `react@19.3.0` | `>=0.10.0` | — | [Registrymetadaten](https://registry.npmjs.org/react/19.3.0). |
| `react-dom@19.3.0` | — (nicht deklariert) | `react: ^19.3.0` | [Registrymetadaten](https://registry.npmjs.org/react-dom/19.3.0); React-Pin erfüllt den Peerbereich. |
| `drizzle-orm@0.45.4` | — (nicht deklariert) | `better-sqlite3: >=7` (optional) | [Registrymetadaten](https://registry.npmjs.org/drizzle-orm/0.45.4); Treiber-Pin liegt im deklarierten Peerbereich. |
| `better-sqlite3@13.0.3` | `>=22` | — | [Registrymetadaten](https://registry.npmjs.org/better-sqlite3/13.0.3); Node-Pin erfüllt Engine. Native Zielplattform und Standalone-Laden bleiben P1-06-Prüfungen. |
| `drizzle-kit@0.31.11` | — (nicht deklariert) | — | [Registrymetadaten](https://registry.npmjs.org/drizzle-kit/0.31.11); keine Engine-/Peer-Aussage im Manifest. |
| `typescript@5.9.3` | `>=14.17` | — | [Registrymetadaten](https://registry.npmjs.org/typescript/5.9.3); Node-Pin erfüllt Engine. |
| `eslint@9.39.1` | `^18.18.0 || ^20.9.0 || >=21.1.0` | `jiti: *` (optional) | [Registrymetadaten](https://registry.npmjs.org/eslint/9.39.1); Node-Pin erfüllt Engine. |
| `eslint-config-next@16.4.2` | — (nicht deklariert) | `eslint: >=9.0.0`; `typescript: >=3.3.1` (optional) | [Registrymetadaten](https://registry.npmjs.org/eslint-config-next/16.4.2); gewählte Pins erfüllen die deklarierten Bereiche. |
| `vitest@5.0.5` | `^22.12.0 || ^24.0.0 || >=26.0.0` | **`vite: ^6.4.0 || ^7.0.0 || ^8.0.0` (erforderlich)**; `@types/node: ^22.0.0 || >=24.0.0` (optional) | [Registrymetadaten](https://registry.npmjs.org/vitest/5.0.5); Node und Node-Typen passen. npm kann den erforderlichen Vite-Peer automatisch auflösen; tatsächliche Auflösung und Lockfile sind in P1-01 zu prüfen. Kein zusätzlicher direkter Vite-Pin ist hier beschlossen. |
| `server-only@0.0.1` | — (nicht deklariert) | — | [Registrymetadaten](https://registry.npmjs.org/server-only/0.0.1); keine Engine-/Peer-Aussage im Manifest. |
| `@types/node@24.19.2` | — (nicht deklariert) | leer | [Registrymetadaten](https://registry.npmjs.org/@types/node/24.19.2); Vitests optionaler Peerbereich passt. |
| `@types/react@19.3.0` | — (nicht deklariert) | leer | [Registrymetadaten](https://registry.npmjs.org/@types/react/19.3.0). |
| `@types/react-dom@19.3.0` | — (nicht deklariert) | `@types/react: ^19.3.0` | [Registrymetadaten](https://registry.npmjs.org/@types/react-dom/19.3.0); Typ-Pin erfüllt den deklarierten Peerbereich. |
| `@types/better-sqlite3@9.6.0` | — (nicht deklariert) | leer | [Registrymetadaten](https://registry.npmjs.org/@types/better-sqlite3/9.6.0). |

Die Registry markierte `react@19.3.1` am Prüftag als `latest`; der gewählte Pin `19.3.0` bleibt als Vorschlag unverändert und wird hier nicht als neueste Version bezeichnet. Der Vitest-Peer `vite` ist der einzige zusätzliche erforderliche Peer in dieser Auswahl, der nicht als direkter Pin aufgeführt ist. Seine automatische Auflösung durch npm sowie alle transitiven Versionsentscheidungen sind erst mit dem Lockfile aus P1-01 belastbar geprüft. Die Manifestdaten belegen deklarierte Bereiche, keinen gemeinsamen Installations-, Typprüfungs- oder Buildlauf.

## Warum dieser SQLite-Treiber

`better-sqlite3` ist Drizzles dokumentierter nativer SQLite-Treiber für Node. SQLite bleibt eine lokale Datei auf dem VPS; es wird kein zusätzlicher DB-Dienst und kein libSQL/Turso-Ziel eingeführt. Drizzle Kit generiert nachvollziehbare SQL-Migrationen. Die Anwendung nutzt zur Laufzeit Drizzle und den Treiber; das CLI-Werkzeug bleibt Entwicklungsabhängigkeit.

Das native Node-Modul muss für das Zielsystem gebaut beziehungsweise als passendes natives Artefakt installiert sein. Produktionsimage und native Abhängigkeiten werden für Hetzner CX23 als `linux/amd64` auf einer Debian/glibc-Basis (`node:24.22.1-bookworm-slim`, Verfügbarkeit des exakten Tags bei P1-06 prüfen) erstellt. Alpine/musl wird für dieses erste Image vermieden, damit keine unnötige native ABI-Abweichung entsteht. Ein macOS-arm64-`node_modules` wird nie in das Linux-Image kopiert: Docker installiert/kompiliert die Abhängigkeiten im passenden Linux-Target. Falls der Treiber kein passendes Prebuild bereitstellt, enthält die Buildstufe nur für diesen Schritt Python 3, `make` und `g++`; Build- und Runtime-Stufe verwenden dieselbe Node-Version und glibc-Basis, die Runtime erhält keine Toolchain. Der tatsächliche Imagebuild in P1-06 muss native Modulauflösung und einen echten SQLite-Open-/Query-Smoke-Test im finalen Runtime-Image bestätigen.

Der Next.js-Standalone-Output wird einschließlich des tatsächlich benötigten nativen SQLite-Moduls in das Runtime-Image übernommen. Weil Nexts Dateitracing die native Moduldatei verfehlen kann, ist ihre Laufzeitauflösung im finalen Standalone-Image explizit zu prüfen und falls nötig gezielt einzuschließen. Die SQLite-Datei liegt in einem beschreibbaren persistenten Volume außerhalb des Image-Dateisystems; das Volume erhält nötige Schreibrechte für den Containerbenutzer. DB-Datei, Migrationen und Datenzugriffsmodul werden nur serverseitig importiert; Servermodule erhalten eine `server-only`-Grenze. Keine Datenbankdatei wird in den öffentlichen Assetpfad gelegt.

## Projektstruktur

Kleine Ein-Anwendungs-Struktur, kein Monorepo und kein zusätzliches Schichtenframework:

```text
src/
  app/                 Next.js App Router: Layouts, Seiten, Route Handler
  server/
    auth/              Serve-Identität, Allowlist und Berechtigungsprüfung
    db/                server-only Verbindung, Schema und Migrationseinbindung
    <fachbereich>/     normale TypeScript-Funktionen, nur wenn Paket sie einführt
  components/          nur wiederverwendbare UI, falls nötig
```

`src/app` ruft serverseitig Authprüfung und Fachfunktionen auf. `src/server/auth` vertraut im Betrieb ausschließlich der von Tailscale Serve gesetzten Identität und prüft sie gegen genau die zwei freigegebenen Benutzer. Es gibt keine Auth-Bibliothek, Cookie-Sitzung, öffentliche Registrierung oder produktive Entwicklungs-Identität. `src/server/db` und SQLite-Treiber dürfen nicht von Client Components importiert werden. Private Datenantworten werden dynamisch/serverseitig gehalten und nicht statisch oder gemeinsam gecacht; der PWA-Offlinecache speichert sie nicht.

Lokale Entwicklung enthält keinen Auth-Bypass. Der lokale Dev-Server bindet explizit an `127.0.0.1`; geschützte Browserprüfungen laufen lokal über Tailscale Serve, das auf diesen Port weiterleitet. Die Entwicklungs-Origin wird explizit konfiguriert und weiter serverseitig geprüft. Ohne Serve-Identität werden geschützte Aufrufe geschlossen abgewiesen. Für automatisierte Tests kann eine explizite Testfixture nur innerhalb der Testumgebung eine Identität bereitstellen; sie ist nicht Teil des Produktionsexports. Falls Nexts `server-only`-Marker in der Node-Testlaufzeit aufgelöst wird, erhält ausschließlich Vitest einen Testalias auf ein leeres Testmodul. Die Produktionskonfiguration behält den echten Marker; der Alias darf nicht im Next-Build gelten. Ein späterer Docker-Dev-Server darf im Container an `0.0.0.0` binden, aber nur über Loopback am Host veröffentlicht werden.

## Sollbefehle

Diese Befehle beschreiben die nach P1-01 einzurichtenden npm-Skripte und sind aktuell nicht ausführbar:

| Zweck | Geplanter Befehl |
| --- | --- |
| Entwicklung | `npm run dev` → `next dev --hostname 127.0.0.1` |
| Typprüfung | `npm run typecheck` → `next typegen && tsc --noEmit` |
| Linting | `npm run lint` → `eslint .` |
| Tests | `npm test` → `vitest run` |
| Produktionsbuild | `npm run build` → `next build` |
| Migration generieren (P1-02) | `npm run db:generate` → `drizzle-kit generate` |
| Migration anwenden (P1-02, nur lokale/isolierte DB) | `npm run db:migrate` → `drizzle-kit migrate` |

`npm ci` ist der reproduzierbare Installationsbefehl ab vorhandenem Lockfile. `drizzle-kit push` wird nicht als Migrationsweg eingerichtet. Keine Produktionsdatenbank und keine produktiven Geheimnisse werden für Build, Typprüfung oder Tests benötigt. Testdatenbanken sind temporäre SQLite-Dateien; Tests öffnen niemals die echte Sammlung.

Als exakte Installationsvorgabe für die jeweils beauftragten Einrichtungspakete:

```sh
# P1-01: Projekt- und Prüfwerkzeuge
npm install --save-exact next@16.4.2 react@19.3.0 react-dom@19.3.0
npm install --save-dev --save-exact typescript@5.9.3 eslint@9.39.1 eslint-config-next@16.4.2 vitest@5.0.5 @types/node@24.19.2 @types/react@19.3.0 @types/react-dom@19.3.0

# P1-02: Datenbank und Migrationswerkzeug
npm install --save-exact drizzle-orm@0.45.4 better-sqlite3@13.0.3 server-only@0.0.1
npm install --save-dev --save-exact drizzle-kit@0.31.11 @types/better-sqlite3@9.6.0
```

Die Befehle sind Planinhalt, wurden nicht ausgeführt und dürfen erst in den jeweiligen Implementierungspaketen nach Prüfung von `engines`, `peerDependencies`, Lockfile-Auflösung und tatsächlichem Build verwendet werden. Das Nachladen zusätzlicher Pakete ist auf konkret begründeten Bedarf eines späteren Pakets zu beschränken.

## Paketgrenzen

- **P1-01:** Node/npm-Projekt, Lockfile, minimales App-Router-Grundgerüst und obige Prüfskripte. Keine DB, Auth, Docker oder fachliche Tabellen.
- **P1-02:** Drizzle/better-sqlite3-Verbindung und nur das dort beauftragte Benutzerschema samt versionierter erster Migration. Keine weiteren Tabellen vorbauen.
- **P1-03/P1-04:** E04-Identitätsprüfung und Schutz geschützter Serverfunktionen; kein Auth-Framework und kein produktiver Bypass.
- **P1-06:** Produktionsimage/Standalone-Start und nativer `linux/amd64`-Build auf glibc; kein Deployment oder Zugriff auf Produktionsdaten durch P0-05.
- Fachtests bleiben Vitest-Tests gegen Fachfunktionen und temporäre echte SQLite-Dateien. Browser- und Geräteprüfungen gehören zu den jeweiligen späteren Paketen; Playwright oder eine andere große E2E-Plattform wird nicht vorgezogen.

## Quellen (abgerufen 2026-10-21)

- Node.js, [Release-Linien und LTS-Status](https://nodejs.org/en/about/previous-releases), [Node.js 24.22.0 LTS](https://nodejs.org/en/blog/release) und [offizielles Node.js v24.22.1-Verzeichnis](https://nodejs.org/download/release/v24.22.1/); Node 24 ist LTS.
- Next.js, [Next.js 16.4.2 auf npm](https://www.npmjs.com/package/next) und [aktuelle Next.js-Dokumentation](https://nextjs.org/docs); App Router ist die gewählte Next-Struktur. `eslint-config-next` 16.4.2 ist [auf npm verfügbar](https://www.npmjs.com/package/eslint-config-next).
- React, [React 19.3.0 auf npm](https://www.npmjs.com/package/react), [React DOM](https://www.npmjs.com/package/react-dom) und [Typdefinitionen](https://www.npmjs.com/package/@types/react).
- Drizzle, [SQLite-Treiber inklusive `better-sqlite3`](https://orm.drizzle.team/docs/sqlite/get-started-sqlite), [Drizzle ORM auf npm](https://www.npmjs.com/package/drizzle-orm), [versionierte Peer-Metadaten für 0.45.4](https://github.com/drizzle-team/drizzle-orm/blob/0.45.4/drizzle-orm/package.json) sowie [Migrationen mit Drizzle Kit](https://orm.drizzle.team/docs/kit-overview).
- npm-Paketmetadaten: [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3), [`drizzle-kit`](https://www.npmjs.com/package/drizzle-kit), [`typescript`](https://www.npmjs.com/package/typescript), [`eslint`](https://www.npmjs.com/package/eslint), [`vitest`](https://www.npmjs.com/package/vitest), [`server-only`](https://www.npmjs.com/package/server-only), [`@types/node`](https://www.npmjs.com/package/@types/node), [`@types/react-dom`](https://www.npmjs.com/package/@types/react-dom), [`@types/better-sqlite3`](https://www.npmjs.com/package/@types/better-sqlite3).
- Next.js, [CLI-Befehle inkl. `typegen`](https://nextjs.org/docs/app/api-reference/cli/next); ein frischer Checkout erzeugt Routentypen mit `next typegen` vor `tsc --noEmit`.
- Vitest, [aktuelle unterstützte Versionen und Node-Anforderung](https://vitest.dev/releases.html), [Vitest 5 Release](https://vitest.dev/blog/vitest-5).
- Docker, [Multi-Platform-Builds und Zielplattformen](https://docs.docker.com/build/building/multi-platform/) und [Node.js Images](https://github.com/nodejs/docker-node). Der konkrete `24.22.1-bookworm-slim`-Tag wird beim P1-06-Imagebuild bestätigt; dieser Plan behauptet keine bereits erprobte Tag-/Registryverfügbarkeit.
- Next.js, [Output-Dateisystem und Standalone-Output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output); Zugriffssicherheitsvertrag siehe [P0-04](zugriff.md).

## Offene Grenze

Quell- und Paketmetadaten belegen veröffentlichte stabile Pins sowie die in der Matrix aufgeführten deklarierten Engine-/Peer-Bereiche. Sie belegen keinen erfolgreichen gemeinsamen Installationslauf, keine erfolgreiche Typprüfung, keinen Next-Standalone-Build und kein natives `linux/amd64`-Image. Diese Kompatibilitätsnachweise sind konkrete Abnahmen von P1-01, P1-02 und P1-06. Schlägt dort die Kombination fehl, wird anhand der tatsächlichen Fehlermeldung gezielt nachgebessert; die Architektur bleibt bis zu einer belegten Notwendigkeit unverändert.
