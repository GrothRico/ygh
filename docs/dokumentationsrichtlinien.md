# Dokumentationsrichtlinien

Gültig ab 2. November 2026. Ziel: kurze, verlässliche Einstiegsdokumente und auffindbare Belege. Dokumentation soll die eigene Fehlersuche und kleine LLM-Aufträge erleichtern. Sie schafft keine Implementierungs-, Betriebs-, Commit- oder Pushfreigabe.

## Eine zuständige Quelle je Information

Die Zuordnung steht in der [Dokumentationsübersicht](README.md). Paketstatus und Abnahmen werden nur im Aufgabenindex laufend gepflegt. Andere Dokumente verlinken ihn statt vollständige Statuslisten zu kopieren. Versionspins stehen in Manifest, Lockfile, `.nvmrc` und Requirements; Anleitungen verweisen darauf. Konkrete Testversionen bleiben im datierten Prüfprotokoll.

Die Spezifikation beschreibt das Produkt und dauerhafte Regeln; das Entscheidungsregister dokumentiert Entscheidungen mit Gründen und Grenzen. Das Datenmodell kennzeichnet Ist-Schema und Zukunftsentwurf. Entwicklung und Betrieb erklären vorhandene Abläufe. Preis-/Tarif-/API-Recherche gehört mit Datum und Quelle in Untersuchungen. Keine ungeprüften „aktuellen“ Preise oder Versionsbehauptungen übernehmen.

Kurze Zusammenfassungen sind erlaubt, wenn sie auf die zuständige Quelle verweisen und keine weitere unabhängig gepflegte Detailtabelle schaffen. Insbesondere Retention-/Alarmparameter nicht in mehreren Anleitungen vollständig duplizieren.

## Gegenwart, Plan und Historie trennen

- **Implementiert:** durch vorhandene Dateien/Code belegbar. Ein Entwurf oder ein vorhandenes Skript beweist keinen Livebetrieb.
- **Geplant oder vorgeschlagen:** noch nicht umgesetzt beziehungsweise noch nicht beschlossen; benötigte Entscheidung nennen.
- **Geprüft:** Datum, konkreter Stand, Umgebung, ausgeführte Prüfung und Ergebnis nennen. „Nicht ausgeführt“, „übersprungen“ und „fehlgeschlagen“ niemals als bestanden zählen.
- **Abgenommen:** nur nach ausdrücklicher menschlicher Freigabe; Datum und akzeptierte Grenzen im Aufgabenindex festhalten.
- **Historisch:** datierte Recherche, abgeschlossene Prüfprotokolle und Zwischenberichte. Nicht als aktuelle Anleitung ausgeben.

Aktuelle Dokumente werden inhaltlich ersetzt und konsistent gehalten. Keine Folge widersprüchlicher „Status Review / später abgenommen / noch kein Remote“-Nachträge in einer Anleitung. Solche Nachweise gehören in die Chronik; die Anleitung enthält den heutigen Ablauf und Links.

Zwischenberichte bleiben Momentaufnahmen. Korrekturen an einem historischen Befund als datierten Korrekturvermerk kennzeichnen, nicht rückwirkend einen damals nicht ausgeführten Test behaupten. Bei Archivierung Inhalt und Evidenz erhalten, relative Links anpassen und Zweck oben erklären. Keine Archivstruktur pro Kleinänderung: ein datiertes Protokoll pro Paket oder zusammenhängender Prüfung reicht.

## Wann was aktualisieren?

| Auslöser | Nötige Pflege |
| --- | --- |
| Neuer oder geänderter Befehl, Konfigurationswert, Dateipfad | Betroffene Entwicklungs-/Betriebsanleitung prüfen; echte Pfade und Optionen gegen Code abgleichen. |
| Architektur-/Produktentscheidung | Im Entscheidungsregister Grund, Datum, Freigabe und Grenzen festhalten; betroffene Spezifikation/Modellstellen anpassen. Ungeklärtes bleibt offen. |
| Paketimplementierung und Review | Index auf belegten Status setzen; kurzes Prüfprotokoll mit Stand und Grenzen; betroffene Anleitungen anpassen. |
| Menschliche Abnahme | Nur das freigegebene Paket auf Abgenommen setzen; verbleibende Live-/Geräte-/Datenprüfungen erhalten. |
| Pause oder Übergabe | Datum und Stand als Zwischenbericht festhalten; Index nennt Pause und mögliche, noch nicht beauftragte Fortsetzung. |
| Neue Tabellen nach Einführung des Exports | Datenmodell und Anwendungsexport gezielt mitprüfen; keine Geheimnisse exportieren. |

Bei jeder Änderung im betroffenen Bereich nach überholten Aussagen suchen. Historische Texte sind nicht allein deshalb falsch, weil sich später etwas geändert hat. Kein pauschaler Austausch von Datums- oder Statuswörtern über alle Dateien.

## Aufbau und Sprache

Deutsch, konkrete Überschriften und kurze Absätze. Interne Bezeichner entsprechen dem Code. Jede aktuelle Anleitung nennt Zweck und Grenzen, dann Voraussetzungen und ausführbare Schritte. Kopierbare Kommandos vom Repositorywurzelverzeichnis aus formulieren oder Arbeitsverzeichnis angeben. Platzhalter deutlich benennen. Keine persönlichen `/Users/...`- oder Sitzungs-`/tmp`-Pfade als dauerhafte Voraussetzung; temporäre Beispielpfade als Beispiele kennzeichnen.

Gefährliche oder externe Aktionen von lokalen Prüfungen trennen: Migration echter Daten, Ansible gegen Zielhosts, Repositoryinitialisierung und Restore-Datenpfadwechsel brauchen den jeweiligen Betriebsauftrag. `--check` ist kein Ersatz für eine rein lokale Syntaxprüfung. Rootbefehle nur im passenden Kontext beschreiben. Testdaten und Produktionsdaten nicht vermischen.

Markdownlinks relativ zur Datei verwenden; echte Zielpfade und Anker prüfen. Bei Umbenennungen alle eingehenden Links berücksichtigen. Der Einstieg bleibt klein: Root-README → Dokumentationsübersicht → passende Anleitung. Kein zusätzliches Wikisystem oder Generator ohne begründeten Auftrag.

## Prüfprotokoll und Entscheidung knapp dokumentieren

Prüfprotokoll:

```text
Datum / Paket / geprüfter Commit oder eindeutiger Arbeitsstand:
Umgebung (OS, Architektur, Emulation, relevante Toolversionen):
Prüfung / tatsächlich ausgeführter Befehl → Ergebnis:
Reviewbefunde und gezielte Korrekturen:
Nicht geprüft / verbleibende Grenzen / nächstes Gate:
Freigabe: Verweis auf Aufgabenindex (keine selbst erteilte Abnahme).
```

Entscheidung: Problem → gewählte Lösung → wesentlicher Grund/Alternative → Freigabedatum → verbleibende Grenzen und betroffene Pakete. Quellen mit Abrufdatum; Ableitung und belegte Tatsache unterscheiden. Keine Tokens, Cookies, Vault-Inhalte, echten Importzeilen oder vollständigen personenbezogenen Testausgaben ablegen.

## Abschlussprüfung einer Dokumentationsänderung

1. Aussagen gegen Code, maßgebliche Entscheidungen und Benutzerfreigaben prüfen; keine Abnahmekriterien zum Passendmachen lockern.
2. Lokale Linkziele und verlinkte Abschnittsanker prüfen; neue Dateien mitprüfen, nicht nur den Git-Diff.
3. `git diff --check` und Diff auf unbeabsichtigte Code-/Konfigurationsänderungen prüfen. Vorhandene Benutzeränderungen erhalten.
4. Bei reiner Textpflege keine App-Tests wiederholen oder behaupten. Dokumentationschecks und frühere Codeprüfungen getrennt berichten. Geänderte ausführbare Beispiele bei Bedarf sicher und isoliert validieren; andernfalls als nicht erneut ausgeführt kennzeichnen.
5. Geänderte Dokumente, offene Widersprüche und Git-Stand kurz übergeben. Keine zusätzlichen Freigaberunden für gewöhnliche Textpflege erfinden.
