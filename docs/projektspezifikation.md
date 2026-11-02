# Projektspezifikation

Fachliche Grundlage, Stand 21. Oktober 2026; aktueller Projektstand ergänzt am 2. November 2026. Die fachlichen Regeln bleiben maßgeblich. Dieses Dokument beschreibt das Zielprodukt, nicht den vollständigen Ist-Stand; Karten-, Deck- und Cube-Funktionen sind noch nicht implementiert. Technische Beschlüsse und deren Umsetzungsstand stehen im [Entscheidungsregister](entscheidungen.md), Paketstatus im [Aufgabenindex](aufgaben/README.md). Produktname bleibt offen; Hosting ist mit Hetzner CX23 als Planungsgrundlage entschieden, aber noch nicht bestellt.

## Ziel und Leitlinien

Zwei Brüder verwalten gemeinsam ungefähr 15.000 Yu-Gi-Oh!-Karten. Die meisten sind bereits in getrennten Collectr-Portfolios innerhalb eines Kontos erfasst. Die Anwendung beantwortet zuverlässig: Welche Karten haben wir, wo liegen sie und welche sind für einen Deck- oder Cube-Bau verfügbar?

Die Anwendung muss auf iPhone, Android und Desktop funktionieren. Eine Internetverbindung darf erforderlich sein. Oberfläche und Fehlermeldungen sind deutsch; Kartensuche unterstützt deutsche und englische Namen. Englische Kartenbilder sind ausreichend.

Verständlichkeit, Portabilität und selbstständiges Debuggen sind Architekturziele. Es gibt ein Repository, eine Anwendung und eine relationale Datenbank. Zusätzliche Abstraktionen entstehen nur für konkrete Anforderungen. Kritische Bestandsregeln werden abgesichert; unwahrscheinliche Sonderfälle rechtfertigen keine umfangreichen Subsysteme.

## Bestand und physischer Standort

Jedes physische Exemplar ist genau einmal im Bestand vorhanden und hat genau einen aktuellen Standort. Identische Exemplare derselben Sprache und Variante am selben Ort werden als Bestand mit Stückzahl gespeichert. Eine Teilmenge kann verschoben werden.

Standorte bestehen aus der Person, bei der sich Karten befinden, und optionalen Behältern. Beispiele: „Bei Rico → Blaue Box → Fach Staples“, „Beim Bruder → Binder“, „Bei Rico → Deck Drachen“.

Boxen, Binder und Fächer können verschachtelt werden. Decks und Cubes enthalten Karten, aber keine weiteren Behälter. Ein Behälterwechsel bewegt seine Inhalte mit; die Karten müssen nicht einzeln umgebucht werden. Virtuelle Tags ändern keinen Standort.

### Persönliche Sammlung und Ausleihe

| Karten befinden sich in | Zuordnung für persönliche Set-Vervollständigung | Physische Verfügbarkeit |
| --- | --- | --- |
| Box, Binder, Fach oder unsortiert | Aktueller Standort bei einer Person | Aktueller Standort und Reservierung |
| Physischem Deck | Besitzer des Decks | Tatsächlicher Standort des Decks |
| Physischem Cube | Aktueller Standort bei einer Person | Tatsächlicher Standort des Cubes |

Nur physische Decks haben einen Besitzer. Dieser entscheidet nicht über Bearbeitungsrechte. Beide Benutzer dürfen alles bearbeiten. Beim Verleihen bleiben Deckbesitzer und Sammlungszuordnung bestehen; der aktuelle Standort wechselt. Ausleihe erfasst Herkunft, Entleiher, Beginn, optionales Rückgabedatum und Notiz. Rückgabe beendet die Ausleihe.

Verlässt eine Karte ein Deck dauerhaft, gilt die Regel ihres neuen Standorts. Beispiel: Ein ausgeliehenes Deck gehört dem Bruder und liegt bei Rico. Seine Karten zählen für die persönliche Set-Vervollständigung des Bruders. Eine daraus in Ricos Box verschobene Karte zählt anschließend bei Rico. Die gemeinsame Sammlung enthält sie stets nur einmal.

Die Oberfläche unterscheidet ausdrücklich „Meine Sammlung“, „Physisch bei mir“ und „Gemeinsam“. Ungeklärte Importstandorte werden als ungeklärt angezeigt und keiner Person zugerechnet.

## Karten und Varianten

Die Identifikation unterscheidet Karte, Set beziehungsweise gedruckten Code, 1st Edition/Unlimited, bei Mehrdeutigkeit Seltenheit sowie Artwork/weitere Version. Nicht anwendbare Editionen sind von unbekannten Editionen zu unterscheiden. Es werden nur tatsächlich existierende Kombinationen angelegt.

Die Sprache gehört zum physischen Bestand. Beispielanzeige: „2 Exemplare · 1 Deutsch · 1 Englisch“. Sprache erzeugt keine zusätzliche Anforderung für Set-Vervollständigung. Deutsche und englische Drucke müssen deshalb einem gemeinsamen Sammelziel zugeordnet werden können, ohne ihre gedruckten Codes zu verlieren.

Erfassung ist sowohl über unscharfe Namenssuche mit anschließender Druckauswahl als auch über vollständigen oder teilweisen Set-Code mit anschließender Kartenauswahl möglich. Exakte Codes werden bevorzugt. Mehrdeutige Treffer werden nicht automatisch geraten. Menge, Standort, Sprache und Edition können bei der Erfassung vorbelegt und vor dem Speichern geändert werden.

Fehlt eine eindeutige Editionsangabe in der Datenquelle, wird sie einfach am Bestand manuell erfasst: „Unbekannt“, „1st Edition“ oder „Unlimited“; „Nicht anwendbar“ bleibt für entsprechende Drucke möglich. Ohne Auswahl bleibt die Edition unbekannt, nicht automatisch Unlimited. Die Angabe kann später korrigiert werden und wird durch Katalogupdates nicht überschrieben. Unterschiedliche Editionen werden als getrennte Teilmengen geführt. Das ist auch ohne vollständig aufgelöste Katalogvariante möglich; eine manuelle Editionsangabe allein bestätigt noch kein vollständiges Sammelziel. Fehlende API-Editionsdaten blockieren somit nicht die Bestandserfassung.

Jede Sammlung und jeder Behälter zeigt Kartenbilder und Mengen. Eine kompakte Listenansicht ergänzt die Bildansicht. Kartendetails zeigen die Verteilung über alle Standorte. Große Listen werden portionsweise geladen.

## Set-Vervollständigung

Pro Set werden alle gültigen Sammelvarianten berücksichtigt, einschließlich unterschiedlicher Editionen, Seltenheiten und Artworks. Deutsch oder Englisch erfüllt dasselbe Sammelziel. Mehrere Exemplare erhöhen die Menge, aber nicht die Anzahl erfüllter Varianten.

Ansichten: persönliche Sammlung je Benutzer und gemeinsame Sammlung. Vorhandene und fehlende Varianten werden mit Bildern dargestellt. Die gemeinsame Quote wird aus den gemeinsam erfüllten Zielen berechnet, nicht aus der Summe der persönlichen Quoten. Karten aus einem anderen Set erfüllen das Ziel nicht.

Unaufgelöste Bestände erfüllen keine konkrete Variante. Falls der Katalog eines Sets nicht vollständig geprüft ist, wird die Quote als vorläufig gekennzeichnet. Null bekannte Ziele ergeben keine fiktiven 100 Prozent.

## Collectr-Migration

Der Import verarbeitet Collectr-CSV direkt. Portfolios werden in der Vorschau auf Personen und gegebenenfalls Behälter abgebildet. Der Import ist zunächst eine einmalige Übernahme, keine bidirektionale Synchronisierung.

Die öffentlich dokumentierten Fremdimporter nennen unter anderem `Portfolio Name`, `Category`, `Product Name`, `Set`, `Card Number`, `Variance`, `Rarity`, `Quantity`, `Card Condition`, `Grade`, `Average Cost Paid`, `Price Override`, `Watchlist`, `Date Added` und einen datierten Marktpreis. Dies ist eine vorläufige Adaptergrundlage, keine garantierte offizielle Collectr-Schnittstelle.

Spalten werden anhand ihrer Namen erkannt; Reihenfolge und zusätzliche Spalten dürfen variieren. Die tatsächliche Kodierung von Yu-Gi-Oh!-Editionen, Sprache und Artwork ist weiterhin ungeprüft, da kein echter Collectr-Export vorliegt. Kartennamen auf Englisch beweisen keine englische Kartensprache. Fehlende Angaben bleiben unbekannt.

Ablauf: Datei prüfen → Vorschau → Portfolios zuordnen → eindeutige Treffer und ungeklärte Zeilen zeigen → Übernahme bestätigen → Mengenbericht je Portfolio. Originaldatei und Originalzeilen bleiben erhalten. Watchlist-Zeilen werden nicht als physischer Bestand gezählt. Nicht importierte Zeilen werden mit Grund ausgewiesen.

Ungeklärte Zeilen dürfen als ungeklärter Bestand übernommen werden. Ist die Kartenidentität bekannt, können sie zur theoretischen Verfügbarkeitsprüfung beitragen, aber nicht zur bestätigten Set-Vervollständigung. Wiederholte Dateiimporte werden erkannt; identische Zeilen werden nicht blind entfernt. Ein Import kann nur dann vollständig zurückgenommen werden, wenn seine Bestände seitdem nicht verändert wurden; andernfalls erfolgt eine nachvollziehbare Korrektur statt eines riskanten automatischen Rollbacks.

## Deckbau und Bannlisten

Eine Deckliste ist ein Rezept; ein physisches Deck ist eine Zusammenstellung konkreter Bestandsmengen. Entwürfe dürfen beliebige Karten enthalten und dieselben Karten wie andere Entwürfe verwenden. Ein physisches Exemplar kann nur einem physischen Behälter zugeordnet sein.

Editor mit Main, Extra und Side, Kartensuche und Filtern, Bildern, Mengensteuerung, Kopieren, einfachen gespeicherten Versionen und Import/Export. Desktop-Bedienung orientiert sich an Dueling Nexus und YGO Omega; auf Smartphones gibt es Tap-Aktionen statt einer Pflicht zu Drag-and-drop.

Pro Karte werden benötigte, vorhandene, freie und fehlende Mengen sowie ihre Standorte angezeigt. Karten in anderen Decks oder Cubes gelten standardmäßig als belegt, bleiben aber als mögliche Transfers sichtbar. „Vorhanden“ bedeutet nicht „sofort hier verfügbar“.

Beim Zusammenstellen entsteht eine Pickliste nach Standort. Rezeptänderungen erzeugen einen Änderungsvorschlag; sie bewegen keine physischen Karten, bevor der Benutzer die tatsächliche Umbuchung bestätigt.

Erste unterstützte Modi: aktuelles TCG und freier/custom Deckbau. Langfristig sollen weitere Formate möglich sein, aber „unterstützt“ unterscheidet sich von vollständig geprüfter Legalität. Eigene Bannlisten sind benannte, versionierte Listen mit erlaubter Stückzahl je Kartenidentität. Limits gelten über Main, Extra und Side gemeinsam. Regeln liegen in überschaubaren TypeScript-Funktionen, nicht in einer frei programmierbaren Regelmaschine. Historische Formate benötigen passende Kartenpools und Regeln und werden später separat umgesetzt.

## Cubes und Drafting

Cube-Liste, physischer Cube und Draft-Sitzung sind getrennte Konzepte. Der Editor unterstützt Karten, Stückzahlen, Kategorien, verfügbare und fehlende Mengen sowie gespeicherte Versionen. Ein physischer Cube bindet Bestand wie ein Deck, hat aber keinen Besitzer für Sammlungszwecke: Entscheidend ist der Standort.

Lokale Drafts sind ausreichend. Schwerpunkt ist zwei Spieler; gemeinsame Online-Drafts sind nicht Bestandteil der ersten Umsetzung. Alle Plätze können manuell bedient werden. Alternativ übernimmt ein einfacher simulierter Picker freie Plätze. Er testet Abläufe und ist keine kompetente Spiel-KI.

Vorgesehene Verfahren:

- Pack-Draft mit 15 Karten pro normalem Pack als Vorgabe, konfigurierbaren Packrunden, Picks und Weitergaberichtung.
- Grid-Draft für zwei mit offenen Reihen beziehungsweise Spalten; der konkrete Ablauf wird vor Umsetzung als einfache feste Regel dokumentiert.
- Sealed als direkte Pool-Zuteilung ohne Weitergabe.

Extra-Deck-Karten kommen standardmäßig aus einem separaten Pool in eigenen Packs nach dem normalen Draft. Größe und Anzahl dieser Packs sind separat einstellbar. Draft-Einstellungen werden als Vorlagen gespeichert. Kategorienbasierte Packzusammensetzung ist eine spätere Ergänzung nach funktionierendem Zufalls-Pack-Draft.

Ein Draft verwendet eine unveränderliche Kopie der Cube-Liste und Einstellungen. Verteilung erfolgt ohne Zurücklegen einzelner Cube-Exemplare. Bei zu wenig Karten startet die Sitzung nicht mit stillen Duplikaten, sondern zeigt die fehlende Menge. Ein gespeicherter Zufalls-Seed macht Testverteilungen wiederholbar.

Testfunktionen: Packs ansehen, Plätze wechseln, Picks protokollieren, einen Testschritt zurücknehmen und neu starten. Bei zwei Menschen am selben Gerät blendet eine Übergabeansicht verdeckte Informationen aus. Die daraus gebauten Decks dürfen nur Karten aus dem erhaltenen Pool enthalten; Main-/Extra-/Side-Vorgaben sind für Cube-Decks einstellbar.

Virtuelle Drafts verändern keine Bestände. Eine Inventarverwaltung für tatsächlich an Spieler verteilte Cube-Karten ist eine spätere Erweiterung, nicht Voraussetzung des Simulators.

## Manuelles Testfeld

Normale und gedraftete Decklisten verwenden dasselbe Solo-Testfeld: mischen, ziehen, zurücksetzen, Deck durchsuchen, Karten zwischen Hand, Feld, Friedhof und verbannt bewegen, drehen, verdecken, Lebenspunkte, Tokens und Zähler verwalten sowie Aktionen zurücknehmen.

Tests arbeiten mit einer Kopie der Liste. Es gibt keine Bestandsänderungen, automatische Effektauflösung, Online-Duelle oder Spiel-KI.

## Preise

Cardmarket-Preise sind optional. Bevorzugt werden offiziell bereitgestellte Katalog- und Preisdateien. Es wird keine Scraping-Abhängigkeit eingeplant. Exakte Druckpreise und ungefähre Kartenpreise sind getrennt zu kennzeichnen, jeweils mit Quelle und Datenstand. Fehlende Preise bleiben unbekannt und werden nicht als null Euro ausgegeben.

## Architektur und Entwicklung

Next.js und TypeScript bilden Oberfläche und Server. Drizzle verwaltet ein SQLite-Schema mit versionierten Migrationen. Fachlogik befindet sich in gewöhnlichen Modulen für Bestand, Katalog, Import, Decks und Drafts. Serveraktionen beziehungsweise HTTP-Endpunkte rufen dieselben fachlichen Funktionen auf.

Eine Anwendungsinstanz greift auf die SQLite-Datei auf lokaler VPS-Festplatte zu. Bestandsänderungen erfolgen in kurzen Transaktionen mit erneuter Mengenprüfung. Keine Datenbank auf einem Netzwerkdateisystem, keine horizontale Skalierung, kein separater Suchdienst. Fuzzy-Suche wird zunächst im Katalog und mit einfachen Indizes umgesetzt.

Docker Compose startet die Anwendung. Tailscale Serve liefert privates HTTPS; Caddy ist nicht vorgesehen. Datenbank, Bilder und Importdateien liegen in persistenten Volumes. Lokale Entwicklung unterstützt Hot Reload. Ein Produktionsimage enthält einen festgelegten Build und läuft ohne unnötige Rechte. Der Docker-Socket wird nicht an die Anwendung durchgereicht.

## Privater Zugriff und Sicherheit

Tailscale verbindet VPS, Smartphones und Computer. Nur die zwei freigegebenen Benutzer und genehmigte Geräte erhalten Anwendungszugriff. Explizite Netzwerkregeln ersetzen eine pauschale Freigabe aller Geräte. Administrationszugang erhält zunächst nur Rico. Keine öffentliche Registrierung, kein öffentlicher Anwendungs-, Datenbank- oder SSH-Port nach Einrichtung. Zugang über die Anbieter-Konsole bleibt als dokumentierter Wiederherstellungsweg erhalten.

HTTPS wird im privaten Netzwerk über Tailscale Serve bereitgestellt; die App ist nur an Host-Loopback veröffentlicht. Funnel bleibt aus; öffentliche Anwendungsports werden nicht geöffnet. Der beschlossene Zugang nutzt einen privaten `*.ts.net`-Namen ohne eigene Domain.

Die Anwendung ordnet die zwei erlaubten Tailscale-Identitäten serverseitig zu und prüft Zugriffe auch für Bilder, Exporte und Dateien. Tailscale Serve ersetzt vom Client gesendete Identitätsheader; die App prüft Identität, Aktivstatus und Rolle bei jedem geschützten Serveraufruf. Der Host bleibt Teil der Proxy-Vertrauensgrenze.

MFA beim Identitätsanbieter, bevorzugt Passkeys; keine selbst entwickelte Kryptografie. Der Sitzungszustand liegt bei Tailscale/IdP, es gibt keine App-Cookie-Sitzung oder App-Logout. CSRF-/Origin-Prüfungen, Eingabevalidierung, parametrisierte Abfragen, begrenzte Uploads und sichere Dateipfade sind Teil der Implementierung. Geheimnisse werden über Ansible Vault beziehungsweise geschützte Laufzeitdateien verwaltet und nicht ins Klartext-Repository geschrieben.

## Infrastruktur und Betrieb

Gemieteter Linux-VPS: Hetzner CX23 mit IPv4 ist die freigegebene Planungsgrundlage, ca. 7,13 € brutto pro Monat vor externem Backup (Preisstand 2026-10-21). Die Abweichung vom ursprünglichen Zielbudget von ungefähr 5 € ist im Kostenvergleich dokumentiert. Der Benutzer bestellt manuell und prüft dabei Endpreis und Verfügbarkeit. Restic mit Backblaze B2 EU Central und Healthchecks.io sind in P0-06 als Planungsgrundlage freigegeben. Implementierung ist lokal vorhanden; Live-Einrichtung und Betriebsprüfung sind offen.

Ansible übernimmt Einrichtung, Firewall, Docker, Verzeichnisse, private Erreichbarkeit, Deployment, Backup-Jobs und Loglimits. Die VPS-Erstellung erfolgt manuell durch den Benutzer; Ansible konfiguriert anschließend den vorhandenen Server. Terraform/OpenTofu sind nicht zusätzlich vorgesehen.

Deployments erhalten persistente Daten. Vor Schemaänderungen wird gesichert. Migrationen laufen kontrolliert einmal pro Deployment. Ein Image-Rollback allein macht eine Datenbankmigration nicht rückgängig; Wiederherstellung und Versionskompatibilität werden dokumentiert. Betriebssystem-Sicherheitsupdates und regelmäßige Abhängigkeitsupdates gehören zum Betrieb.

## Backups und Wiederherstellung

Vereinbart ist eine tägliche konsistente SQLite-Sicherung; Retention und Betriebsparameter stehen verbindlich in [E06](entscheidungen.md#e06--sicherung-und-betriebsprüfung). SQLite-Backup-Mechanismus statt bloßem Kopieren einer laufenden Datenbankdatei. Benötigte Importoriginale und nicht rekonstruierbare Dateien werden mitgesichert; rekonstruierbare Katalogbilder können aus dem Katalog wiederhergestellt werden.

Der freigegebene Plan sieht verschlüsselte Restic-Sicherungen in Backblaze B2 EU Central vor. Bei erfolgreichen täglichen Sicherungen liegt der mögliche Datenverlust bei ungefähr einem Tag; ausbleibende Sicherungen vergrößern dieses Fenster. Wiederherstellungsschlüssel müssen unabhängig vom VPS verwahrt werden; das ist vor Live-Nutzung noch praktisch zu prüfen. Restore ist initial und danach vierteljährlich manuell vorgesehen. Der lokale Restore wurde synthetisch geprüft; Zielhost und vollständige Live-Wiederherstellung bleiben offen.

## Logging und Benachrichtigungen

Technische Anwendungs-, Sicherheits- und Betriebslogs werden lokal über journald begrenzt und täglich verschlüsselt extern archiviert. Konkrete Zeit-/Größenlimits stehen in [E06](entscheidungen.md#e06--sicherung-und-betriebsprüfung), die Einrichtung in [Betrieb](betrieb.md). Der dauerhafte fachliche Sammlungsverlauf ist davon getrennt und gehört zu den noch geplanten Bestandstransaktionen.

Die Anwendung schreibt mit ihrem vorhandenen Logger strukturierte JSON-Ereignisse nach stdout/stderr; eine zusätzliche Pino-Abhängigkeit ist nicht eingeführt. Die produktive Ansible-Compose-Vorlage verwendet den journald-Treiber, der Host übernimmt die Begrenzung. Zeitpunkte werden intern in UTC gespeichert und deutsch mit lokaler Zeit angezeigt. Request-IDs verbinden sichtbare Fehler mit technischen Logs.

Keine Passwörter, Tokens, Cookies, vollständigen CSV-Dateien oder ungefilterten Anfrageinhalte im Log. Technische Logs erhalten Größenlimits und zeitliche Bereinigung; bei Erreichen des Größenlimits kann die tatsächlich verfügbare Historie kürzer sein. Kritische Sammlungsänderung und Verlaufseintrag werden in derselben Datenbanktransaktion gespeichert.

Sicherheits- und Betriebslogs werden regelmäßig verschlüsselt außerhalb des Servers gesichert. Dies ist keine manipulationssichere Echtzeitarchivierung. Umfang und Verfügbarkeit zentraler Tailscale-Auditlogs werden im gewählten Tarif geprüft; lokale Dienstlogs ersetzen diese nicht.

Gezielte Meldungen für fehlgeschlagene Backups, anhaltenden Anwendungsausfall und knappen Speicher. Healthchecks.io mit E-Mail an Rico ist als Planungsgrundlage festgelegt; Kontoeinrichtung und Live-Zustellung sind offen. Ein Prozess auf dem ausgefallenen VPS kann dessen Totalausfall nicht zuverlässig melden. Kein ELK-, SIEM- oder eigener Grafana-Stack in der ersten Version.

## Nicht im ersten Umfang

Native Apps, Offline-Schreibzugriffe, öffentliches Teilen, weitere Benutzer, Online-Drafts, automatische Duellregeln, anspruchsvolle Draft-KI, Kartenscanner, Collectr-Synchronisierung und universelle Formatvalidierung. Diese Grenzen ändern nicht die vorgesehenen Kernfunktionen für Sammlung, Decks, Cubes und manuelles Testen.

## Quellen und offene Integrationen

- [YGOPRODeck API](https://ygoprodeck.com/api-guide/): Kandidat für Kartendaten, Namen, Bilder und grobe Preise; vollständige Variantenabdeckung noch zu prüfen.
- [Collectr Exporthilfe](https://getcollectr.notion.site/Import-Export-Your-Collection-9aa6e5f4d0cd4efb995dadc992760c8e): Exportweg; keine vollständige garantierte CSV-Spezifikation.
- [CardCurrent Collectr-Konverter](https://cardcurrent.app/collectr-csv-export/) und [Mint Importbeschreibung](https://mint-tcg.com/import/): vorläufige Header- und Mapping-Grundlage.
- [Cardmarket Preisdateien](https://news.cardmarket.com/en/Magic/adding-non-singles-and-accessories-to-the-price-guide): Ansatz für optionale Preisversorgung.
- [Tailscale Gerätefreigaben](https://tailscale.com/docs/features/access-control/device-management/device-approval), [Zugriffsregeln](https://tailscale.com/docs/reference/syntax/grants), [Identität](https://tailscale.com/docs/concepts/tailscale-identity) und [Tarife](https://tailscale.com/pricing): bei Einrichtung erneut auf aktuelle Unterstützung prüfen.
