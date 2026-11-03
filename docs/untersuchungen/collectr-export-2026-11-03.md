# Collectr-Echtdatei: Analyse vom 3. November 2026

Lesende Analyse der vom Benutzer bereitgestellten lokalen `export.csv`, keine Migration. Die Datei bleibt außerhalb des Repositories. Keine Originalzeilen oder vollständigen Importdaten sind Bestandteil dieses Berichts. Die frühere [Recherche](collectr.md) bleibt historischer Quellenstand; aktuelle Planung und Freigaben stehen in [E02](../entscheidungen.md#e02--collectr-csv-vertrag) und im [Aufgabenindex](../aufgaben/README.md).

## Datei und Mengenabgleich

855.069 Bytes, UTF-8 ohne BOM, Komma als Trennzeichen, LF-Zeilenenden. Standard-CSV-Quotes funktionieren einschließlich Kommas und Anführungszeichen in Kartennamen. 6.107 Datenzeilen mit jeweils 16 Feldern; keine abweichenden Zeilenbreiten. SHA-256: `9d1220ae70ecdf27bfe0e6e181c191471343708e81a57dfdad9e59ebc6363ce4`.

| Umfang | Zeilen | Menge |
| --- | ---: | ---: |
| `Watchlist=false` | 6.098 | 10.104 |
| Davon einzelne Karten als Importkandidaten | 6.092 | 10.095 |
| Davon komplette Decks/Box-Sets als Produkte | 6 | 9 |
| `Watchlist=true` | 9 | 7 bekannte Mengeneinheiten; 2 Zeilen ohne Menge |

Die beiden leeren Mengen sind ausschließlich Watchlist-Zeilen ohne Portfolio. Es gibt keine fehlende oder nichtpositive Menge in den Bestandszeilen; positive Mengen reichen von 1 bis 21. Watchlist bleibt vollständig außerhalb des physischen Kartenbestands. Ihre fehlende Menge wird nicht als null oder eins erfunden. Die sechs Produkte sind anhand ihrer Produktbezeichnungen als komplette Decks/Box-Sets erkennbar, haben keinen Card Number-/Rarity-Wert und `Variance=Normal`. Sie werden separat ausgewiesen; keine automatische Aufteilung auf Karten und kein neuer Produkttyp als Nebenfeature.

| Portfolio | Bestandszeilen | Erfasste Bestandsmenge (vor Produktausschluss) | Watchlist-Zeilen | Vorgesehener Standort |
| --- | ---: | ---: | ---: | --- |
| Remo | 508 | 581 | 0 | Bei Remo (Bruder), durch Benutzer bestätigt |
| Trade-Ordner 1 | 174 | 250 | 0 | Binder bei Rico, durch Benutzer bestätigt |
| Yu-Gi-Oh | 5.416 | 9.273 | 7 | Vorläufig bei Rico; im Importpreview ausdrücklich bestätigen |
| Kein Portfolio | 0 | 0 | 2 | Nur Watchlist, keine Standortzuordnung nötig |

Keine exakt identischen vollständigen Zeilen. Drei Gruppen besitzen gleiche Portfolio-/Name-/Code-/Rarity-/Variance-Kombination, aber unterschiedliche weitere Werte. Nicht automatisch deduplizieren. Die Mengen sind Dateisummen, kein Nachweis, dass die rund 15.000 realen Karten vollständig katalogisiert wurden.

## Beobachtetes Headerprofil

Exakte Reihenfolge in dieser Datei:

```text
Portfolio Name,Category,Set,Product Name,Card Number,Rarity,Variance,Grade,Card Condition,Average Cost Paid,Quantity,Market Price (As of 2026-11-03),Price Override,Watchlist,Date Added,Notes
```

- `Category`: in allen Zeilen `YuGiOh`; die Kategorie umfasst auch komplette Deckprodukte.
- `Watchlist`: tatsächlich `true` oder `false` in Kleinbuchstaben. Andere Werte bleiben in einem künftigen Adapter ungeklärt, statt still als falsch zu gelten.
- `Variance`: `1st Edition` (4.287 Bestandszeilen / 7.005 Exemplare), `Unlimited` (1.641 / 2.896), `Limited` (171 / 194), `Normal` (6 Produktzeilen / 9 Einheiten); zwei leere Werte nur in Watchlist. Diese Werte sind Quelldaten, kein unabhängiger Drucknachweis.
- `Limited Edition` wurde vom Benutzer als zusätzliche Edition ausdrücklich beschlossen. Das aktuelle Schema und die Oberfläche unterstützen `limited` noch nicht; gezielte Erweiterung vor Bestandsübernahme in P2-08. Nicht in `Unlimited` oder `not_applicable` umdeuten. `Normal` bestätigt keine Edition.
- Kein Sprachfeld, kein explizites Artworkfeld und keine stabile externe Karten-/Produkt-ID. Auch Sprachhinweise im Namen oder ein DE-/EN-Code ersetzen keine bestätigte Angabe zur physischen Karte. Ohne manuelle Bestätigung bleibt Sprache `unknown`.
- `Card Number` ist Text, überwiegend ein gedruckter Setcode. Sechs leere Werte betreffen Produkte; drei `N/A`-Werte und ein Token-Code dürfen nicht numerisch umgeformt oder als ungültige Gesamtzeile verworfen werden.
- Zwei Bestandszeilen sind gegradet; Zustände/Grade unverändert erhalten. Keine neue Zustands-/Gradingverwaltung als Nebenauftrag.
- `Date Added`: befüllte Werte im Format `YYYY-MM-DD`; Marktpreisdatum steht im dynamischen Header. Preiswerte ohne Währungszeichen und ohne Dezimalkomma. Währung und fachliche Preisbedeutung sind dadurch nicht bestätigt; keine Übernahme als Cardmarket-Preis.
- `Notes` ist vorhanden und durchgehend leer. Zusatzfelder bleiben auch künftig erhalten.

## Lesender Abgleich mit lokalem Katalog

Keine YGOPRODeck-Anfragen. Verwendet: 14.653 lokale Karten und 44.614 unbestätigte Druckbeobachtungen. Vergleich nur nach Unicode-Normalisierung, Groß-/Kleinschreibung und Leerraum; keine unscharfe automatische Zuordnung oder Quelländerung.

| Ergebnis für Bestandszeilen einschließlich Produkte | Zeilen | Menge |
| --- | ---: | ---: |
| Exakter Name und Code zeigen auf dieselbe Kartenidentität | 5.471 | 9.351 |
| Code zeigt auf eine Identität, Name passt nicht exakt | 540 | 653 |
| Nur Name liefert eine eindeutige Identität | 13 | 19 |
| Weder Name noch Code liefern einen exakten Kandidaten | 74 | 81 |

Nach Abzug der sechs Produkte bleiben **68 Kartenzeilen mit 72 Exemplaren** ohne exakten Kandidaten. Die übrigen 553 einseitigen Treffer müssen ebenfalls als Vorschaukandidaten sichtbar bleiben. Abweichungen umfassen Namenszusätze für Seltenheit/Artwork, historische Kartennamen und deutsche Produktbezeichnungen. Zusätze nicht pauschal entfernen: Das kann Artwork-/Druckinformationen verlieren.

Unter den 5.471 übereinstimmenden Name-/Codezeilen stimmen bei 3.875 auch Setname und bei 5.384 die Seltenheit textuell mit einer passenden Beobachtung überein. Abweichungen sind keine bewiesenen Fehler. Selbst Übereinstimmung aller Felder bestätigt noch keine globale Variante: YGOPRODeck liefert hier keine belastbare Editions-/Artworkzuordnung. Kartenidentität und Druck-/Setzielbestätigung bleiben getrennt; keine vollständigen Setquoten versprechen.

## Abgeleitete nächste Schritte

1. P2-05 einschließlich Verzeichnisnavigation praktisch abnehmen. P0-02/E02 anhand dieses belegten Profils menschlich prüfen; die Datei ist nun vorhanden, eine Freigabe wurde dadurch nicht ersetzt.
2. P2-08: `Limited Edition` gezielt in Schema, Bestandserfassung, Validierung und Anzeige ergänzen, mit verlustfreier Migration. Keine Collectr-Daten dabei übernehmen.
3. P2-06 und verbleibendes P2-07: sichere Mengenbewegungen und Bestandsbedienung abschließen. Die kleine Ordnernavigation ist bereits innerhalb P2-05 vorgezogen; Ordnerbilder sind nur eine spätere Option, noch kein Upload-/Schemaauftrag.
4. P3-01: Parser mit synthetischen Beispielen dieses Profils. Header statt Position; dynamischer Marktpreisheader; `Notes`; Watchlist-Leerwerte und gültige Mengen separat behandeln; Rohwerte erhalten. Echte Datei bleibt aus gewöhnlichen Tests und Git ausgeschlossen.
5. P3-02: geschützte Vorschau, Portfolios auf Standorte abbilden, Produkte/Watchlist/Karten getrennt bilanzieren, Kandidaten und Konflikte zeigen. Sprache bewusst bestätigen; keine pauschale Deutsch-Annahme. Im Kartenmatching bekannte Code-/Namensabweichungen gezielt behandeln, ohne Drucke zu erfinden.
6. P3-03: bestätigte Übernahme mit Zeilenherkunft und Summenabgleich. Vorher muss die Darstellung physisch verortbarer Bestände ohne bekannte Kartenidentität konkretisiert werden: `stock.card_id` ist aktuell zwingend und Leser erwarten eine bekannte Karte. Import-Staging allein zählt solche Zeilen noch nicht als übernommenen Kartenbestand; keine still verlorenen Mengen oder erfundenen Karten-IDs.
7. P3-05: separate echte Vorschau-/Migrationsprüfung nach P1-14 und ausdrücklichem Auftrag mit Zielsystem. Die Dateianalyse ist keine Produktionsfreigabe und schreibt keine Echtdaten in den lokalen Teststack.

## Prüfung und Grenzen

Python-Standardbibliothek `csv` mit UTF-8-Dekodierung und strengem CSV-Lesen; Mengen-/Spalten-/Leerwert-/Duplikatabgleich über alle Zeilen. Katalogvergleich nur lesend aus lokalem öffentlichen Katalog. Originaldatei unverändert, keine Uploads und keine Importtabellen/Bestände angelegt. Ergebnis ist eine Analyse dieses einzelnen Exports, keine allgemeine offizielle Collectr-Spezifikation. Unabhängiger Abgleich mit der Collectr-App, tatsächlicher Sprache/Edition und physischer Vollständigkeit steht aus.
