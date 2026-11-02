# Datenmodell

Dieses Dokument trennt eingeführtes Schema von weiterem Entwurf. `users`, `cards`, `sets`, `variants`, `printings`, `source_printing_observations`, `catalog_sync_status` und `catalog_source_payloads` sind implementiert; die übrigen Tabellen bleiben Vorschläge für spätere ausdrücklich beauftragte Pakete. Paketstatus stehen im [Aufgabenindex](aufgaben/README.md). Fremdschlüssel, positive Mengen und atomare Bestandsänderungen sind verbindliche fachliche Regeln.

## Benutzer und Standorte

| Tabelle | Wesentliche Felder | Bedeutung |
| --- | --- | --- |
| `users` | `id`, `identity_subject`, `display_name`, `active` | Genau zwei freigeschaltete Benutzer; externe Identität eindeutig zugeordnet. |
| `locations` | `id`, `name`, `kind`, `parent_id`, `person_id` | Baum aus Personenstandorten, Boxen, Bindern, Fächern, Decks und Cubes. |
| `loans` | `id`, `physical_deck_id`, `from_location_id`, `borrower_id`, `started_at`, `due_at`, `returned_at`, `note` | Ausleihverlauf physischer Decks. |

Ein Personenstandort ist ein Wurzelknoten mit `person_id`. Alle darunterliegenden Behälter erben den aktuellen Aufenthaltsort daraus. Ein eigener Wurzelknoten „Ungeklärter Standort“ erlaubt ehrliche Importe. Zyklen sind unzulässig. Deck- und Cube-Standorte haben keine untergeordneten Standorte. Nicht leere Standorte werden nicht versehentlich gelöscht; Inhalte müssen vorher verschoben werden.

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

`variants` enthalten ausschließlich belegte Kombinationen. Der aktuelle Schemawert für Edition ist `first`, `unlimited` oder `not_applicable`; unbekannte Editionen bilden keine Variante. Seltenheit und Artwork sind eigene, nicht nullable Merkmale und gehen in die eindeutige Variantenidentität ein. Angriff, Verteidigung und Kartentypen sind noch keine normalisierten Fachspalten und benötigen dafür spätere quellengeprüfte Ergänzung; sofern die Quelle sie liefert, können diese Werte im vollständigen JSON-Payload stehen. Die lokalen JPG-Bilder liegen im separaten Cache, nicht im Katalogschema.

Deutsch und Englisch dürfen auf dasselbe `variant_id` zeigen. Sprache und Druckcode werden ausdrücklich je Druck gespeichert; Sprache wird weder aus Namen abgeleitet noch aus Codes normalisiert. Separate Kartenidentitäten bleiben erhalten, wenn sich die tatsächlichen Karten unterscheiden.

Interne IDs sind unabhängig von externen IDs. Bei `cards`, `sets` und `printings` ist `source_id` nur zusammen mit `source` eindeutig. Die YGOPRODeck-Karten-ID verknüpft deutsche und englische Antworten; eine fehlende deutsche Antwort löscht keine vorhandene Übersetzung. Set-IDs werden aus dem JSON-Tupel von Quell-Setcode und Setname gebildet. Gleiche Setcodes mit verschiedenen Namen bleiben getrennt und werden als Konflikt angezeigt; Namensänderungen werden nicht unscharf zusammengeführt.

YGOPRODecks `card_sets`-Angaben werden als Quellbeobachtungen gespeichert. Sie liefern keine Editionsangabe und verknüpfen Druckcodes nicht mit den separaten Bild-IDs. Daher erzeugt die Synchronisation daraus keine `variants` oder `printings`. Quellbeobachtungen sind keine bestätigten Sammelziele; manuell bestätigte Varianten und Drucke werden durch Quellupdates nicht verändert. Die API-ID ist eine quellengebundene Fremdreferenz ohne Stabilitätsgarantie, und der Import behauptet keine vollständige Druckabdeckung.

## Physische Bestände

| Tabelle | Wesentliche Felder |
| --- | --- |
| `stock` | `id`, `card_id?`, `variant_id?`, `printing_id?`, `language`, `edition`, `location_id`, `quantity`, `resolution_status`, `source_import_row_id?`, `version`, Zeitstempel |
| `activity_log` | `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `details_json`, `request_id`, `created_at` |

Ein Bestandsdatensatz beschreibt eine Menge gleichartiger Karten an einem Ort. `quantity` ist eine positive ganze Zahl. Unbekannte Sprache bleibt `unknown`. Bei aufgelösten Einträgen müssen Karte, Variante und Druck konsistent sein; Druckreferenzen dürfen bei unvollständiger Erfassung fehlen.

`stock.edition` speichert die Editionsangabe des physischen Bestands (`unknown`, `first`, `unlimited`, `not_applicable`), auch ohne aufgelöste Variante. Eine eindeutig gewählte Katalogvariante kann sie vorbelegen; sonst gilt `unknown`. Benutzer dürfen sie manuell ergänzen oder korrigieren. Bei vorhandener Variantenreferenz muss sie mit deren Edition übereinstimmen; eine Korrektur darf keine widersprüchliche Referenz zurücklassen. Katalogupdates überschreiben keine gespeicherte Bestandsedition. Unterschiedliche Editionen bleiben bei Gruppierung und Verschiebung getrennt. Die manuelle Angabe legt keine neue globale Katalogvariante an.

Unaufgelöste Importzeilen behalten ihre Originalbeschreibung in der Importtabelle. Ihre Menge kann physisch verortet sein, auch wenn Karte oder Variante noch unbekannt sind. Nur bestätigte Varianten erfüllen Set-Ziele.

Mehrere gleichartige Datensätze am selben Ort dürfen zur Wahrung der Importherkunft bestehen. Die Oberfläche summiert sie. Es wird keine komplizierte globale Zusammenführung von Herkunftsdaten benötigt.

Die Anwendung prüft `version` beziehungsweise aktuelle Mengen beim Speichern. Bei einer zwischenzeitlichen Änderung wird ein verständlicher Konflikt angezeigt. Änderungen werden in kurzen SQLite-Transaktionen ausgeführt; keine stillen Überschreibungen und keine negativen Mengen.

### Beispiel einer Verschiebung

Ausgang: fünf deutsche Exemplare einer Variante in Box A. Zwei sollen in Deck B.

1. Benutzer, Ausgangsbestand, Ziel und Menge prüfen.
2. Transaktion beginnen und aktuellen Bestand erneut prüfen.
3. Quellmenge auf drei reduzieren; Zielbestand um zwei erhöhen oder anlegen.
4. Einen Verlaufseintrag mit Quelle, Ziel, Menge und Benutzer speichern.
5. Transaktion abschließen.

Bei Fehlern wird alles zurückgerollt. Gesamtmenge bleibt fünf. Bei vollständigem Verschieben wird der bisherige Eintrag verschoben oder kontrolliert zusammengeführt. Ein leeres Restobjekt ist kein Bestand.

### Abgeleitete Werte

- Aktuelle Person: über den Standortbaum ermitteln.
- Person für Sammlungszuordnung: bei Deckinhalt der Deckbesitzer, sonst die aktuelle Person.
- Verfügbarkeit: nach Standort und Behältertyp berechnen. Deck- und Cube-Inhalte gelten standardmäßig als belegt.
- Set-Vervollständigung: Anzahl verschiedener bestätigter `variant_id` im gewählten Sammlungsumfang geteilt durch die Zahl der gültigen Ziele des Sets.

Diese Werte werden zunächst nicht in weiteren Tabellen dupliziert. Ein Behälterwechsel darf keine veralteten persönlichen Summen hinterlassen.

## Decks und Cubes

| Tabelle | Wesentliche Felder | Zweck |
| --- | --- | --- |
| `deck_lists` | `id`, `name`, `format`, `banlist_version_id?`, `notes` | Theoretisches Rezept. |
| `deck_entries` | `deck_list_id`, `card_id`, `section`, `quantity`, `preferred_variant_id?` | Main, Extra und Side; konkrete Druckpräferenz optional. |
| `deck_versions` | `id`, `deck_list_id`, `snapshot_json`, `created_at` | Explizit gespeicherte Rezeptstände. |
| `physical_decks` | `id`, `location_id`, `owner_id`, `deck_list_id?` | Physischer Behälter mit Besitzer. |
| `cube_lists` | `id`, `name`, `notes` | Cube-Rezept. |
| `cube_entries` | `id`, `cube_list_id`, `card_id`, `quantity`, `pool`, `category?`, `preferred_variant_id?` | Normaler Pool oder Extra-Deck-Pool. |
| `cube_versions` | `id`, `cube_list_id`, `snapshot_json`, `created_at` | Gespeicherte Cube-Stände. |
| `physical_cubes` | `id`, `location_id`, `cube_list_id?` | Physischer Cube ohne Besitzerfeld. |

Physische Inhalte ergeben sich ausschließlich aus `stock.location_id`. Es gibt keine zweite Mengenliste, die dieselben physischen Karten nochmals reserviert. Rezept und tatsächliche Zusammenstellung dürfen vorübergehend abweichen; die Oberfläche zeigt den Unterschied.

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
