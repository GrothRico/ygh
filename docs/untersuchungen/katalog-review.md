# Reviewhistorie zu P0-01

**Aktueller Stand:** Der Benutzer hat P0-01 abgenommen und E01 freigegeben. Dieser Bericht hält die vorherige unabhängige Prüfung fest; seine damalige Empfehlung und der damalige Reviewstatus sind historisch.

Datum: 21. Oktober 2026. Ausführung durch einen ausdrücklich beauftragten GPT-6-Luna-Subagenten, unabhängige Gegenprüfung durch den Hauptagenten. Gegenstand sind Recherche und Dokumentation, kein Anwendungscode.

## Urteil

**Damals nach gezielter Nacharbeit fachlich zur Abnahme empfohlen.** Der konkrete Editionsfall ist als ersthändige Händler-Katalogbeschreibung belegt und unabhängig gegengeprüft. Die Stichprobenkriterien von P0-01 sind damit erfüllt; ein vollständig importierbarer Variantenkatalog ist weiterhin nicht nachgewiesen. Zum Prüfzeitpunkt stand die menschliche Abnahme noch aus; inzwischen ist P0-01 abgenommen und E01 freigegeben.

## Prüfung der Abnahmekriterien

| Kriterium | Ergebnis |
| --- | --- |
| Konkrete Sprachzuordnung | Bestätigt: Konami cid=4041 zeigt Dark Magician/Dunkler Magier und passende DE-/EN-Druckcodes. |
| Konkreter Editionsunterschied | Nacharbeit bestätigt: Galaxy Games führt Blue-Eyes White Dragon, LOB-001, Ultra Rare auf derselben Produktseite mit beiden Editionsoptionen. Händlerbeleg, keine Hersteller- oder Artworkbestätigung. |
| Konkreter Seltenheitsunterschied | Bestätigt: RA05-DE083 wird als Ultra Rare und Starlight Rare geführt. |
| Konkreter Artworkunterschied | Bestätigt als Produktbeleg: Duel Devastator nennt neue Ash-Blossom-Artworks; die Detailseite führt DUDE-EN003. Ein allgemeiner Artwork-Druck-Mappingmechanismus ist damit nicht nachgewiesen. |
| Konkrete fehlende Daten | Bestätigt für die geprüften Darstellungen: Editionszuordnung fehlt; API-Set- und Bildarrays liefern keine direkte Druck-Artwork-Verknüpfung. |
| Identitäten und Aktualisierung | Quellen-IDs sind dokumentiert; keine Stabilitätsgarantie behauptet. Versionsendpunkt nur anhand Dokumentation geprüft. |
| Bild- und Datenverwendung | Anbieteranweisungen und Grenzen sind getrennt dargestellt; kein automatisierter Konami-Katalogimport eingeplant. |

## Gefundene und korrigierte Punkte

1. Die ursprüngliche YGOPRODeck-Zusammenfassung unterschlug die ausdrückliche Anweisung zur lokalen Datenspeicherung und zum Bild-Rehosting. Luna ergänzte den Hauptabschnitt; der Hauptagent zog Zusammenfassung und Entscheidungsregister konsistent nach.
2. Das RA05-Beispiel belegt die Mehrdeutigkeit des Setcodes allein. Die ursprüngliche Formulierung über Setcode plus Seltenheit ging über den Beleg hinaus und wurde korrigiert.
3. Der erste Entwurf enthielt zu wenig konkrete API-Werte. Luna ergänzte Dark Magician mit Karten-ID 46986414, CT13-EN003, RA05-EN083 und Bild-IDs. Diese Werte wurden unabhängig gegengeprüft.
4. Quellengebundene IDs brauchen keine vertragliche Stabilitätsgarantie als neue Implementierungsvoraussetzung. Eigene interne IDs und nachvollziehbare Fremdreferenzen bleiben die einfache Lösung; die Formulierung wurde präzisiert.

## Unabhängig geöffnete Belege

- [Konami Dark Magician DE](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4041&ope=2&request_locale=de) und [EN](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=4041&ope=2&request_locale=en).
- [Duel Devastator Produktbeschreibung](https://www.yugioh-card.com/en/products/duel_devastator/) und [Ash-Blossom-Druckliste](https://www.db.yugioh-card.com/yugiohdb/card_search.action?cid=12950&ope=2&request_locale=en).
- [YGOPRODeck API-Anleitung](https://ygoprodeck.com/api-guide/) und [Dark-Magician-Liveantwort](https://db.ygoprodeck.com/api/v7/cardinfo.php?name=Dark%20Magician).
- [Konami Neuron Bedingungen](https://legal.konami.com/games/neuron/terms/tou/de/), insbesondere Abschnitte 3 und 4 zur Nutzung und systematischen Erfassung. Die technische Quellenwahl ist keine umfassende rechtliche Begutachtung.

## Artefaktprüfung und Grenzen

Vor der Recherche wurde der vorhandene Dokumentationsstand außerhalb des Repositorys als Vergleichsbasis gesichert. Vorhandene Dateien waren ungetrackt; `git diff --check` allein hätte ihren Inhalt deshalb nicht ausreichend geprüft. Ergänzend wurden tatsächliche Dateiinhalte, lokaler Linkbestand und Umfang gegen diese Basis geprüft.

Luna änderte nur `docs/untersuchungen/katalog.md`, den E01-Abschnitt und den P0-01-Statusvermerk. Der Hauptagent ergänzte diesen Reviewbericht und konsistente Korrekturen in denselben Dokumenten. Keine Abhängigkeiten, Anwendung oder Infrastruktur wurden implementiert; keine Commits oder Folgeaufträge ausgeführt.

Kein vollständiger Katalog wurde geprüft. Deutsche Live-API-Abdeckung und alle Editions-/Artworkkombinationen sind nicht validiert. Die gezielte Editionsnacharbeit ist abgeschlossen. Eine spätere Auswahl einer produktiven Katalogquelle muss die dokumentierten Datenlücken berücksichtigen; daraus entsteht keine pauschale Freigabe, weitere Arbeitspakete zu implementieren.

## Gegenprüfung der gezielten Nacharbeit

Am 21. Oktober 2026 wurden die Händlerbelege durch Hauptagent und Luna jeweils geöffnet:

- [Galaxy Games Produktseite](https://galaxygamesllc.com/collections/yugioh-singles-instock/products/yugioh-blue-eyes-white-dragonthe-legend-of-blue-eyes-white-dragon): Titel und Details nennen Blue-Eyes White Dragon, LOB-001, Ultra Rare und das Set The Legend of Blue Eyes White Dragon. Die konkrete Produktvariantenliste enthält sowohl NM Unlimited als auch NM 1st Edition. Es handelt sich nicht bloß um allgemeine Suchfilter.
- [Sweets and Geeks Produktseite](https://www.sweetsandgeeks.com/products/blue-eyes-white-dragon-the-legend-of-blue-eyes-white-dragon-lob-001): bestätigt die Unlimited-Bezeichnung für LOB-001 mit Seltenheit Ultra Rare zusätzlich.
- [YGOPRODeck Blue-Eyes-Antwort](https://db.ygoprodeck.com/api/v7/cardinfo.php?name=Blue-Eyes%20White%20Dragon): Karten-ID 89631139, LOB-001/Ultra Rare, getrennte Bildliste; kein Editionsfeld für diese Setzeile.

Die Händlerquelle ist eine Primärquelle für ihre eigene Produktbeschreibung, keine Konami-Bestätigung. Galaxy Games weist zugleich eine widersprüchliche Non-Foil-Kategorie aus; diese wird nicht als Beleg übernommen. Artworkgleichheit, Produktionswellen und Echtheit einzelner angebotener Exemplare werden nicht behauptet. Diese Grenzen verhindern den Nachweis zweier explizit angebotener Editionen nicht, reichen aber nicht zum ungeprüften automatischen Aufbau aller Varianten.

Praktische Folgerung: Edition muss eine eigenständige Angabe bleiben. Die untersuchte API-Zeile kann sie nicht automatisch bestimmen. Der eng begrenzte Nacharbeitsauftrag hat keine weiteren Architekturänderungen erfordert.
