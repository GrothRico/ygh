# Datenmodell

Dies ist ein logischer Schemaentwurf für SQLite und Drizzle. Feldnamen sind Vorschläge für die Implementierung. Tabellen werden mit dem jeweiligen Meilenstein eingeführt, nicht vollständig vorab gebaut. Fremdschlüssel, positive Mengen und atomare Bestandsänderungen sichern die wesentlichen Regeln.

## Benutzer und Standorte

| Tabelle | Wesentliche Felder | Bedeutung |
| --- | --- | --- |
| `users` | `id`, `identity_subject`, `display_name`, `active` | Genau zwei freigeschaltete Benutzer; externe Identität eindeutig zugeordnet. |
| `locations` | `id`, `name`, `kind`, `parent_id`, `person_id` | Baum aus Personenstandorten, Boxen, Bindern, Fächern, Decks und Cubes. |
| `loans` | `id`, `physical_deck_id`, `from_location_id`, `borrower_id`, `started_at`, `due_at`, `returned_at`, `note` | Ausleihverlauf physischer Decks. |

Ein Personenstandort ist ein Wurzelknoten mit `person_id`. Alle darunterliegenden Behälter erben den aktuellen Aufenthaltsort daraus. Ein eigener Wurzelknoten „Ungeklärter Standort“ erlaubt ehrliche Importe. Zyklen sind unzulässig. Deck- und Cube-Standorte haben keine untergeordneten Standorte. Nicht leere Standorte werden nicht versehentlich gelöscht; Inhalte müssen vorher verschoben werden.

## Katalog und Sammelziele

| Tabelle | Wesentliche Felder | Bedeutung |
| --- | --- | --- |
| `cards` | `id`, `name_de`, `name_en`, Spielwerte, Effekttexte, `image_key` | Gameplay-Identität unabhängig vom Druck. |
| `sets` | `id`, `name`, `code`, `catalog_status` | Set und Prüfstatus seines Variantenkatalogs. |
| `variants` | `id`, `card_id`, `set_id`, `collector_number`, `edition`, `rarity`, `artwork_key`, `version_note` | Sprachunabhängiges Ziel für Set-Vervollständigung. |
| `printings` | `id`, `variant_id`, `language`, `printed_code`, `source`, `source_id` | Konkreter Katalogdruck mit Sprachcode und externer Referenz. |

`variants` enthalten ausschließlich belegte Kombinationen. Edition ist beispielsweise `first`, `unlimited` oder `not_applicable`. Unbekannte Daten erzeugen nicht automatisch ein verifiziertes Sammelziel. Seltenheit und Artwork können aus einer eindeutigen Auswahl folgen, ohne in der Eingabe zusätzlich abgefragt zu werden.

Deutsch und Englisch dürfen auf dasselbe `variant_id` zeigen. Codes werden nicht durch blindes Entfernen von Sprachkürzeln vereinheitlicht; die Zuordnung muss anhand des Katalogs erfolgen. Separate Kartenidentitäten bleiben erhalten, wenn sich die tatsächlichen Karten unterscheiden.

Externe IDs werden nicht zu internen Primärschlüsseln. Dadurch können Katalogquellen ergänzt und falsche Zuordnungen korrigiert werden. Sprachvarianten von Namen sind Suchbegriffe derselben Karte.

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
