# Datenmodell

Dieses Dokument trennt eingeführtes Schema von weiterem Entwurf. `users`, `locations`, `cards`, `sets`, `variants`, `printings`, `source_printing_observations`, `catalog_sync_status`, `catalog_source_payloads`, `stock` und `activity_log` sind implementiert; die übrigen Tabellen bleiben Vorschläge für spätere ausdrücklich beauftragte Pakete. Paketstatus stehen im [Aufgabenindex](aufgaben/README.md). Fremdschlüssel, positive Mengen und atomare Bestandsänderungen sind verbindliche fachliche Regeln.

## Benutzer und Standorte

| Tabelle | Wesentliche Felder | Bedeutung |
| --- | --- | --- |
| `users` | `id`, `identity_subject`, `display_name`, `active` | Genau zwei freigeschaltete Benutzer; externe Identität eindeutig zugeordnet. |
| `locations` | `id`, `name`, `kind`, `parent_id` | Frei benannter Ordnerbaum ohne Benutzerzuordnung. `kind` ist ausschließlich intern `folder` oder `unknown`, kein auswählbarer Typ. |

Normale Ordner dürfen auf oberster Ebene (`parent_id = NULL`) oder unter anderen Ordnern liegen und gleichzeitig Karten und weitere Ordner enthalten. Ein einzelner Standardordner für ungeklärte Eingänge wird mit der Schemaeinrichtung automatisch angelegt, falls noch keiner existiert. Bei bestehenden Daten bleiben dessen ID und Name erhalten. Er bleibt ein geschützter Wurzelknoten: umbenennbar, aber nicht verschieb- oder löschbar. Die übrigen Wurzeln besitzen keine Sonderrolle.

`person_id`, der Typ `person` und daraus abgeleitete Personenfelder entfallen nach D11. Benutzer sind ausschließlich Zugangsidentitäten; Namen wie „Rico“ und „Remo“ sind gewöhnliche Ordnernamen. Auswertungsbereiche ergeben sich aus einem ausdrücklich gewählten Ordner samt Unterordnern oder dem Gesamtbestand. Die frühere automatische Sammlungszuordnung über Benutzerwurzeln ist aufgehoben.

Fremdschlüssel, Namensprüfung, eindeutiger Standardordner und dessen Wurzelform werden durch SQLite erzwungen. Standortfunktionen validieren Eltern, Zyklen und geschützten Standardordner in unmittelbaren Transaktionen. Nicht leere Ordner werden nicht gelöscht. Verschieben nach `NULL` bedeutet oberste Ebene; beim Löschen wird der tatsächliche Parent serverseitig ermittelt. Rezepte für Decks/Cubes sind keine Standorte.

Vorwärtsmigration `0007_unowned_location_folders` entfernt die Benutzerbindung und überführt bisherige Personenstandorte bei gleichen IDs, Namen und Elternbeziehungen in normale Ordner. Vorhandene Bestands-/Verlaufsdaten bleiben erhalten. Standort- und Bestandstabelle werden wegen ihrer SQLite-Fremdschlüsselabhängigkeit innerhalb derselben Migration über temporäre Kopien neu aufgebaut, ohne Fremdschlüssel auszuschalten; Fehler rollen einschließlich Migrationsjournal zurück. Die unveränderte Migration 0006 vereinheitlicht davor die früheren Box-/Binder-/Fach-Typen. Es bleiben keine temporären Tabellen im Schema.

## Katalog und Sammelziele

| Tabelle | Implementierte wesentliche Felder | Bedeutung |
| --- | --- | --- |
| `cards` | `id`, `name_de?`, `name_en?`, `effect_de?`, `effect_en?`, `source?`, `source_id?` | Gameplay-Identität unabhängig vom Druck; mindestens ein nichtleerer Name ist nötig. Fremd-IDs sind nur mit Quelle gesetzt und quellengebunden eindeutig. |
| `sets` | `id`, `name`, `code`, `catalog_status`, `source?`, `source_id?` | Set; Status ist `unreviewed`, `partial` oder `complete`. Neue API-Sets beginnen bei `partial`; Fremd-IDs sind quellengebunden. |
| `variants` | `id`, `card_id`, `set_id`, `collector_number`, `edition`, `rarity`, `artwork_key` | Sprachunabhängiges, ausdrücklich belegtes Ziel für Set-Vervollständigung. |
| `printings` | `id`, `variant_id`, `language`, `printed_code`, `source`, `source_id` | Konkreter Katalogdruck mit expliziter Sprach- und Quellenzuordnung. |
| `source_printing_observations` | `id`, `card_id`, `source`, `card_source_id`, `set_name`, `printed_code`, `rarity`, `rarity_code?` | Unbestätigte Druckangaben aus einer Quelle; keine bestätigte Set-, Sprach-, Editions- oder Artworkzuordnung. |
| `catalog_sync_status` | `source`, Versuch/Erfolg, Quellversion/-datum, Status, Fehlercode, Konfliktanzahl/-kurzliste | Ergebnis des letzten manuellen Quellimports. Fehlversuche erhalten den letzten erfolgreichen Stand. |
| `catalog_source_payloads` | `source`, `resource`, `payload_json`, `fetched_at`, `database_version` | Je Quelle die letzte erfolgreiche vollständige JSON-Antwort für `cards_en`, `cards_de`, `sets` und `version`; kein Verlauf und kein Einzelkartenindex. |

Der manuelle YGOPRODeck-Import speichert diese vier vollständigen geparsten Antworten zusätzlich zu den normalisierten Katalogfeldern. Unbekannte Felder und Einträge ohne englische Zuordnung bleiben darin erhalten. `misc=yes` wird für die beiden Kartenabfragen angefordert; weitere formatabhängige Sonderantworten werden nicht zusätzlich abgerufen. Die aktuelle Suche und Oberfläche verwenden weiterhin nur die normalisierten Spalten. `fetched_at` ist der vorhandene `attemptedAt`-Zeitpunkt zu Beginn des Imports. Payloads, normalisierte Projektionen und Erfolgsstatus werden gemeinsam in einer SQLite-Transaktion ersetzt; ein fehlgeschlagener Import bewahrt den vorherigen Payload- und Katalogstand. Die normale Datenbanksicherung umfasst die Payload-Tabelle.

`variants` enthalten ausschließlich belegte Kombinationen. Der aktuelle Schemawert für Edition ist `first`, `unlimited`, `limited` oder `not_applicable`; unbekannte Editionen bilden keine Variante. Seltenheit und Artwork sind eigene, nicht nullable Merkmale und gehen in die eindeutige Variantenidentität ein. Angriff, Verteidigung und Kartentypen sind noch keine normalisierten Fachspalten und benötigen dafür spätere quellengeprüfte Ergänzung; sofern die Quelle sie liefert, können diese Werte im vollständigen JSON-Payload stehen. Die lokalen JPG-Bilder liegen im separaten Cache, nicht im Katalogschema.

Deutsch und Englisch dürfen auf dasselbe `variant_id` zeigen. Sprache und Druckcode werden ausdrücklich je Druck gespeichert; Sprache wird weder aus Namen abgeleitet noch aus Codes normalisiert. Separate Kartenidentitäten bleiben erhalten, wenn sich die tatsächlichen Karten unterscheiden.

Interne IDs sind unabhängig von externen IDs. Bei `cards`, `sets` und `printings` ist `source_id` nur zusammen mit `source` eindeutig. Die YGOPRODeck-Karten-ID verknüpft deutsche und englische Antworten; eine fehlende deutsche Antwort löscht keine vorhandene Übersetzung. Set-IDs werden aus dem JSON-Tupel von Quell-Setcode und Setname gebildet. Gleiche Setcodes mit verschiedenen Namen bleiben getrennt und werden als Konflikt angezeigt; Namensänderungen werden nicht unscharf zusammengeführt.

YGOPRODecks `card_sets`-Angaben werden als Quellbeobachtungen gespeichert. Sie liefern keine Editionsangabe und verknüpfen Druckcodes nicht mit den separaten Bild-IDs. Daher erzeugt die Synchronisation daraus keine `variants` oder `printings`. Quellbeobachtungen sind keine bestätigten Sammelziele; manuell bestätigte Varianten und Drucke werden durch Quellupdates nicht verändert. Die API-ID ist eine quellengebundene Fremdreferenz ohne Stabilitätsgarantie, und der Import behauptet keine vollständige Druckabdeckung.

## Physische Bestände

| Tabelle | Wesentliche Felder |
| --- | --- |
| `stock` | `id`, `card_id`, `variant_id?`, `printing_id?`, `source_observation_id?`, `language`, `edition`, `location_id`, `quantity`, `version`, Zeitstempel |
| `activity_log` | `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `details_json`, `request_id`, `created_at` |

Ein Bestandsdatensatz beschreibt eine Menge gleichartiger Karten an einem Ort. `card_id` ist für die manuelle Erfassung erforderlich; `quantity` und `version` sind positive sichere Ganzzahlen. Sprache ist `unknown`, `de` oder `en`. Eine bestätigte Variante muss zur Karte und Edition passen; ein Druck muss zusätzlich zur Variante und Sprache passen. Eine unbestätigte Quellenbeobachtung muss zur Karte gehören und kann keine bestätigte Variante oder Druckreferenz ersetzen.

Die zusätzliche Edition `limited` / „Limited Edition“ wurde am 3. November 2026 aufgrund der Echtdatei ausdrücklich beschlossen und in P2-08 für Schema, Validierung, Anzeige und Variantenbezug ergänzt. `not_applicable` bleibt ein eigener Wert. Vorwärtsmigration `0009_limited_edition` erweitert die Editions-Constraints bei erhaltenen Datensätzen, Referenzen und Indizes; sie erstellt weder bestätigte Varianten aus unklaren Quelldaten noch deutet sie vorhandene Editionen um.

`stock.edition` speichert die Editionsangabe des physischen Bestands (`unknown`, `first`, `unlimited`, `limited`, `not_applicable`), auch ohne aufgelöste Variante. Eine eindeutig gewählte Katalogvariante kann sie vorbelegen; sonst gilt `unknown`. Benutzer dürfen sie manuell ergänzen oder korrigieren. Bei vorhandener Variantenreferenz muss sie mit deren Edition übereinstimmen; eine Korrektur darf keine widersprüchliche Referenz zurücklassen. Katalogupdates überschreiben keine gespeicherte Bestandsedition. Unterschiedliche Editionen bleiben getrennt. Bestätigte Zeilen derselben Variante, Edition und desselben Standorts werden unabhängig von Druckreferenz und Sprache zusammengezählt und mit Sprachaufteilung gezeigt. Unbestätigte Beobachtungen werden je Beobachtung getrennt; manuelle Zeilen ohne Variante/Beobachtung gruppieren je Karte, Edition und Standort. Die manuelle Angabe legt keine neue globale Katalogvariante an.

Unaufgelöste Importzeilen behalten ihre Originalbeschreibung in der Importtabelle. Ihre Menge kann physisch verortet sein, auch wenn Karte oder Variante noch unbekannt sind. Nur bestätigte Varianten erfüllen Set-Ziele.

Mehrere gleichartige Datensätze am selben Ort bleiben für versionsgeprüfte Korrekturen einzeln erhalten; die Oberfläche fasst sie nur zur Anzeige zusammen. Ein Korrekturvorgang darf Menge, Sprache, Edition und Referenz für dieselbe Karte am selben Ort ändern. Karte und Standort bleiben bei Korrekturen unverändert. Die separate Verschiebungsfunktion prüft Quellversion, Ziel und verfügbare Menge innerhalb derselben unmittelbaren Transaktion. Jeder Vorgang speichert Akteur, Request-ID, Zeit und verständliche Vorher-/Nachher-Werte im selben unmittelbaren SQLite-Commit. Ein fehlgeschriebener Verlauf rollt die Bestandsänderung zurück. Nullmengen werden abgewiesen; ein leerer Bestandsdatensatz wird nicht gespeichert.

Die Anwendung prüft `version` beziehungsweise aktuelle Mengen beim Speichern. Bei einer zwischenzeitlichen Änderung wird ein verständlicher Konflikt angezeigt. Änderungen werden in kurzen SQLite-Transaktionen ausgeführt; keine stillen Überschreibungen und keine negativen Mengen.

### Beispiel einer Verschiebung

Ausgang: fünf deutsche Exemplare einer Variante in Box A. Zwei sollen in Box B.

1. Benutzer, Ausgangsbestand, Ziel und Menge prüfen.
2. Transaktion beginnen und aktuellen Bestand erneut prüfen.
3. Quellmenge auf drei reduzieren und ihre Version erhöhen; einen eigenen Zielbestand mit zwei Exemplaren und Version 1 anlegen. Karte, Sprache, Edition und Druckreferenzen unverändert aus der Quelle übernehmen. Bestehende Zielzeilen bleiben getrennt; die Anzeige gruppiert sie wie bisher.
4. Zwei `stock.moved`-Verlaufseinträge für Quelle und neue Zielzeile mit identischer Request-ID, Akteur und Zeit speichern. Vorher/Nachher sowie gemeinsame Bewegungsmetadaten enthalten Quell-/Zielbestands-ID, Quell-/Zielstandort und Menge.
5. Transaktion abschließen.

Bei Fehlern wird alles zurückgerollt. Gesamtmenge bleibt fünf. Bei vollständigem Verschieben behält die Zeile ihre ID und Menge, wechselt den Standort und erhöht ihre Version; ein vollständiger Vorher-/Nachher-Verlaufseintrag dokumentiert beide Standorte. Ein leeres Restobjekt ist kein Bestand. `moveStocks` verarbeitet mehrere eindeutige Quellbestände mit ihren jeweiligen Mengen und erwarteten Versionen in derselben unmittelbaren Transaktion. Ein gemeinsames Ziel, Akteur, Request-ID und Zeitstempel verbinden die Bewegungen; jeder Fehler rollt die gesamte Auswahl zurück. Der Einzelaufruf delegiert mit genau einer Position an dieselbe Funktion. Die Vorwärtsmigration `0008_stock_movements` erweitert ausschließlich den erlaubten Audit-Aktionstyp um `stock.moved`; vorhandene Verlaufseinträge und Fremdschlüssel bleiben erhalten.

### Abgeleitete Werte

- Sammlungsbereich: ausgewählter Ordner samt allen Unterordnern oder der gesamte Bestand; keine automatische Benutzer-/Personenzuordnung.
- Deck-/Cube-Verfügbarkeit: Bestand je Kartenidentität am gewählten Standort einschließlich Unterstandorten mit dem Bedarf aller Listenbereiche vergleichen. Fehlmenge = max(0, Bedarf − Bestand). Andere Rezepte binden keine Mengen.
- Set-Vervollständigung: Anzahl verschiedener bestätigter `variant_id` im gewählten Sammlungsumfang geteilt durch die Zahl der gültigen Ziele des Sets.

Diese Werte werden zunächst nicht in weiteren Tabellen dupliziert. Ein Ordnerwechsel muss beim erneuten Abruf in den betreffenden Bereichssummen berücksichtigt werden.

## Decks und Cubes

| Tabelle | Wesentliche Felder | Zweck |
| --- | --- | --- |
| `deck_lists` | `id`, `name`, `format`, `banlist_version_id?`, `notes` | Theoretisches Rezept. |
| `deck_entries` | `deck_list_id`, `card_id`, `section`, `quantity`, `preferred_variant_id?` | Main, Extra und Side; konkrete Druckpräferenz optional. |
| `deck_versions` | `id`, `deck_list_id`, `snapshot_json`, `created_at` | Explizit gespeicherte Rezeptstände. |
| `cube_lists` | `id`, `name`, `notes` | Cube-Rezept. |
| `cube_entries` | `id`, `cube_list_id`, `card_id`, `quantity`, `pool`, `category?`, `preferred_variant_id?` | Normaler Pool oder Extra-Deck-Pool. |
| `cube_versions` | `id`, `cube_list_id`, `snapshot_json`, `created_at` | Gespeicherte Cube-Stände. |

Decks und Cubes speichern keine Standort-, Besitzer- oder Bestandsreferenzen. Der gewählte Standort ist nur ein Abfrageumfang für die Anzeige: benötigt, vorhanden, fehlend = max(0, benötigt − vorhanden); vollständig genau dann, wenn jede Fehlmenge null ist. Innerhalb einer Liste werden Mengen je Kartenidentität über alle Bereiche summiert. Physischer Bestand ergibt sich ausschließlich aus `stock.location_id`. Änderungen und Versionen von Rezepten bewegen oder reservieren nichts. Die früher geplanten Tabellen für physische Decks/Cubes und Deckausleihe entfallen nach D07.

## Formate und Bannlisten

| Tabelle | Wesentliche Felder |
| --- | --- |
| `banlists` | `id`, `name`, `source`, `format` |
| `banlist_versions` | `id`, `banlist_id`, `effective_at?`, `created_at` |
| `banlist_entries` | `banlist_version_id`, `card_id`, `allowed_count` |

Ein Deck referenziert eine konkrete Bannlistenversion. Eine Änderung erzeugt eine neue Version und verändert ältere gespeicherte Deckbewertungen nicht unbemerkt. Nicht aufgeführte Karten folgen dem gewählten Formatdefault. Formate werden zunächst als wenige explizite TypeScript-Regelsätze umgesetzt. Karten mit besonderen Zählregeln werden nur entsprechend tatsächlich benötigter Formatregeln ergänzt.

## Draft und Testfeld

| Tabelle | Wesentliche Felder |
| --- | --- |
| `draft_presets` | `id`, `name`, `mode`, `settings_json` |
| `draft_sessions` | `id`, `cube_snapshot_json`, `settings_json`, `seed`, `status`, `state_json`, `created_by` |

Für lokale Sitzungen reichen strukturierte, validierte JSON-Snapshots. `state_json` enthält Packs beziehungsweise Auslagen, Spielerpools, Picks und den aktuellen Schritt. Jede gezogene Cube-Kopie bekommt innerhalb der Sitzung eine eindeutige ID. Das ist keine physische Inventar-ID.

Der Draft-Reducer ist eine normale TypeScript-Funktion: Zustand und Aktion hinein, neuer Zustand hinaus. Er prüft gültige Picks und Mengen. Nach Aktionen wird der aktuelle Stand gespeichert; keine verteilte Echtzeitsynchronisierung. Undo im Testmodus nutzt eine begrenzte lokale Zustandshistorie, kein allgemeines Event-Sourcing.

Das manuelle Testfeld verwendet ebenfalls temporären Zustand einer Deckkopie. Eine dauerhafte Speicherung von Duellzuständen ist zunächst nicht erforderlich.

## Importe und optionale Preise

| Tabelle | Wesentliche Felder |
| --- | --- |
| `import_batches` | `id`, `file_key`, `file_hash`, `status`, `created_by`, `created_at`, `summary_json` |
| `import_rows` | `id`, `batch_id`, `row_number`, `raw_json`, `portfolio`, `quantity?`, `match_status`, `error?` |
| `price_quotes` | `id`, `card_id?`, `variant_id?`, `source`, `source_product_id?`, `amount`, `currency`, `as_of`, `match_quality` |

Preisdatensätze werden erst bei Umsetzung der optionalen Integration eingeführt. Importrohdaten sind für Nacharbeit und Mengenabgleich verfügbar, erscheinen aber nicht in technischen Logs. Unbekannte Preise haben keinen Nullwert als Ersatz.
