# Arbeiten mit einem LLM

Ziel ist eine nachvollziehbare Umsetzung durch ein günstiges Coding-Modell. Kleine Aufgaben ersetzen nicht fachliche Prüfungen, reduzieren aber die Zahl der Entscheidungen, die das Modell gleichzeitig treffen muss. Dieser Ablauf ist bewusst manuell; es wird kein Agenten-Orchestrator gebaut.

## Aktueller Stand

P1-01 bis P1-13 sind abgenommen. P0-06/E06 wurde am 2026-10-27 als Planungsgrundlage freigegeben. P1-14 ist auf ausdrücklichen Wunsch zurückgestellt; es gibt noch keinen echten Server und keinen Betriebsauftrag. P1-15 verwendet das vom Benutzer festgelegte private GitHub-Repository; dessen Sichtbarkeit wurde beim Push unabhängig geprüft. Das Remote `origin` zeigt auf dieses Repository; `codex/p1-15-ci` enthält den Prüfstand. Der erste Hosted-Lauf scheiterte an vier hostbezogenen Tests wegen der Runner-UID; die CI-Korrektur ist lokal geprüft, aber noch nicht gepusht. P1-15 steht im Status Review. Für P1-12 bleiben die dokumentierten Live-Gates vor Nutzung echter Sammlungsdaten erforderlich: kein externes Speicherziel, Live-Alarm, Serverjob oder Restore mit echten Nutzdaten wurde praktisch eingerichtet. Der [Zwischenbericht](zwischenbericht-2026-10-22.md) bleibt ein unveränderter historischer Snapshot. [Aufgabenindex](aufgaben/README.md) und [Entscheidungsregister](entscheidungen.md) bleiben maßgeblich.

## Rollen im aktuellen Projekt

Luna ist der ausführende Agent für das jeweils beauftragte Paket. Der Hauptagent bleibt die kritisch prüfende Instanz: Er prüft Änderungen gegen Anforderungen und Quellen, unterscheidet belegte Ergebnisse von Annahmen und fordert gezielte Nacharbeit bei konkreten Fehlern. Lunas Selbstprüfung ersetzt diese Prüfung nicht; menschliche Freigabe und praktische Abnahmen bleiben erforderlich.

### Reasoning für Luna wählen

Vom Benutzer am 2026-10-22 festgelegt: Der Hauptagent wählt Lunas Reasoning-Stufe selbstständig passend zum konkreten Auftrag. Standard ist **Medium**, nicht pauschal High.

| Stufe | Einsatz |
| --- | --- |
| Low | Einfache Dokumentationsänderungen und klar vorgegebene kleine Korrekturen. |
| Medium | Normale, klar abgegrenzte Implementierung einschließlich Tests, beispielsweise eine einfache SQLite-Anbindung wie P1-02. |
| High | Schwierige Fehlersuche, Zugriffsschutz, komplexe Bestandstransaktionen, Wiederherstellung oder ähnlich anspruchsvolle Integritätsfragen. |

Bei der Beauftragung die Stufe ausdrücklich setzen und kurz begründen. Entscheidend ist die tatsächliche Teilaufgabe: Eine einfache Dokumentationskorrektur in einem Sicherheitspaket braucht nicht automatisch High. Bei konkreten Denk- oder Diagnoseproblemen kann der Hauptagent die Stufe für die gezielte Nacharbeit erhöhen; fehlende Informationen oder Netzwerk-/Werkzeugfehler werden nicht durch mehr Reasoning gelöst. Die bestehenden Grenzen für Reparaturversuche bleiben gültig.

Die unabhängige kritische Prüfung und die Abnahmekriterien bleiben bei jeder Stufe gleich. Aufwand anhand des gesamten Durchgangs einschließlich nötiger Nacharbeit beurteilen; ein Kostenvorteil oder gleiche Qualität wird ohne Vergleich nicht als bewiesen behandelt. High ist keine Qualitätsgarantie. Orientierung: [OpenAI-Dokumentation zu Reasoning](https://developers.openai.com/api/docs/guides/reasoning), geprüft am 2026-10-22.

## Ein Paket je Arbeitsdurchgang

1. Benutzer wählt eine Paket-ID und beauftragt sie. Vorherige Voraussetzungen müssen abgenommen sein.
2. Modell liest Arbeitsregeln, Paket und gezielt benötigte Fachabschnitte. Es prüft vorhandene Dateien und nennt kurz seinen Plan.
3. Modell setzt nur dieses Paket um und prüft dessen konkrete Abnahme. Normale Implementierungsentscheidungen darf es innerhalb des vereinbarten Rahmens selbst treffen.
4. Ergebnis geht in den Status `Review`. Es enthält überprüfbare Befunde statt „sollte funktionieren“.
5. Review und praktischer Test prüfen das Ergebnis. Nach fachlicher Freigabe setzt der Benutzer beziehungsweise ein ausdrücklich beauftragter Dokumentationsschritt den Status auf `Abgenommen`.
6. Geprüfte Änderung als eigener Git-Commit sichern. Bei eingerichtetem Remote kann pro Paket ein Branch/PR verwendet werden. Merge und Produktionsdeployment sind getrennte Entscheidungen.

Ein Review kann im frischen Chat mit demselben günstigen Modell erfolgen. Authentifizierung, Bestands-Transaktionen, Restore und Draft-Mengenerhaltung brauchen eine besonders sorgfältige unabhängige Prüfung; bei ungelösten Befunden stärkere Expertise oder ein stärkeres Modell hinzuziehen. Das kostet punktuell weniger als dauernde Umwege durch ungeklärte Architektur. Modellreview ist kein Sicherheitsnachweis.

## Aufgaben bewusst klein halten

Die Pakete benennen Ergebnis, Abhängigkeiten, Fachkontext, Änderungsbereich, Abnahme und Ausschlüsse. Sie sind keine Aufgaben, die ohne Lesen automatisch ausgeführt werden sollen.

Als Richtwert soll ein Paket eine fachliche Operation oder einen klar abgegrenzten technischen Baustein liefern. Wenn vor Beginn absehbar mehrere neue Subsysteme oder viele nicht zusammengehörige Dateien nötig sind, nur einen Teilungsvorschlag liefern. Keine starre Zeilenzahl: generierte Lockfiles sind etwas anderes als 500 Zeilen neue Fachlogik.

Bei späteren Meilensteinen wird vor der ersten Implementierung eine kurze Paketprüfung gegen den tatsächlichen Code durchgeführt. Dann werden konkrete Dateipfade und bestehende Funktionsnamen ergänzt. Diese Vorbereitung verhindert, dass das günstige Modell ein veraltetes Schema oder einen nicht existierenden Pfad blind übernimmt. Anforderungen und Sicherheitsregeln bleiben unverändert.

Nur die aktuell ausgewählte Paketbeschreibung ist Umsetzungskontext. Die weiteren Pakete desselben Dokuments sind nicht automatisch mitbeauftragt. Keine parallelen schreibenden Agenten.

## Git und Arbeitsstand

Vor Änderungen `git status` prüfen. Ausgangspunkt und bereits vorhandene Änderungen in der Übergabe nennen. Ein sauberes Repository ist vorzuziehen; fremde Änderungen werden niemals bereinigt. Der Benutzer sollte die Planungsdokumente vor der Implementierung als Ausgangsstand committen. Aktuell wurde kein Commit durch diesen Planungsschritt erstellt.

Vorschlag für Branches: `codex/p1-01-grundgeruest`. Keine Annahme über vorhandenes GitHub-Remote oder CI. Lokale Prüfung funktioniert auch ohne Remote. Erst wenn ein Remote tatsächlich festgelegt ist, die dazu passende CI einrichten.

## Status

| Status | Bedeutung |
| --- | --- |
| Geplant | Noch nicht beauftragt oder Voraussetzungen noch offen. |
| In Arbeit | Explizit beauftragt und begonnen. |
| Blockiert | Konkrete fehlende Information oder technische Voraussetzung dokumentiert. |
| Review | Umsetzung und Selbstprüfung übergeben; noch nicht abgenommen. |
| Abgenommen | Menschliche Freigabe dokumentiert, inklusive verbleibender Einschränkungen. |

Der Index enthält den Status; keine zweite konkurrierende Statusliste anlegen. Paketbeschreibungen bleiben die Abnahmereferenz. Freigaben, relevante Testbefunde und akzeptierte Einschränkungen können direkt im Index unter der Paket-ID notiert werden.

## Startprompt

```text
Bearbeite ausschließlich Paket <ID> aus docs/aufgaben/README.md.
Lies AGENTS.md, docs/arbeit-mit-llm.md und die im Paket genannten Abschnitte.
Prüfe zuerst Abhängigkeiten und den tatsächlichen Repository-Stand.
Setze nur den definierten Umfang um; führe die vorgesehenen Prüfungen aus.
Bei ungeklärten Voraussetzungen liefere einen konkreten Befund statt einer Annahme.
Ändere keine Produktentscheidungen oder Abnahmekriterien.
Kein Produktionszugriff, keine Bestellung, kein Commit oder Push.
Aktualisiere den Aufgabenstatus und übergib das Ergebnis zur Prüfung.
Starte danach keine weitere Aufgabe.
```

Für die Planungspakete P0 gilt „setze um“ ausschließlich für die genannten Dokumente, nicht für Anwendungscode oder Infrastruktur.

## Reviewprompt

```text
Prüfe ausschließlich die Änderungen für Paket <ID> gegen dessen Abnahme.
Lies AGENTS.md und den tatsächlichen Diff zum angegebenen Ausgangsstand <REF>.
Ändere keine Dateien. Suche nach konkreten Fehlern, Sicherheitslücken,
Verletzungen der Bestandsregeln und unnötiger Komplexität.
Prüfe, ob Tests echte Anforderungen abdecken und ob Ergebnisse belegt sind.
Nenne pro Befund Datei/Zeile, Auslöser, Auswirkung und kleinsten Korrekturansatz.
Trenne Fehler, offene Prüfungen und optionale Verbesserungsideen.
Wenn kein Fehler erkennbar ist, nenne trotzdem die nicht geprüften Grenzen.
```

## Übergabeformat

```text
Paket und Ausgangsstand:
Ergebnis / zentrale Funktionsstelle:
Geänderte Dateien:
Prüfungen: Befehl oder manueller Schritt → tatsächliches Ergebnis
So prüfst du es selbst: maximal fünf konkrete Schritte
Bekannte Grenzen / erforderliche Entscheidung:
Status: Review oder Blockiert
```

Routineentscheidungen brauchen keine Einzelabnahme. Architekturänderungen, zusätzliche laufende Kosten, neue externe Dienste und produktive Eingriffe müssen dagegen vor ihrer Ausführung konkret entschieden werden. Wiederholte Reparaturversuche dürfen keine unkontrollierten Refactorings auslösen.
