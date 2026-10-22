# Entwicklung und Prüfungen

Stand: 2026-10-21, P1-01 umgesetzt und zur unabhängigen Prüfung übergeben. Verwendete Runtime: Node.js 24.22.1, npm 11.19.1. Das Grundgerüst nutzt die im [Entwicklungsvertrag P0-05](untersuchungen/entwicklungsvertrag.md) festgelegten Pins: Next.js 16.4.2/App Router, React 19.3.0 und TypeScript 5.9.3. React 19.3.0 ist ein bewusster fester Pin, nicht die am Prüftag neueste Registry-Version. Drizzle ORM und better-sqlite3 werden erst in P1-02 ergänzt. Nativer Linux-Build und Standalone-Lauf bleiben P1-06 vorbehalten.

## Paketmanager und Befehle

Ein Paketmanager: npm, mit exakten Versionsangaben, `package-lock.json` und `npm ci` für reproduzierbare Installation aus dem Lockfile. Zielruntime Node `24.22.1` (LTS), Manifest-Engine `24.22.x`; `.nvmrc` enthält `24.22.1`. Der beim P1-01-Lauf verwendete npm-Patchstand war `11.19.1`. Kein zweiter Paketmanager.

Die P1-01-Skripte sind in `package.json` eingerichtet; die beiden DB-Befehle sind ausdrücklich noch geplant:

| Skript | Befehl | Einrichtung |
| --- | --- | --- |
| `dev` | `next dev --hostname 127.0.0.1` | P1-01; schützt den lokalen Dev-Port vor LAN-Zugriff |
| `typecheck` | `next typegen && tsc --noEmit` | P1-01; erzeugt Next-Routentypen vor dem TypeScript-Lauf |
| `lint` | `eslint .` | P1-01; Nexts `next lint` wird nicht verwendet |
| `test` | `vitest run` | P1-01 |
| `build` | `next build` | P1-01 |
| `db:generate` | `drizzle-kit generate` | geplant, erst P1-02 |
| `db:migrate` | `drizzle-kit migrate` | geplant, erst P1-02; lokale/isolierte Datenbank |

SQL-Migrationen werden versioniert. `drizzle-kit push` wird nicht als Schemaänderungsweg eingesetzt; Produktionsmigrationen sind kein allgemeiner Buildschritt und werden erst in den dafür vorgesehenen späteren Betriebsabläufen behandelt. Tests nutzen ausschließlich temporäre SQLite-Dateien und synthetische Daten. Kein Build, Test oder Migrationstool erhält Zugriff auf Produktionsgeheimnisse oder die reale Sammlung.

P1-01 hat `npm ci` unter Node 24.22.1/npm 11.19.1 erfolgreich ausgeführt. npm löste den von Vitest 5.0.5 erforderlichen Peer `vite` automatisch als `vite@8.3.5` auf; Vite ist kein direkter Projektpin. `npm install` meldete fünf Schwachstellen der Stufe „high“; die unabhängige Bewertung steht unten. npm markierte außerdem `eslint@9.39.1` als nicht mehr unterstützt und meldete nicht freigegebene Installationsskripte für `unrs-resolver` und `fsevents`. Die im freigegebenen Vertrag festgelegten Pins wurden nicht eigenmächtig geändert. Typprüfung, Linting, Smoke-Test und Build liefen dennoch erfolgreich.

Für Installationspakete und genaue Versionen siehe den [Entwicklungsvertrag](untersuchungen/entwicklungsvertrag.md). P1-01 richtet noch keine Datenbankpakete ein. Native SQLite-Abhängigkeiten werden im vorgesehenen Debian/glibc `linux/amd64`-Build installiert/gebaut; macOS-arm64-Module dürfen nicht in ein Linux-Image kopiert werden. Produktionsstandalone enthält sein benötigtes Modul und nutzt ein beschreibbares persistentes Volume für die SQLite-Datei. Der Build beweist die konkrete Plattformkompatibilität erst nach P1-06.

Geschützte lokale Browserentwicklung nutzt denselben Serve-Identitätsweg wie geplant für den Betrieb, mit Tailscale Serve zum lokalen Dev-Port und expliziter Entwicklungs-Origin. Es gibt keinen offenen Entwicklungs-Auth-Bypass. Tests dürfen isolierte Identitätsfixtures verwenden, die nicht in den Produktionspfad gelangen.

## Paketgrenzen

- P1-01: minimales Next.js-App-Router-/TypeScript-Projekt, Lockfile und Prüfskripte; keine Datenbank oder Auth.
- P1-02: SQLite/Drizzle-Verbindung und nur das beauftragte Schema sowie erste Migration; keine vorgezogenen Fachtabellen.
- P1-03/P1-04: E04-Identität serverseitig prüfen und alle geschützten Serverfunktionen schützen.
- P1-06: glibc-basiertes `linux/amd64`-Image, natives Modul im Zielbuild, Next-Standalone-Lauf und persistentes schreibbares Datenvolume praktisch prüfen.
- Vitest prüft Fachverhalten und SQLite-Integration mit temporärer echter SQLite-Datei. Browser-/Geräteprüfungen bleiben bei den jeweiligen späteren Paketen; keine E2E-Plattform wird vorgezogen.

## Prüfmatrix

| Änderung | Mindestprüfung nach Einrichtung |
| --- | --- |
| Nur Dokumentation | Links, Konsistenz, kein versehentlich hinzugefügter Code |
| TypeScript-Fachlogik | Typprüfung und gezielte Verhaltenstests |
| Schema/Bestandsänderung | Migration und Tests gegen echte temporäre SQLite-Datei; Rollback-/Konfliktfall |
| Oberfläche/Serverroute | Typprüfung, passende Tests, Build und konkrete Bedienprüfung |
| Authentifizierung | Nicht angemeldet, fremde Identität, gesperrte Identität, Direktzugriff und gefälschte Header ablehnen |
| Container | Build, Start, Neustart mit Volumenerhalt, keine ungewollte öffentliche Bindung |
| Ansible | Syntaxprüfung und Wiederholung auf ausdrücklich freigegebener Testinstanz; check-mode allein beweist keinen korrekten Betrieb |
| Backup | Konsistente Sicherung und echte Wiederherstellung auf isolierter Instanz |

### P1-01 durchgeführte Prüfung

`npm ci`, `npm run typecheck`, `npm run lint`, `npm test` und `npm run build` liefen mit Node 24.22.1/npm 11.19.1 erfolgreich. Der Werkzeug-Smoke-Test rendert die deutsche Startseite serverseitig. Der Entwicklungsserver startete mit `npm run dev` auf `127.0.0.1:3000`; ein lokaler HTTP-GET lieferte Status 200 und die deutsche Startseite. Die Vitest-Ausführung benötigte in der eingeschränkten Prüfungsumgebung eine Freigabe zum Schreiben des standardmäßigen API-Schlüssels im Benutzerprofil.

Keine pauschale Vollprüfung nach jedem Dokumentationssatz. Vor einer Integration in den Hauptstand werden die zu diesem Zeitpunkt vorhandenen Typ-, Lint-, Test- und Buildprüfungen ausgeführt. Fehlende Geräte-/Serverzugriffe werden als offene Prüfung dokumentiert, nicht durch Mock-Ergebnisse ersetzt.

## Fehlersuche

Nach Einführung des Loggings dokumentiert P1-05 den Weg von sichtbarer Request-ID zum Log. Nach P1-07 folgen Docker-Logbefehle, nach P1-12 Backup- und Restorebefehle. Sie werden anhand der echten Dienstnamen geprüft. Keine Produktionsgeheimnisse in Beispielen.

## Lokaler Start

Node 24.22.1 bereitstellen (bei vorhandenem nvm: `nvm install` und `nvm use` im Projekt), dann `npm ci` und `npm run dev`. Die Startseite liegt unter http://127.0.0.1:3000; Ctrl-C beendet den Server. Für diese Prüfung wurde die offizielle Node-Distribution mit SHA256-Abgleich separat unter `/tmp/ygh-node24/node-v24.22.1-darwin-arm64` bereitgestellt; der temporäre Pfad ist keine dauerhafte Installationsvoraussetzung. Die globale Node-Version wurde nicht verändert.

## Unabhängiger Review P1-01

Der Hauptagent wiederholte am 2026-10-21 `npm ci` (temporärer npm-Cache), Typprüfung, Linting, Smoke-Test und Produktionsbuild erfolgreich. Die Startseite wurde außerdem im Browser visuell geprüft; der Testserver wurde beendet. Vitest verwendet eine ESM-Konfiguration (`vitest.config.mts`) mit projektlokalem Modulcache in `node_modules/.vitest-cache`; kein Test wurde deaktiviert. npm meldet nicht freigegebene Installationsskripte von `unrs-resolver` und `fsevents`; sie wurden nicht pauschal freigeschaltet, die tatsächlich geprüften Werkzeuge funktionierten.

**Offener Wartungs-/Sicherheitsbefund:** Der vollständige `npm audit` meldet fünf High-Einträge aus einer gemeinsamen Entwicklungskette: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces@3.0.3`. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) beschreibt einen Prozessabsturz durch tief verschachtelte, fremdgesteuerte Globmuster; zum Prüftag ist kein Patch aufgeführt. Das Grundgerüst verarbeitet keine Nutzereingaben als Lint-Globmuster. `npm audit --omit=dev` meldete null Befunde; das ist keine allgemeine Sicherheitsgarantie. Der vorgeschlagene automatische Fix würde die Next-Lintkonfiguration auf 14.2.35 zurücksetzen und wurde nicht angewendet.

[ESLint 9 ist seit 2026-08-06 EOL](https://eslint.org/version-support/). Der vorherige P0-05-Pin ist deshalb als Wartungsentscheidung nachzubessern. ESLint 10.13.0 erfüllt zwar die Node-Anforderungen, aber die im Lockfile installierten Plugins `eslint-plugin-import`, `eslint-plugin-jsx-a11y` und `eslint-plugin-react` deklarieren keine ESLint-10-Unterstützung. Kein `--force`, keine Peer-Umgehung und kein Abschalten der Regeln. Die gezielte Klärung der Lint-Abhängigkeiten bleibt vor uneingeschränkter Abnahme offen; weitere Fachpakete wurden nicht begonnen.
