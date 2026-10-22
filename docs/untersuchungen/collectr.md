# Collectr-Export: Recherche und Importvertrag

**P0-02 · Recherche vom 2026-10-21 · Status: Vorschlag für Review**

## Ergebnis

Collectr dokumentiert offiziell, dass PRO-Mitglieder den Export im Portfolio über das Menü „…“ per E-Mail anfordern können. Die offizielle Hilfe veröffentlicht jedoch weder CSV-Header noch Datentypen oder eine Zusage, dass ein Export alle Portfolios enthält. Ein Sample auf derselben Hilfeseite beschreibt ausdrücklich den umgekehrten Weg: TCGPlayer-CSV in Collectr importieren. Es ist kein Beleg für Collectr-Exportheader.

Ein unabhängiger Konverter bezeichnet seine Headerliste als Header eines aktuellen Collectr-Exports und dokumentiert außerdem, dass ältere Exporte die Kartennummer auslassen können. Ein zweiter Fremdimporter identifiziert Collectr-PRO-Dateien anhand von `Portfolio Name`, `Product Name`, `Card Number` und `Variance`. Das stützt ein vorläufiges Headerprofil, garantiert es aber nicht. Ein öffentlich zugänglicher Originalquellcode eines Collectr-Importers mit testbaren Beispieldateien ließ sich in der Recherche nicht verifizieren; die Fremdbelege sind veröffentlichte Produkt-/Importdokumentation, kein geprüfter Quellcode.

Der Nutzer hat rund 15.000 überwiegend deutsche und einige englische Karten in zwei Portfolios desselben Collectr-Kontos. Eine echte Exportdatei liegt nicht vor. Daher sind die Headerprofile und Feldabbildungen unten Recherchebefunde, keine Validierung gegen diesen Bestand.

## Evidenz und Headerprofile

### Offiziell durch Collectr bestätigt

Die [Collectr-Hilfe „Import / Export Your Collection“](https://getcollectr.notion.site/Import-Export-Your-Collection-9aa6e5f4d0cd4efb995dadc992760c8e) beschreibt den Export für PRO-Mitglieder: Portfolio öffnen, Menü oben rechts, Export wählen und E-Mail-Adresse angeben. Sie nennt keine Exportspalten und kein Dateiformat im Detail. Die dortige Beispiel-CSV bezieht sich auf TCGPlayer-Import nach Collectr; die Hilfe sagt, dass aktuell nur TCGPlayer-Import unterstützt wird und dessen Product ID aus TCGPlayer stammen muss.

Collectrs [Hilfe zur Suche](https://getcollectr.notion.site/Searching-for-Products-cb5a7502d46e465b844f585598ff7c08) beschreibt Product Name, Set Name, eine gegebenenfalls vorhandene Card Number sowie Watchlist-Stern und Portfolio-Mengen in der App. Sie sagt nichts darüber aus, welche dieser Werte in einen Export geschrieben werden. Die [Portfolio-Namenshilfe](https://getcollectr.notion.site/Why-Does-the-Portfolio-Name-Show-up-in-Different-Places-89821aabd79b4f0299a15efb94ad2c73) bestätigt, dass das Portfolio die jeweils betrachtete Sammlung bezeichnet. Auch daraus folgt keine Exportgarantie.

### Fremdimplementierungen und veröffentlichte Importbeschreibungen

Die [CardCurrent-Collectr-Konvertierung](https://cardcurrent.app/collectr-csv-export/) (nicht mit Collectr verbunden) nennt unter „Real header from a current export“ folgendes Profil und Zuordnungen:

| Exakter Header laut Fremdquelle | veröffentlichte Interpretation | Typ für einen vorsichtigen Adapter |
| --- | --- | --- |
| `Portfolio Name` | Portfolio | Text; Originalwert bewahren |
| `Category` | Spiel/TCG | Text; Originalwert bewahren |
| `Product Name` | Karten-/Produktname | Text; keine Sprachableitung |
| `Set` | Setname | Text; kein Setcode belegt |
| `Card Number` | Sammlernummer | Text; nicht numerisch umformen |
| `Variance` | Variante, laut Quelle Collectrs Schreibweise | Text; nicht ungeprüft als Edition/Artwork auslegen |
| `Rarity` | Seltenheit | Text |
| `Quantity` | Menge | Rohtext einlesen; als Bestand nur positive Ganzzahl akzeptieren und Abweichungen markieren |
| `Card Condition` | Zustand | Text |
| `Grade` | Bewertung/Grading | Text |
| `Average Cost Paid` | durchschnittlicher Kaufpreis | Rohtext; Währung, Dezimalformat und Preis-pro-Karte-Konvention prüfen |
| `Price Override` | laut Name manuelle Preisüberschreibung | Rohtext; Bedeutung/Währung nicht verifiziert |
| `Market Price (As of a date)` | datierter Marktpreis | dynamischer Header/Text; Originalheader und -wert bewahren, nicht als Bestand oder Kaufpreis zählen |
| `Date Added` | laut Name Erfassungsdatum | Rohtext; Datumsformat nicht verifiziert |
| `Watchlist` | laut Name Watchlist-Markierung | Rohwert; nur nach Prüfung der tatsächlichen Werte als wahr/falsch auswerten |

CardCurrent weist darauf hin, dass ältere Exporte `Card Number` nicht enthalten können und kein Setcode ausgewiesen werde. Die Quelle erklärt außerdem, dass sie `Portfolio Name`, `Rarity`, `Price Override`, `Watchlist` und `Date Added` in ihr eigenes Zielformat nicht übernimmt. Das belegt nicht, dass Collectr sie nicht exportiert; es unterstreicht, dass für die Übernahme die Originaldatei und Originalzeilen bewahrt werden müssen.

Der [TCG OS-Importer](https://www.thetcgos.com/switch) beschreibt sein Collectr-PRO-Matching anhand der vier Spalten `Portfolio Name`, `Product Name`, `Card Number`, `Variance`. Das ist ein zweites, unabhängiges Headerprofil, aber keine vollständige Headerliste. Die Seite betont Vorschau vor Bestätigung und empfiehlt, zunächst eine kleine Stichprobe zu prüfen. Sie ist ebenfalls keine offizielle Collectr-Spezifikation.

### Unbestätigt oder nicht im belegten Profil enthalten

- Kein belegter Header für Sprache, Edition (1st/Unlimited), Artwork/Print-Variante oder eine stabile Collectr-/Katalog-ID.
- `Variance` ist als Feldname belegt, seine Yu-Gi-Oh!-Werte und die Abgrenzung zu Edition, Artwork oder Finish jedoch nicht. Ein Wert wie `Normal` beweist keine Unlimited-Edition.
- Ob `Watchlist` im PRO-Export vorhanden ist und welche Werte/Leerwerte es verwendet, ist nur durch CardCurrent behauptet, nicht offiziell bestätigt. Keine Watchlist-Spalte oder Kodierung ergänzen, wenn die echte Datei sie nicht enthält.
- Ob der Export zwei Portfolios in einer Datei ausgibt, sie separat exportiert oder ein Portfolio auswählbar ist, ist offiziell nicht beschrieben. CardCurrent und TCG OS nennen ein Portfoliofeld; das genügt nicht zur Garantie für diesen Nutzerfall.
- Kategorie-/Spielabdeckung, leere Werte, Zeilen pro Exemplar versus aggregierte Menge, Preiswährung, Dezimal-/Tausendertrennzeichen, UTF-8/BOM, CSV-Trennzeichen, Quote-/Escape-Regeln und Zeilenenden sind nicht gegen eine echte Datei geprüft.
- Englischer Kartenname beweist keine englische Kartensprache. Ohne explizites Sprachfeld oder manuelle Prüfung bleibt Sprache unbekannt.

## Vorgeschlagener, einfacher Vertrag für P3

1. CSV-Spalten anhand der Headernamen erkennen; Spaltenreihenfolge ignorieren und unbekannte Zusatzspalten sowie Originalheader erhalten. Nur oben belegte exakte Namen als Startprofil verwenden. Kein offizielles oder stabiles Schema behaupten.
2. Jede Eingabezeile mit ihrer ursprünglichen Zeilennummer und sämtlichen Originalwerten behalten. Parsing, Matching und Vorschau ändern die Originalzeile nicht.
3. Menge, Besitztum/Watchlist, Portfolio/Standort und Kartenidentität getrennt klären. Eine bestätigte positive Ganzzahlmenge mit manuell oder eindeutig zugeordnetem Portfolio und bestätigtem Besitztum kann als physischer Bestand übernommen werden, auch wenn Kartenidentität, Variante, Edition oder Sprache unbekannt bleiben. Dann bleibt der Bestand ungeklärt und erfüllt kein Set-Ziel. Unlesbare Menge, unklare Besitz-/Watchlist-Klassifikation oder ungeklärte Portfoliozuordnung werden vor Übernahme manuell geklärt; sie dürfen nicht still als physischer Bestand zählen. Eine bestätigte Watchlist-Zeile zählt nicht zum Bestand.
4. Keine Duplikate automatisch entfernen oder zusammenführen. Exakt gleiche und ähnlich wirkende Zeilen markieren und einzeln in der Vorschau zeigen; zwei gleiche Zeilen können zwei legitime Teilbestände darstellen.
5. Setname und Kartennummer helfen beim Matching, begründen aber bei fehlendem Setcode, Sprache, Edition oder Artwork keine eindeutige Druckzuordnung. Edition kann gemäß D09 manuell mit unbekanntem Default erfasst werden. Keine Sprache aus dem Namen ableiten.
6. Vor Übernahme eine Vorschau mit Portfolio, Rohzeile, erkanntem Match, Menge, Watchlist-Status und Warn-/Unklarheitsgrund zeigen. Portfolio, Besitz-/Watchlist-Status und Menge dürfen in der Vorschau manuell geklärt werden. Identitätsunsicherheit allein verhindert keinen Import: bestätigter physischer Bestand kann mit unbekannter Karten-/Variantenidentität sowie `language=unknown` übernommen werden; nicht bestätigte Varianten erfüllen kein Set-Ziel. Nicht übernommene Zeilen mit Grund ausweisen.
7. Mengenabgleich je Portfolio führen: Anzahl Originalzeilen, bestätigte physische Menge (einschließlich bewusst als ungeklärter Bestand übernommener Mengen), bestätigte Watchlist-Menge separat sowie Mengen mit ungeklärtem Besitz, Portfolio oder ungültiger Menge. Jede übernommene Menge muss auf einzeln bestätigte Quellzeilen zurückführbar sein. Mengen unbekannter Kartenidentität werden im physischen Abgleich gezählt, wenn Besitztum, Menge und Zuordnung bestätigt sind; sie werden nicht als bestätigte Variante oder Setfortschritt gezählt.
8. Originaldatei und Originalzeilen aufbewahren; Preis- und Datumsfelder sind für Mengenabgleich irrelevant. Bei zwei Portfolios muss die Vorschau ihre Zuordnung separat zeigen; fehlendes oder widersprüchliches Portfolio bleibt ungeklärt.

### Synthetische Beispieldaten (keine Collectr-Exportdatei)

Die vier folgenden Beispielzeilen benutzen ausschließlich Header aus dem CardCurrent-Fremdprofil. `Edition` und Sprache fehlen absichtlich: Edition bleibt unbekannt und Kartensprache ungeklärt. `?` in `Watchlist` ist ein Platzhalter für einen ungeprüften Rohwert, keine behauptete Collectr-Kodierung. Die Portfolionamen sind ebenfalls synthetische Bezeichnungen.

```csv
Portfolio Name,Category,Product Name,Set,Card Number,Variance,Rarity,Quantity,Card Condition,Grade,Average Cost Paid,Watchlist
Portfolio A,Yu-Gi-Oh!,Blue-Eyes White Dragon,Legend of Blue Eyes White Dragon,LOB-001,Normal,Ultra Rare,1,NM,,2.00,?
Portfolio A,Yu-Gi-Oh!,Blue-Eyes White Dragon,Legend of Blue Eyes White Dragon,LOB-001,Normal,Ultra Rare,1,NM,,2.00,?
Portfolio B,Yu-Gi-Oh!,Dunkler Magier,Legend of Blue Eyes White Dragon,LOB-005,Normal,Ultra Rare,1,NM,,3.00,?
Portfolio B,Yu-Gi-Oh!,Dunkler Magier,Legend of Blue Eyes White Dragon,LOB-005,Normal,Ultra Rare,1,NM,,3.00,?
```

Interpretation nur für dieses synthetische Beispiel: Die ersten beiden Zeilen in `Portfolio A` sind absichtlich echte doppelte Datenzeilen und bleiben separat erhalten. Im Szenario sind beide Karten physisch vorhanden, aber tatsächlich deutschsprachig trotz des englischen Namens; der Import kann das aus den gezeigten Feldern nicht wissen, daher bleibt Sprache `unknown`, bis sie manuell geprüft wird. Für `Portfolio B` ist Zeile 3 der Kandidatenbestand und Zeile 4 der Watchlist-Prüffall. Da der Platzhalter `?` keine bestätigte Watchlist-Aussage enthält, darf der Importer diese Fälle nicht anhand des Beispiels als Besitz/Watchlist kodieren. Die Vorschau muss Besitzstatus und Menge bestätigen lassen; anschließend kann Zeile 3 bei bestätigtem Besitz als Bestand mit unbekannter Identität/Variante übernommen werden. Bestätigte Watchlist-Menge zählt nicht physisch. `Normal` erlaubt keine Editionsaussage.

### Manuelle Bestätigungen und erwartetes Vorschauergebnis

Die Tabelle beschreibt ausschließlich erwartete Testergebnisse für diese synthetischen Zeilen. Die Bestätigungen sind **manuelle Szenarioeingaben**, keine aus `Watchlist=?` oder anderen CSV-Werten abgeleiteten Fakten. Insbesondere wird kein Watchlist-Code oder Exportverhalten behauptet. Alle vier Zeilen bleiben einzeln sichtbar; identische Werte sind ein Duplikathinweis, kein Löschgrund. Sprache bleibt mangels manueller Sprachprüfung `unknown`.

| CSV-Datenzeile | Manuelle Bestätigung im Szenario | Erwartetes Ergebnis nach Bestätigung |
| ---: | --- | --- |
| 1 | Portfolio A stimmt; physischer Besitz bestätigt; Menge 1. Sprache wurde nicht geprüft. | Eine physische Einheit in A; Sprache `unknown`. Identitäts-/Druckmatch bleibt offen, bis Variante belegt ist. |
| 2 | Gleiche Quellwerte wie Zeile 1; physischer Besitz als separates Exemplar bestätigt; Menge 1. Sprache wurde nicht geprüft. | Eine weitere physische Einheit in A; als Duplikat markiert, aber nicht mit Zeile 1 zusammengeführt; Sprache `unknown`. |
| 3 | Portfolio B stimmt; physischer Besitz bestätigt; Menge 1. Sprache wurde nicht geprüft. | Eine physische Einheit in B; Sprache `unknown`. Unbestätigte Karten-/Druckidentität erfüllt kein Set-Ziel. |
| 4 | Gleiche Quellwerte wie Zeile 3; manuelle Prüfung bestätigt Watchlist, keinen physischen Besitz; Rohmenge 1 bleibt separat ausgewiesen. Sprache wurde nicht geprüft. | Eine Watchlist-Einheit in B, keine physische Einheit. Als identische Quellzeile/Mehrdeutigkeit mit Zeile 3 markiert, einzeln aufbewahrt; Sprache `unknown`. |

Der erwartete Summenabgleich ist damit: vier Originalzeilen; Portfolio A zwei bestätigte physische Einheiten und keine Watchlist-Einheit; Portfolio B eine physische Einheit plus eine separat ausgewiesene Watchlist-Einheit. Insgesamt sind drei Einheiten physischer Bestand und eine Watchlist-Einheit, bei vier Mengenpunkten aus den Rohzeilen. Sprache bleibt für alle vier Zeilen `unknown`, bis sie separat geprüft wird; bei den englischen Namen in Zeile 1/2 darf daraus insbesondere keine englische Sprache abgeleitet werden. Vor den manuellen Bestätigungen darf der Importer keine dieser Mengen als bestätigten Bestand zählen; ungeklärte Watchlist-/Besitzklassifikation bleibt in einer separaten offenen Summe. Die reale Exportdatei kann andere Werte und eine andere Semantik haben.

## Entscheidungsvorschlag E02

Das Profil und der oben beschriebene Vorschlag genügen als einfache Startgrundlage für einen späteren Adapter mit Preview, Zeilenerhalt und Mengenabgleich. Es wird **keine** feste Collectr-CSV-Spezifikation beschlossen. Vor der echten Migration sind Header, Datentypen, Watchlist-Werte, Portfolio-Vollständigkeit, Duplikatsemantik, Kodierung und Mengenabgleich mit der tatsächlichen Exportdatei zu validieren (P3-05). Die aktuelle Eingabe enthält keine echte Exportdatei; diese Prüfung bleibt ausdrücklich offen.

**Abgerufen am 2026-10-21:** [offizielle Collectr-Exporthilfe](https://getcollectr.notion.site/Import-Export-Your-Collection-9aa6e5f4d0cd4efb995dadc992760c8e), [offizielle Collectr-Suchhilfe](https://getcollectr.notion.site/Searching-for-Products-cb5a7502d46e465b844f585598ff7c08), [offizielle Portfolio-Namenshilfe](https://getcollectr.notion.site/Why-Does-the-Portfolio-Name-Show-up-in-Different-Places-89821aabd79b4f0299a15efb94ad2c73), [CardCurrent-Header-/Konverterbeschreibung](https://cardcurrent.app/collectr-csv-export/), [TCG-OS-Importerbeschreibung](https://www.thetcgos.com/switch). Reddit-Beiträge waren kein Formatbeleg und sind nicht Grundlage dieses Vertrags.
