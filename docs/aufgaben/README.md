# Aufgabenindex

Stand geprüft: 2. November 2026. **P1-16, P2-01 und P2-02 sind abgenommen. P2-03 einschließlich der ausdrücklich beauftragten regelmäßigen Katalog-/Bildaktualisierung und Speicherung der vier vollständigen letzten JSON-Antworten ist umgesetzt; die menschliche Abnahme steht aus.** P1-14 bleibt zurückgestellt; kein echter Server oder Betriebsauftrag. Die Tabelle ist die einzige laufende Paketstatusliste. [Dokumentationsübersicht](../README.md).

Für ein günstiges Modell: eine ID pro Chat/Durchgang. Der [Startprompt](../arbeit-mit-llm.md) und [AGENTS.md](../../AGENTS.md) gelten für jedes Paket. Offene Architekturentscheidungen zuerst klären; das Modell soll sie nicht während einer Implementierung improvisieren.

## Start und Freigabepunkte

1. Vor jedem Auftrag die Voraussetzungen des einzelnen Pakets und den tatsächlichen Code-/Dateistand prüfen. Eine Aufgabenliste ist keine Implementierungsfreigabe.
2. Planungsfreigaben legen technische Verträge fest; sie autorisieren weder Bestellungen noch Serverzugriff oder Migration echter Daten.
3. Lokale Entwicklung mit synthetischen Daten ist ohne bestellten Server möglich. Neue Pakete bleiben bis zum ausdrücklichen Einzelauftrag geplant.
4. P1-14 ist auf ausdrücklichen Wunsch zurückgestellt und wurde nicht gestartet. Es gibt noch keinen echten Server und keinen Betriebsauftrag. Vor echten Sammlungsdaten bleibt der Sicherheits-/Restore-Gate einschließlich externer Alarme, unabhängiger Recoverykopie und vollständigem Restore erforderlich; dafür braucht es später einen separaten Betriebsauftrag und eine freigegebene Kostenentscheidung.
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
| P0-06 | [Sicherung und Betriebsprüfung festlegen](m0.md) | P0-03, P0-04 | Abgenommen |
| P1-01 | [Minimales TypeScript-Projekt](m1.md) | P0-05 | Abgenommen |
| P1-02 | [SQLite und Migrationen einführen](m1.md) | P1-01 | Abgenommen |
| P1-03 | [Identität und Sitzungen anbinden](m1.md) | P1-02, P0-04 | Abgenommen |
| P1-04 | [Zugriffsschutz für Server und Dateien](m1.md) | P1-03 | Abgenommen |
| P1-05 | [Strukturiertes Anwendungslogging](m1.md) | P1-04 | Abgenommen |
| P1-06 | [Produktionscontainer bauen](m1.md) | P1-05 | Abgenommen |
| P1-07 | [Docker-Entwicklungsbetrieb](m1.md) | P1-06 | Abgenommen |
| P1-08 | [Ansible-Servergrundlage](m1.md) | P1-06, P0-03, P0-04 | Abgenommen |
| P1-09 | [Privates HTTPS und Deployment](m1.md) | P1-08, P1-04 | Abgenommen |
| P1-10 | [Betriebslogs begrenzen](m1.md) | P1-09, P0-06 | Abgenommen |
| P1-11 | [Backupjob implementieren](m1.md) | P1-10, P0-06 | Abgenommen |
| P1-12 | [Restore und Betriebsalarme](m1.md) | P1-11 | Abgenommen |
| P1-13 | [Mobile Hülle und PWA](m1.md) | P1-07, P1-04 | Abgenommen |
| P1-14 | [Privaten Betrieb abnehmen](m1.md) | P1-09, P1-12, P1-13 | Geplant |
| P1-15 | [Automatische Repository-Prüfungen](m1.md) | P1-06 | Abgenommen |
| P1-16 | [Lokaler Entwicklungszugang ohne Tailscale](m1.md#p1-16-lokaler-entwicklungszugang-ohne-tailscale) | P1-04, P1-07, P1-13, E09 | Abgenommen |
| P2-01 | [Katalogschema und Beispieldaten](m2.md) | P1-02, P0-01 | Abgenommen |
| P2-02 | [Katalogdaten synchronisieren](m2.md) | P2-01 | Abgenommen |
| P2-03 | [Bilder und Kartensuche](m2.md) | P2-02, P1-04 | Review |
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

## Freigaben und verbleibende Grenzen

- P0-01, P0-03 bis P0-06 sind als Planungsgrundlage freigegeben; P0-02 bleibt Review, weil der Collectr-Vertrag vorläufig ist. Ein echter Export fehlt.
- P1-01 bis P1-13 sind im dokumentierten lokalen Umfang abgenommen. P1-15 wurde am 28. Oktober 2026 nach erfolgreicher Hosted-CI abgenommen; [Prüfbelege](../historie/pruefprotokolle-p1.md#p1-15-automatische-repository-prüfungen).
- P1-14 wurde am 28. Oktober ausdrücklich zurückgestellt. Externe Alarmzustellung, unabhängige Recovery-Unterlagen, echter B2-Restore, Netzwerk-/Geräteprüfung und Hostintegration bleiben vor echten Sammlungsdaten erforderlich. Die vollständige Liste steht im [Betriebshandbuch](../betrieb.md#offene-betriebsabnahme-p1-14).
- Die lokale P2-01-Implementierung samt Selbstprüfungen und offenen Grenzen ist im [Prüfprotokoll](../historie/p2-01-2026-11-02.md) festgehalten; unabhängiger Review abgeschlossen, am 2. November 2026 vom Benutzer abgenommen.
- P3-05 braucht zusätzlich einen echten Collectr-Export und die Betriebsabnahme. Keine Planung oder Dokumentationspflege erteilt einen Betriebs- oder Importauftrag.

Bisherige Einzelbefunde und Freigaben bleiben in der [Abnahmechronik](../historie/abnahmen-bis-2026-10-28.md) erhalten. Neue Abnahmen mit Datum, Paket und akzeptierten Grenzen knapp hier eintragen; Prüfausgaben gehören in ein datiertes Prüfprotokoll.

P2-01 am 2. November 2026: Katalogschema, additive Migration und synthetische Fixtures umgesetzt; unabhängiger Review mit gezielter Testnacharbeit abgeschlossen. Am 2. November 2026 vom Benutzer abgenommen. [Prüfprotokoll und Grenzen](../historie/p2-01-2026-11-02.md).

P2-02 am 2. November 2026: manueller, transaktionaler YGOPRODeck-Import mit quellengebundenen Identitäten, Quellbeobachtungen und Status umgesetzt. Varianten und Drucke werden aus den unvollständigen Quellangaben nicht bestätigt. Nach unabhängiger kritischer Prüfung und erfolgreicher [GitHub-CI für aa25cef](https://github.com/GrothRico/ygh/actions/runs/41439573573) vom Benutzer am 2. November 2026 abgenommen. [Prüfprotokoll und Grenzen](../historie/p2-02-2026-11-02.md).

P1-16 am 2. November 2026: lokale Entwicklung mit zwei synthetischen Rollen, separater Datenbank und Produktionsbuild-Sperre umgesetzt und unabhängig kritisch geprüft. Am 2. November 2026 vom Benutzer nach erfolgreichem lokalem Zugriff abgenommen. [Prüfprotokoll und Grenzen](../historie/p1-16-2026-11-02.md).

P2-03 am 2. November 2026: lokale DE/EN-Namens- und Codesuche mit Fehlertoleranz, sichtbaren Mehrdeutigkeiten und geschützter Bildauslieferung umgesetzt. Auf Benutzerwunsch ausschließlich lokale Bilder; separater gedrosselter, fortsetzbarer Bildimport. Unabhängige Code-, Test-, Produktionsartefakt- und Docker-Prüfung abgeschlossen. [Prüfprotokoll, Bedienung und Grenzen](../historie/p2-03-2026-11-02.md).

P2-03-Erweiterung am 2. November 2026 ausdrücklich beauftragt: wöchentliche Aktualisierung der lokalen Kartenbasis und fehlender Bilder, sonntags um 06:00 UTC. Separater Ansible-/systemd-Zeitplan vorbereitet und unabhängig mit synthetischen Daten geprüft; nicht auf einem Server aktiviert. Der bisherige manuelle Bildimport bleibt verwendbar. [Nachtrag mit Nachweisen](../historie/p2-03-2026-11-02.md#nachtrag-regelmäßige-katalogaktualisierung).

P2-03-Erweiterung am 2. November 2026 ausdrücklich freigegeben: die jeweils letzten vollständigen YGOPRODeck-JSON-Antworten (EN, DE, Sets, Version) in SQLite erhalten, gemeinsam mit Projektionen und Erfolg aktualisieren. Umsetzung, fokussierte Prüfung und unabhängiger Review sind abgeschlossen; der lastabhängige Backup-Test-Timeout wurde durch einen gezielten echten Schreibzugriff während der SQLite-Kopie behoben; der aktuelle Hosted-CI-Nachweis folgt; der frühere Umsetzungsvorschlag ist durch diese Freigabe überholt. [Nachtrag mit Prüfergebnissen und Grenzen](../historie/p2-03-2026-11-02.md#nachtrag-vollständige-json-antworten).

Bewertung vor P2-04: P2-03 bleibt Review; menschliche Abnahme und aktueller Hosted-CI-Lauf stehen aus. Der zuvor instabile Backup-Test verwendet jetzt einen koordinierten echten Schreibzugriff während der Kopie; Luna und Hauptagent bestanden unabhängig die vollständige Testsuite parallel zur Typprüfung (64 bestanden, 13 Linux-Skips). [Unabhängiger Abschlussreview und offene Punkte](../historie/p2-03-2026-11-02.md#unabhängiger-abschlussreview-und-bewertung-der-offenen-punkte). P1-14 bleibt zurückgestellt, P0-02 wegen fehlendem Collectr-Export im Review; beide blockieren P2-04 nicht. Kein Folgepaket beauftragt.
