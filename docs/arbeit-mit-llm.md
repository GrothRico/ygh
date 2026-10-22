# Arbeiten mit einem LLM

Ziel ist eine nachvollziehbare Umsetzung durch ein günstiges Coding-Modell. Kleine Aufgaben ersetzen nicht fachliche Prüfungen, reduzieren aber die Zahl der Entscheidungen, die das Modell gleichzeitig treffen muss. Dieser Ablauf ist bewusst manuell; es wird kein Agenten-Orchestrator gebaut.

## Aktueller Stand

P1-01 ist als erstes Implementierungspaket beauftragt; Einrichtung und Prüfergebnisse werden in docs/entwicklung.md dokumentiert. Kein Server bestellt. Weitere Arbeitspakete benötigen einen ausdrücklichen Einzelauftrag. [Aufgabenindex](aufgaben/README.md) und [Entscheidungsregister](entscheidungen.md) sind der gemeinsame Stand über Chats hinweg.

## Rollen im aktuellen Projekt

Luna ist der ausführende Agent für das jeweils beauftragte Paket. Der Hauptagent bleibt die kritisch prüfende Instanz: Er prüft Änderungen gegen Anforderungen und Quellen, unterscheidet belegte Ergebnisse von Annahmen und fordert gezielte Nacharbeit bei konkreten Fehlern. Lunas Selbstprüfung ersetzt diese Prüfung nicht; menschliche Freigabe und praktische Abnahmen bleiben erforderlich.

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
