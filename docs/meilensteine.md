# Meilensteine und Abnahme

Die Umsetzung erfolgt in vertikalen Schritten: Jeder Schritt liefert einen nachvollziehbaren, benutzbaren Teil. Sicherheitsgrundlagen und Backups werden vor der produktiven Sammlungserfassung eingerichtet. Es gibt noch keine belastbare Zeitschätzung; besonders Katalogabdeckung und Collectr-Migration müssen zuerst untersucht werden.

Für die Ausführung durch ein günstiges Modell gelten die kleineren [Arbeitspakete](aufgaben/README.md). Ein ganzer Meilenstein wird nicht auf einmal beauftragt. Vorbereitung, Implementierung und produktive Ausführung sind getrennte Aufträge. Der [Arbeitsablauf](arbeit-mit-llm.md) beschreibt Reviews und Freigaben.

## M0 Datenquellen und Betrieb prüfen

**Ergebnis:** Dokumentierte technische Entscheidungen. Ein tatsächlicher Infrastrukturversuch erfolgt erst mit P1-14 nach ausdrücklichem Betriebsauftrag, ohne private Sammlungsdaten.

- Yu-Gi-Oh!-Katalog an repräsentativen Fällen prüfen: deutsche/englische Drucke, 1st/Unlimited, mehrere Seltenheiten, mehrere Artworks, ältere Sets.
- Geeignete Quellen für Varianten und Sprachzuordnung auswählen. Fehlende Daten müssen sichtbar bleiben können.
- Collectr-Adapter anhand öffentlich belegter Felder definieren; synthetische Testdateien ausdrücklich als synthetisch kennzeichnen.
- VPS und externen Backupspeicher inklusive Steuern gegen das Ziel von ungefähr 5 € pro Monat prüfen. Keine kostenpflichtigen Ressourcen ohne konkrete Kostenentscheidung bestellen.
- Tailscale, HTTPS, Authentifizierungsbibliothek und Identitätszuordnung festlegen. Zentral verfügbare Auditereignisse im tatsächlichen Tarif prüfen.
- Entscheiden, ob Caddy benötigt wird oder Tailscale Serve den privaten HTTPS-Zugang bereits ausreichend abdeckt.
- Benachrichtigungskanal und unabhängige Ausfallprüfung auswählen.

**Abnahme:** Kostenübersicht mit offenen Posten; nachvollziehbare Variantenbeispiele; dokumentierte Importgrenzen; Zugriffskonzept ohne öffentlichen Bypass. Fehlende vollständige Katalogdaten blockieren keine reine Bestandsverwaltung, müssen aber eine bestätigte Vollständigkeitsquote verhindern.

## M1 Projektgrundlage und sicherer Betrieb

**Ergebnis:** Kleine deutsche Anwendung mit Anmeldung und reproduzierbarem Deployment.

- Next.js, TypeScript, Drizzle/SQLite und Lockfile einrichten.
- Docker-Entwicklung mit Hot Reload und Produktionsimage bereitstellen.
- Ansible für VPS-Einrichtung, Tailscale, Firewall, Deployment, Logrotation und Backups.
- Zwei freigeschaltete Identitäten, keine Registrierung, Authentifizierung und Autorisierung aller geschützten Routen.
- JSON-Logs mit Request-ID, bereinigten Fehlern und Grenzen für Aufbewahrung und Größe.
- Tägliche Sicherung, externer verschlüsselter Speicher und dokumentierter Restore.
- PWA-Grundlage, deutsche Oberfläche und mobile Navigation.

**Abnahme:** Start aus frischem Checkout dokumentiert; Setup und Deployment wiederholbar; Daten bleiben bei Neustart und Update erhalten. Zugriff von freigegebenem iPhone, Android und Desktop funktioniert. Nicht freigegebene Benutzer/Geräte und öffentliche Zugriffe scheitern. Anwendung lässt sich nicht über einen direkten Docker-Port umgehen. Wiederherstellung auf leerer Testinstanz funktioniert. Keine Geheimnisse in Repository oder Logs.

## M2 Katalog und physischer Bestand

**Ergebnis:** Karten suchen, erfassen, finden und zwischen Standorten bewegen.

- Katalogimport und Bildspeicherung mit nachvollziehbaren Quellen.
- Suche nach deutschem/englischem Namen und Set-Code.
- Variantenwahl und Mengen mit bekannter oder unbekannter Sprache.
- Personenstandorte, Boxen, Binder, Fächer und unsortierter Eingang.
- Bild- und Listenansichten, Detailverteilung und gemeinsamer Bestand.
- Mengenverschiebungen und Änderungsverlauf.

**Abnahme:** Zwei aus fünf Exemplaren verschieben ergibt drei plus zwei. Gleichzeitige konkurrierende Verschiebungen erzeugen weder negative Mengen noch Duplikate. Verschieben eines Behälters ändert den angezeigten aktuellen Standort seiner Inhalte. Suche und Ansichten bleiben mit ungefähr 15.000 Exemplaren auf beiden Smartphones benutzbar; nicht alle Bilder werden gleichzeitig geladen.

## M3 Collectr-Import und Set-Vervollständigung

**Ergebnis:** Bestehende Sammlung übernehmen und Variantenlücken erkennen.

- CSV-Vorschau, Portfoliomapping, eindeutiges Matching und Review ungeklärter Zeilen.
- Originaldateien und Zeilen erhalten, Mengensummen je Portfolio abgleichen.
- Watchlist-Einträge von physischen Beständen trennen.
- Wiederholte Dateiübernahme erkennen und sichere Importkorrektur ermöglichen.
- Set-Ansichten für beide Personen und gemeinsam; alle Varianten, sprachunabhängige Erfüllung.

**Abnahme:** Originalmenge entspricht übernommenen plus ausdrücklich ausgeschlossenen beziehungsweise noch nicht übernommenen Mengen. Umgeordnete Spalten und deutsche Sonderzeichen werden verarbeitet. Fehlende Sprache/Edition werden nicht geraten. Deutsch und Englisch derselben Variante erfüllen ein Ziel. Andere Editionen oder Artworks bleiben getrennt. Ungeprüfte Setkataloge zeigen vorläufige Quoten.

**Reale Migration:** Ohne tatsächliche Collectr-Datei ist der Adapter vorbereitet, aber nicht an der Sammlung validiert. Vor dem endgültigen Umzug wird eine echte Datei zunächst als Vorschau verarbeitet; keine Behauptung eines verlustfreien Imports allein aufgrund synthetischer Tests.

## M4 Deckbau und Deckausleihe

**Ergebnis:** Theoretische und physische Decks mit verlässlicher Verfügbarkeitsanzeige.

- Main/Extra/Side, Filter, Tap-Steuerung und Desktop-Drag-and-drop.
- Aktuelles TCG, freier Modus und eigene versionierte Bannlisten.
- Speichern, Kopieren, einfache Versionen sowie ein dokumentiertes Import-/Exportformat.
- Pickliste, physisches Zusammenstellen und Rezeptänderungen mit bestätigten Umbuchungen.
- Deckbesitzer, Ausleihe, Rückgabe und Standortanzeige.

**Abnahme:** Zwei Entwürfe dürfen dieselben Karten benötigen; zwei physische Decks dürfen dieselben Exemplare nicht enthalten. Gebundene Karten bleiben sichtbar, aber nicht frei. Bannlisten zählen über alle Deckbereiche gemeinsam. Ein ausgeliehenes Deck zählt weiterhin zur Sammlung des Besitzers, erscheint physisch beim Entleiher und wird gemeinsam nur einmal gezählt. Beim dauerhaften Entfernen einer Karte aus dem Deck gilt der neue Standort.

## M5 Cubes und lokale Drafts

**Ergebnis:** Cube-Entwurf, physischer Cube und nutzbarer Zweispieler-Draft.

- Cube-Editor mit Mengen, normalen/Extra-Deck-Pools und Verfügbarkeitsanzeige.
- Physische Zusammenstellung; Sammlungszuordnung nach aktuellem Standort.
- Pack-Draft mit 15er-Vorgabe, konfigurierbaren Runden und anschließenden Extra-Deck-Packs.
- Gespeicherte Vorlagen, Seeds, Pick-Verlauf und Fortsetzen lokaler Sitzungen.
- Manuelle Plätze, einfacher simulierter Picker und Übergabeansicht.
- Anschließend Grid-Draft und Sealed als getrennte, überschaubare Verfahren.
- Deckbau aus dem gedrafteten Pool mit passenden Cube-Regeln.

**Abnahme:** Jeder Sitzungseintrag liegt zu jedem Zeitpunkt in genau einem Pack, Pool oder Restbestand. Es entstehen keine zusätzlichen Exemplare. Zu kleiner Cube wird vor Start erkannt. Derselbe Seed und dieselben Aktionen ergeben dasselbe Ergebnis. Extra-Deck-Packs werden erst in ihrer Phase verwendet. Draften verändert keine physischen Bestände. Beide Menschen können auf einem Gerät ohne dauerhafte Anzeige der verdeckten Gegenseite draften.

## M6 Manuelles Testfeld

**Ergebnis:** Gemeinsames Solo-Testwerkzeug für normale und gedraftete Decks.

- Ziehen, mischen, suchen, zurücksetzen, Zonenwechsel, verdecken/drehen.
- Lebenspunkte, Tokens, Zähler und Undo.
- Benutzbare Touch-Steuerung und Desktop-Bedienung.

**Abnahme:** Bewegungen erhalten die Kartenmenge der Testsitzung; Reset stellt den Ausgangszustand her. Kein Test ändert Bestand oder gespeichertes Rezept. Ein vollständiger Ablauf Cube → Draft → Deckbau → Testfeld funktioniert.

## M7 Optionale Preise und Betrieb abrunden

- Cardmarket-Produktzuordnung und Preisdateien prüfen und bei ausreichender Zuverlässigkeit integrieren.
- Exakte und ungefähre Preise unterscheiden; Quelle, Währung und Datenstand anzeigen.
- Kategoriegestützte Pack-Erzeugung nur bei Bedarf ergänzen.
- Dokumentation und reale Betriebswerte prüfen: Speicherverbrauch, Backups, Loggrößen und Kosten.

**Abnahme:** Fehlende oder ausgefallene Preisversorgung beeinträchtigt Sammlung und Deckbau nicht. Unbekannte Preise bleiben unbekannt. Der Benutzer kann anhand der Dokumentation einen Fehler über Request-ID finden, aktualisieren und auf einer frischen Instanz wiederherstellen.

## Prüfstrategie

Gezielte Unit- und Integrationstests für Mengenerhaltung, Transaktionen, Sammlungszuordnung, Importabgleich, Bannlisten und Draft-Verteilung. Wenige Ende-zu-Ende-Tests für Anmeldung, Erfassen, Verschieben, Deckausleihe und Draftabschluss. Sicherheitsprüfungen für unautorisierte Routen, Identitätsspoofing bei Proxyintegration, Uploadgrenzen und öffentliche Erreichbarkeit. Praktische Prüfung auf iPhone, Android und Desktop.

Keine Tests, die nur die Implementierung nachschreiben. Keine umfangreichen Lasttests für unrealistische Nutzerzahlen. Ein repräsentativer 15.000-Karten-Datensatz prüft die tatsächlichen Ansichten und Suchabläufe.

## Noch offene Entscheidungen

| Punkt | Wann klären | Zuständigkeit |
| --- | --- | --- |
| VPS, Backupziel und tatsächliche Gesamtkosten | M0, vor Bestellung | Technischer Vorschlag, Kostenentscheidung durch Benutzer |
| Katalog und genaue Variantenabdeckung | M0 | Technische Untersuchung |
| Authentifizierung und privates HTTPS | M0 | Technischer Vorschlag mit geprüftem Zugriffsweg |
| Alarmkanal und externe Erreichbarkeitsprüfung | M0/M1 | Technischer Vorschlag, Zieladresse vom Benutzer |
| Reale Collectr-Kodierung | Sobald Export verfügbar, vor Migration | Technische Validierung |
| Konkrete Grid-Draft-Regeln und Default-Packzahlen | Vor M5 | Einfachen Vorschlag anhand Zweispielernutzung festlegen |
| Cardmarket-Matching | M7 | Technische Untersuchung; Funktion optional |

Grundlegende Produktentscheidungen müssen dafür nicht erneut abgefragt werden. Technische Details werden innerhalb der vereinbarten Architektur gelöst und bei relevanten Abweichungen dokumentiert.
