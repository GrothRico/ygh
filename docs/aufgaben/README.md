# Aufgabenindex

Stand geprüft: 6. November 2026. **P1-16 und P2-01 bis P2-08 sind abgenommen. Die Abnahme von P2-05 umfasst Bestandserfassung und -anzeige einschließlich gemeinsamer Ordnerverwaltung, Desktop-Baum, mobiler Navigation und Dialogaktionen. P2-06 ergänzt die abgenommene Verschiebungsfunktion; P2-07 ergänzt die abgenommene Bedienoberfläche einschließlich Sammelauswahl, gruppierter Mengen und Verschiebedialog.** P1-14 bleibt zurückgestellt; kein echter Server oder Betriebsauftrag. Die Tabelle ist die einzige laufende Paketstatusliste. [Dokumentationsübersicht](../README.md).

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
| P0-02 | [Collectr-Vertrag beschreiben](m0.md) | — | Abgenommen |
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
| P2-03 | [Bilder und Kartensuche](m2.md) | P2-02, P1-04 | Abgenommen |
| P2-04 | [Standorte verwalten](m2.md) | P1-04, P1-02 | Abgenommen |
| P2-05 | [Bestand erfassen und anzeigen](m2.md) | P2-03, P2-04 | Abgenommen |
| P2-06 | [Teilmengen atomar verschieben](m2.md) | P2-05 | Abgenommen |
| P2-07 | [Bestandsbedienung vervollständigen](m2.md) | P2-06 | Abgenommen |
| P2-08 | [Limited Edition ergänzen](m2.md) | P2-05 | Abgenommen |
| P3-01 | [Collectr-CSV parsen](m3.md) | P0-02, P2-05 | Abgenommen |
| P3-02 | [Importvorschau und Matching](m3.md) | P3-01 | Geplant |
| P3-03 | [Import bestätigen und korrigieren](m3.md) | P3-02, P2-06, P2-08 | Geplant |
| P3-04 | [Setquoten berechnen und anzeigen](m3.md) | P3-03 | Geplant |
| P3-05 | [Realen Import prüfen](m3.md) | P3-03, P1-14 | Geplant |
| P3-06 | [Sammlung vollständig exportieren](m3.md) | P3-03 | Geplant |
| P4-01 | [Deckregeln konkretisieren](m4.md) | P2-07 | Geplant |
| P4-02 | [Deckrezepte speichern](m4.md) | P4-01 | Geplant |
| P4-03 | [Bannlisten und Validierung](m4.md) | P4-02 | Geplant |
| P4-04 | [Visueller Deckeditor](m4.md) | P4-03, P2-03 | Geplant |
| P4-05 | [Standortbezogene Deckverfügbarkeit](m4.md) | P4-04, P2-05 | Geplant |
| P4-06 | [Decklisten austauschen](m4.md) | P4-02, P4-01 | Geplant |
| P4-07 | [Deckausleihe und Sammlungszuordnung](m4.md) | — | Entfallen (D07) |
| P5-01 | [Draftregeln exakt beschreiben](m5.md) | P4-02 | Geplant |
| P5-02 | [Cube-Rezepte und Editor](m5.md) | P5-01, P4-04 | Geplant |
| P5-03 | [Standortbezogene Cube-Verfügbarkeit](m5.md) | P5-02, P4-05 | Geplant |
| P5-04 | [Packs reproduzierbar erzeugen](m5.md) | P5-02 | Geplant |
| P5-05 | [Pack-Draft-Zustand implementieren](m5.md) | P5-04 | Geplant |
| P5-06 | [Lokale Draftoberfläche und Speicherung](m5.md) | P5-05, P1-04 | Geplant |
| P5-07 | [Grid-Draft ergänzen](m5.md) | P5-06, P5-01 | Geplant |
| P5-08 | [Sealed und Pooldeckbau](m5.md) | P5-06, P4-04 | Geplant |
| P6-01 | [Testfeldzustand und Aktionen](m6.md) | P4-02 | Geplant |
| P6-02 | [Testfeld bedienen](m6.md) | P6-01, P5-08 | Geplant |
| P7-01 | [Preiszuordnung untersuchen](m7.md) | P0-01 | Geplant |
| P7-02 | [Optionale Preise anzeigen](m7.md) | P7-01, P2-03 | Geplant |
| P7-03 | [Betrieb und Gesamtabnahme](m7.md) | P1-14, P3-04, P3-06, P4-06, P4-05, P5-03, P5-07, P5-08, P6-02 | Geplant |
| P7-04 | [Optionale Kategoriepacks](m7.md) | P5-07, P5-08 | Geplant |

## Freigaben und verbleibende Grenzen

- P0-01, P0-02/E02 und P0-03 bis P0-06 sind als Planungsgrundlage freigegeben. Eine echte Übernahme bleibt P3-05 vorbehalten und erfordert dessen Voraussetzungen sowie einen eigenen Betriebsauftrag.
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

P2-03-Erweiterung am 2. November 2026 ausdrücklich freigegeben: die jeweils letzten vollständigen YGOPRODeck-JSON-Antworten (EN, DE, Sets, Version) in SQLite erhalten, gemeinsam mit Projektionen und Erfolg aktualisieren. Umsetzung, fokussierte Prüfung und unabhängiger Review sind abgeschlossen; der lastabhängige Backup-Test-Timeout wurde durch einen gezielten echten Schreibzugriff während der SQLite-Kopie behoben; der aktuelle Hosted-CI-Nachweis ist erfolgreich; der frühere Umsetzungsvorschlag ist durch diese Freigabe überholt. [Nachtrag mit Prüfergebnissen und Grenzen](../historie/p2-03-2026-11-02.md#nachtrag-vollständige-json-antworten).

P2-03 wurde am 2. November 2026 vom Benutzer abgenommen, einschließlich Wochenplan, JSON-Speicherung und dokumentierter Grenzen. Der öffentliche Livekatalog wurde danach in die lokale Entwicklungsdatenbank importiert (14.653 Karten, 11.755 deutsche Namen, 1.036 Sets); der Bildimport wurde auf Benutzerwunsch nach 148 gespeicherten Bildern beendet. Vollständiger Bildimport, echte Gerätetests und spätere Serverabnahme bleiben offen. Der [Hosted-CI-Lauf für af15810](https://github.com/GrothRico/ygh/actions/runs/41453406616) ist erfolgreich: 77 Node-Tests einschließlich aller Linux-Tests, 26 Python-Tests, Typprüfung, Lint und Produktionsbuild. Der zuvor instabile Backup-Test verwendet jetzt einen koordinierten echten Schreibzugriff während der Kopie; Luna und Hauptagent bestanden unabhängig die vollständige Testsuite parallel zur Typprüfung (64 bestanden, 13 Linux-Skips). [Unabhängiger Abschlussreview und offene Punkte](../historie/p2-03-2026-11-02.md#unabhängiger-abschlussreview-und-bewertung-der-offenen-punkte). P1-14 bleibt zurückgestellt, P0-02 wegen fehlendem Collectr-Export im Review; beide blockieren P2-04 nicht. P2-04 wurde am 2. November 2026 ausdrücklich beauftragt; Voraussetzungen P1-02 und P1-04 sind abgenommen.

P2-04 am 2. November 2026: Standortbaum, idempotente Grundstandorte, Boxen/Binder/Fächer, Umbenennen/Verschieben und sichere Blattlöschung umgesetzt. Unabhängiger Review mit gezielter Nacharbeit, echter paralleler Zyklusprüfung und isolierter Produktionsseitenprüfung abgeschlossen. 73 lokale Tests bestanden, 13 Linux-Skips; kein aktueller Hosted-CI-Lauf für diesen Arbeitsstand. Der lokale Zugang wurde am 3. November 2026 auf ausdrücklichen Benutzerwunsch auf Port 13001 umgestellt; Startseite und Standortverwaltung sind geprüft erreichbar. Die lokale Datenbank wurde beim Start additiv migriert; Standorte werden weiterhin erst durch die Benutzeraktion angelegt. [Prüfprotokoll und Bedienung](../historie/p2-04-2026-11-02.md).

P2-04 wurde am 3. November 2026 vom Benutzer nach Besichtigung abgenommen. Bezeichnung und Zweck des ungeklärten Eingangs sind ausdrücklich akzeptiert. P2-05 wurde anschließend ausdrücklich beauftragt; seine Voraussetzungen P2-03 und P2-04 sind abgenommen.

P2-05 am 3. November 2026: Bestands-/Verlaufsschema, geschützte Erfassung mit Sprache/Edition/Druckbezug, gruppierte Mengenanzeige und versionsgeprüfte Korrekturen umgesetzt. Die Suchtreffer enthalten jetzt die direkte Inline-Erfassung; fokussierte UI-/Actiontests (9 Tests), Typprüfung und Lint bestanden. Der vorherige unabhängige Integritäts-, Parallelitäts-, Backup- und Produktionsseitenreview bleibt dokumentiert: 86 Tests bestanden, 13 Linux-Skips, Typprüfung/Lint/Build erfolgreich. Lokal auf Port 13001 erreichbar, Migration angewandt; keine Testbestände in der lokalen Entwicklungsdatenbank erzeugt. Aktuelle Hosted-CI und menschliche Browserabnahme der Inline-Erfassung stehen aus. [Prüfprotokoll, Bedienung und Grenzen](../historie/p2-05-2026-11-03.md).

P2-05-UX-Nacharbeit am 3. November 2026 ausdrücklich beauftragt: direktes Hinzufügen mit allen Parametern im Suchtreffer, ohne zusätzliche Navigation. Mit echter isolierter Browserbedienung einschließlich Fehlerfall, zwei aufeinanderfolgenden Karten und erhaltenen Auswahlwerten unabhängig geprüft. 88 Tests bestanden, 13 Linux-Skips; Build/Typprüfung und Lint erfolgreich. Normaler lokaler Zugang auf Port 13001 wiederhergestellt. P2-05 bleibt Review. [UX-Prüfbericht](../historie/p2-05-2026-11-03.md#ux-nacharbeit-direktes-hinzufügen-in-suchtreffern-3-november-2026).

P2-05-UX-Nacharbeit am 3. November 2026: kompakte Such-/Bestandsansichten mit gemeinsamem Detailschalter und erhaltenen Eingaben sowie Standortfilter einschließlich Unterstandorten umgesetzt und unabhängig im isolierten Browser geprüft, auch mit Pagination. 91 Tests bestanden, 13 Linux-Skips; Typprüfung, Lint und Build erfolgreich. Normaler lokaler Stack wiederhergestellt; menschliche Abnahme, echte Telefone und aktuelle Hosted-CI bleiben offen. [Prüfbericht](../historie/p2-05-2026-11-03.md#ux-nacharbeit-kompakte-ansichten-und-standortfilter-3-november-2026).

Definitionsänderung vom 3. November 2026 ausdrücklich beauftragt: Decks und Cubes sind ausschließlich nichtphysische Rezepte ohne Standort oder Bestandsbindung. [D07](../entscheidungen.md#d07--decks-und-cubes-als-nichtphysische-konzepte) ersetzt die frühere Besitzer-/Ausleihregel. P4-05 und P5-03 planen die jeweilige Standort-Verfügbarkeitsansicht; P4-07 ist aufgehoben, abhängige Pakete sind angepasst. Das ist keine Freigabe zur Implementierung weiterer Pakete.

P2-05-Verzeichnisnavigation am 3. November 2026 ausdrücklich beauftragt und umgesetzt: direkte Unterordner, Standortpfad und eine Ebene zurück auf dem vorhandenen Standortbaum. Bilder pro Standortordner bleiben eine vorgemerkte spätere Option. Unabhängiger Code-/Browserreview und gezielte Nacharbeit dokumentiert im [Paketprotokoll](../historie/p2-05-2026-11-03.md). Status bleibt Review.

P0-02/E02 am 3. November 2026 anhand des echten Collectr-Exports ergänzt: [Analyse, Mengen und nächste Schritte](../untersuchungen/collectr-export-2026-11-03.md). Kein Import ausgeführt. Die bisher fehlende Datei liegt vor. Am 6. November 2026 nach bedingter Benutzerabnahme lesend nachgeprüft und freigegeben; versehentlich einschließlich Watchlist gezählte Editionszeilen im datierten Nachtrag korrigiert. Mengen unverändert bestätigt; physische Vollständigkeit und bestätigte Katalogzuordnungen bleiben offen. Limited Edition ist als Erweiterung beschlossen und inzwischen durch P2-08 umgesetzt und abgenommen. Reale Übernahme bleibt P3-05 nach den vorgesehenen Voraussetzungen vorbehalten.

P2-05-Ordnervereinfachung am 3. November 2026 ausdrücklich beschlossen und umgesetzt: Standorttypen für normale Behälter entfallen zugunsten von Name und Parent (D10). Neue Vorwärtsmigration `0006_location_folders` erhält IDs, Namen, Baum, Bestände und Verlauf; Kontextanlage im geöffneten Bestandsordner fragt nur den Namen ab. Unabhängige Migrations-/Rollback-/Browserprüfung abgeschlossen, normaler lokaler Stack nach Sicherung aktualisiert. 98 Tests bestanden, 13 Linux-Skips; Typprüfung/Lint/Build erfolgreich. P2-05 bleibt Review; keine andere Aufgabe gestartet. [Prüfbericht](../historie/p2-05-2026-11-03.md#ux-nacharbeit-frei-benannte-standortordner-3-november-2026).

P2-05-Oberflächenbereinigung und D11 am 3. November 2026 ausdrücklich freigegeben und umgesetzt: Bestand/Ordnerverwaltung vereint, Desktop-Baum und mobile Ordnernavigation, Drei-Punkte-Menüs mit Dialogen; Standortfilter, separate Verwaltung, manuelle Startstandorte und feste Benutzerzuordnung entfallen. Migration 0007 erhält Namen, IDs, Baum und Bestände und legt automatisch einen ungeklärten Eingang an, falls noch keiner existiert. Persönliche Auswertungen werden durch frei gewählte Ordnerbereiche ersetzt; Namen wie Rico/Remo sind normale Ordner. Unabhängiger Desktop-/Mobil-, Migrations-/Rollback- und Parallelitätsreview abgeschlossen. Normaler lokaler Stack nach Sicherung aktualisiert und Datenfingerprint unverändert bis auf beschlossene Metadatenentfernung. P2-05 bleibt Review; echte Telefone, menschliche Abnahme und aktuelle Hosted-CI bleiben offen. [Prüfbericht](../historie/p2-05-2026-11-03.md#ux-nacharbeit-gemeinsame-bestandsansicht-und-freie-ordnerbereiche-3-november-2026).

P2-05-Ordnerdarstellung am 3. November 2026 nach weiterem Benutzerfeedback bereinigt: rahmenlose Ordnerlinks, Ordner-plus-Button mit Anlegen-Dialog, größerer Pfad mit Hover-/Fokus-Unterstrich und Parent-Pfeil; Außenklick/Escape schließt Kontextmenüs. Aktueller-Ordner-Hinweis und dauerhafte Anlegen-Zeile entfernt. Isolierte Desktop-/Mobilprüfung einschließlich zweier aufeinanderfolgender Ordneranlagen und Fehlerfall bestanden; normaler lokaler Datenstand unverändert, P2-05 bleibt Review. [Prüfbericht](../historie/p2-05-2026-11-03.md#ux-nacharbeit-kompakte-ordnerdarstellung-3-november-2026).


P2-05-Gestaltungsreview am 3. November 2026: kompakter Seitenkopf, ausgerichtete rahmenlose Ordner, konsistente Icons/Toolbar/Dialogbuttons und Kartenzeilen mit seitlichem Bild umgesetzt. Unabhängige Desktop-/Mobilprüfung und gezielte Korrekturen abgeschlossen; keine Datenänderungen. Status bleibt Review. [Prüfbericht](../historie/p2-05-2026-11-03.md#visuelle-vereinheitlichung-der-bestandsansicht-3-november-2026).


P2-05 am 3. November 2026 vom Benutzer nach dem Gestaltungsreview ausdrücklich abgenommen. Die Bedingung ist erfüllt: Karten beziehungsweise Teilmengen zwischen Standorten zu verschieben ist Bestandteil von P2-06 (Transaktion und Serveraufruf) und P2-07 (Bedienoberfläche), nicht von P2-05. Echte Telefone und aktuelle Hosted-CI bleiben ungeprüft; die bisherigen Prüfbelege stehen im [Paketprotokoll](../historie/p2-05-2026-11-03.md). Kein Folgepaket mit dieser Abnahme beauftragt oder gestartet.


P2-06 am 3. November 2026 nach ausdrücklichem Auftrag umgesetzt und unabhängig geprüft: versionsgeprüfte atomare Teil-/Vollverschiebung, korrelierter Verlauf, geschützte Serveraktion und Vorwärtsmigration `0008_stock_movements`. 104 Tests bestanden, 13 Linux-Skips; Typprüfung, Lint und Build erfolgreich. Zwei gleichzeitige Worker-Aufrufe auf dieselbe Datei sowie Auditfehler-Rollbacks geprüft. Keine Migration des laufenden lokalen Bestands, kein Verschiebedialog; dieser bleibt P2-07. Status Review, menschliche Abnahme offen. Der vorherige abgenommene Stand bis P2-05 wurde auf ausdrücklichen Auftrag als `aae7f39` nach `origin/main` gepusht; P2-06 bleibt zunächst lokal. [Prüfprotokoll](../historie/p2-06-2026-11-03.md).


P2-06 am 5. November 2026 ausdrücklich vom Benutzer abgenommen; P2-07 anschließend beauftragt. Die noch ausstehende Migration der laufenden lokalen Datenbank und fehlende aktuelle Hosted-CI sind im P2-06-Protokoll dokumentiert.


P2-07 am 5. November 2026 umgesetzt und unabhängig geprüft: Verschiebedialog je Bestandszeile, Zielordnerbaum, erhaltene Eingaben bei Versionskonflikt, Quelle/Ziel im Verlauf und SQL-Pagination vor dem Laden der Detailzeilen. Isolierter Browsernachweis für 2 von 5, Vollverschiebung, Konkurrenzkorrektur, Unterordnerziel und Desktop-/Mobilbreiten; 15.000 synthetische Gruppen mit 25 Bild-URLs pro gerenderter Seite geprüft. 105 Tests bestanden, 13 Linux-Skips; Typprüfung, Build und Lint erfolgreich. Echte Telefone und aktuelle Hosted-CI offen. Der zunächst von der automatischen Freigabeprüfung abgelehnte lokale Start mit Migration 0008 wurde am 6. November 2026 ausdrücklich freigegeben und ausgeführt; Datenfingerprint unverändert, SQLite-Integrität ok und `/bestand` mit HTTP 200 erreichbar. Status Review. [Prüfbericht](../historie/p2-07-2026-11-05.md).


P2-07-UX-Nacharbeit am 6. November 2026 ausdrücklich beauftragt und umgesetzt: Sammelauswahl mit Checkboxen/Mengen außerhalb der Details, Ordnerpfeil in der Toolbar und gemeinsame atomare Verschiebung mehrerer Karten. Unabhängige Browserprüfung für unterschiedliche Karten/Sprachen, späten Versionskonflikt ohne Teiländerung, mobile Ansicht und Rücksetzen bei Navigation bestanden. 110 Tests bestanden, 13 Linux-Skips; Typprüfung, Lint und Build erfolgreich. Normaler lokaler Stack wiederhergestellt (HTTP 200), Datenfingerprint unverändert. Status bleibt Review; keine Folgeaufgabe begonnen. [Nachweis](../historie/p2-07-2026-11-05.md#ux-nacharbeit-sammelauswahl-zum-verschieben-6-november-2026).


P2-07-Darstellungskorrektur am 6. November 2026 nach Screenshot: intern getrennte, identische Teilbestände am selben Ort werden für die Sammelauswahl zu einer Checkbox mit Gesamtmenge zusammengefasst. Keine Datenzusammenführung oder Schemaänderung. Gruppierte Mengen über mehrere Ursprungszeilen, Versionskonflikt-Rollback und Mobilansicht unabhängig geprüft. 127 Tests bestanden, 13 Linux-Skips; Typprüfung, Build und Lint erfolgreich. Normaler Stack wieder erreichbar, Datenfingerprint unverändert. Status bleibt Review. [Prüfbericht](../historie/p2-07-2026-11-05.md#ux-nacharbeit-identische-teilbestände-zusammenfassen-6-november-2026).


P2-07 am 6. November 2026 vom Benutzer ausdrücklich abgenommen, einschließlich Sammelverschiebung außerhalb der Details und gemeinsamer Auswahl identischer Teilbestände mit Gesamtmenge. Echte iPhone-/Android-Prüfungen und aktuelle Hosted-CI bleiben als ungeprüft dokumentiert; die bisherigen Nachweise stehen im [Prüfbericht](../historie/p2-07-2026-11-05.md). Keine Folgeaufgabe mit dieser Abnahme beauftragt oder gestartet.


P2-08 am 6. November 2026 ausdrücklich beauftragt, umgesetzt und unabhängig geprüft: Limited Edition als eigener Wert in Varianten/Bestand, manueller Erfassung, Korrektur, Such-/Druckbeschriftungen und Bewegungsanzeige; Vorwärtsmigration `0009_limited_edition` mit erhaltenen befüllten FK-Verweisen und Verlauf. 134 Tests bestanden, 13 Linux-Skips; Typprüfung, Build und Lint erfolgreich. Isolierte Browserprüfung für manuelle Erfassung, Editionskorrektur, Trennung anderer Editionen und widersprüchlichen Druck bestanden. Am selben Tag nach ausdrücklichem Betriebsauftrag auf der gesicherten bestehenden lokalen Datenbank migriert und `ygh-local` gestartet: sämtliche fachlichen Tabelleninhalte unverändert, SQLite-Integrität/Fremdschlüssel geprüft, `/bestand` antwortet mit HTTP 200. Am 6. November 2026 vom Benutzer ausdrücklich abgenommen. Echte Telefone und aktuelle Hosted-CI bleiben ungeprüft; kein Collectr-Import gestartet. P0-02/E02 ist nach der dokumentierten Nachprüfung ebenfalls abgenommen; die bereits beauftragte Fortsetzung P3-01 beginnt am 6. November 2026 mit synthetischen Parserprüfungen ohne echte Übernahme. [Prüfbericht](../historie/p2-08-2026-11-06.md).

P3-01 am 6. November 2026 umgesetzt: begrenzter Collectr-CSV-Parser mit Rohdatensatz, geordneten Feldern und Headerzuordnung, Originalzeilennummern, Syntax-/Feldbreitenbefunden und unveränderten Quellwerten. Synthetische Prüfungen decken Quotes, multiline Inhalte, Umordnung/Zusatzheader, Duplikatheader und -zeilen, Mengen, Watchlist und Editionsrohwerte ab. Parser ausschließlich mit synthetischen Daten geprüft; kein echter Import. Unabhängiger Review samt gezielter Nacharbeit abgeschlossen: Rohwerte auch bei Feldbreitenfehlern erhalten, Zeilenfehler trotz aggregierter Diagnosegrenze sichtbar, sichere Ganzzahlen geprüft. 12 Parser-Tests bestanden; vollständiger Projektlauf vor dem zusätzlichen Grenztest: 145 bestanden, 13 Linux-Skips. Typprüfung und Lint erfolgreich. Am 6. November 2026 vom Benutzer ausdrücklich abgenommen. Build, Python-/Linux-Hosttests und aktuelle Hosted-CI für dieses Paket nicht ausgeführt; kein echter Import. P3-02 und weitere Pakete sind nicht gestartet. [Prüfprotokoll](../historie/p3-01-2026-11-06.md).
