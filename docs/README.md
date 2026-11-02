# Dokumentation

Hier beginnt der Wiedereinstieg. Dokumentationspflege startet kein zusätzliches Paket und keinen Livebetrieb. Der [Aufgabenindex](aufgaben/README.md) enthält den aktuellen Status und die nötigen Freigaben.

| Frage | Maßgebliche Datei |
| --- | --- |
| Was soll die Anwendung können? | [Projektspezifikation](projektspezifikation.md) |
| Was ist erledigt, offen oder beauftragt? | [Aufgabenindex](aufgaben/README.md) |
| Was umfasst ein einzelnes Paket? | Paketbeschreibung `aufgaben/m0.md` bis `m7.md`, jeweils aus dem Index verlinkt |
| Warum wurde etwas so entschieden? | [Entscheidungsregister](entscheidungen.md) |
| Welche Tabellen sind geplant, welche vorhanden? | [Datenmodell](datenmodell.md); tatsächliches Schema unter `src/server/db/` |
| Wie starte und prüfe ich lokal? | [Entwicklung](entwicklung.md) |
| Wie ist der Betrieb vorbereitet, welche Live-Nachweise fehlen? | [Betrieb](betrieb.md) |
| Wie arbeiten Luna und Reviewer zusammen? | [Arbeitsablauf](arbeit-mit-llm.md) und [AGENTS.md](../AGENTS.md) |
| Wie pflegen wir diese Dokumente? | [Dokumentationsrichtlinien](dokumentationsrichtlinien.md) |
| Wie hängen die größeren Arbeitsbereiche zusammen? | [Meilensteine](meilensteine.md), keine zweite Paketstatusliste |

## Belege und Historie

[Untersuchungen](untersuchungen/README.md) enthalten datierte externe Recherche und ihre Evidenzgrenzen. Sie sind keine aktuellen Bedienanleitungen; insbesondere Preise, Tarife und API-Beispiele gelten für ihren Abrufstand.

- [Prüfprotokolle P1](historie/pruefprotokolle-p1.md): bisherige Implementierungs- und Reviewnachweise einschließlich fehlgeschlagener Versuche und offener Grenzen.
- [Abnahmechronik bis 28. Oktober 2026](historie/abnahmen-bis-2026-10-28.md): ursprüngliche Freigabe-/Reviewnotizen; überholte Zwischenstände bleiben als Verlauf erkennbar.
- [Zwischenbericht 28. Oktober 2026](zwischenbericht-2026-10-28.md) und [22. Oktober 2026](zwischenbericht-2026-10-22.md): unveränderte Momentaufnahmen. Damalige Aussagen zu Git, Status und nächsten Schritten sind keine aktuellen Freigaben.

Bei Widersprüchen zuerst tatsächlichen Code, freigegebene Entscheidung und Statusquelle vergleichen. Einen Konflikt dokumentieren und klären; weder einen alten Vorschlag still als Entscheidung behandeln noch Kriterien nachträglich an eine Implementierung anpassen.
