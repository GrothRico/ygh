# Hosting- und Backupkosten (P0-03)

Stand und Abruf der Anbieterpreise: 21. Oktober 2026. Beträge sind laufende Monatspreise, sofern nicht anders vermerkt. Geprüft wurden zwei budgetnahe VPS sowie ein teurerer 4-GB-Vergleich. **Aktuelle Planungswahl:** Hetzner CX23 mit IPv4, vorbehaltlich erneuter Lieferbarkeits- und Preisprüfung vor der manuellen Bestellung. netcup war die historische Empfehlung des ursprünglichen Kostenvergleichs. Es wurde nichts bestellt.

## Ergebnis

Der historische Kostenvergleich zeigte, dass das Ziel von ungefähr 5 € brutto mit netcup VPS nano G11.5s und Backblaze B2 rechnerisch erreichbar wäre. Die nachfolgende Benutzerentscheidung setzt jedoch Hetzner CX23 mit IPv4 als aktuelle Planungsgrundlage; der Kostenvergleich wird dadurch nicht nachträglich geändert. Für Hetzner ergeben sich nach der am 21. Oktober 2026 geprüften Preisliste ca. 7,13 € brutto für VPS plus IPv4 beziehungsweise ca. 7,21 € einschließlich des konservativ kalkulierten 20-GB-B2-Puffers. OVHcloud bleibt eine historische bedingte Vergleichsoption. Alle Preise und Lieferbarkeit sind vor manueller Bestellung erneut zu prüfen.

| Kombination | Laufende Kosten brutto | Ressourcen und Standort | Bedingungen / Grenzen |
| --- | ---: | --- | --- |
| **netcup VPS nano G11.5s + Backblaze B2 EU Central + Restic** | VPS 3,69 € inkl. IPv4/IPv6; B2 0 € bis 10 GB durchschnittlichem Speicher, danach ca. 0,0083 €/GB/Monat brutto (konservative Wechselkursannahme); zusammen ca. 3,69 € bei 5 GB bzw. 3,77 € bei 20 GB | 2 vCore, 2 GB RAM, 60 GB SSD; Nürnberg. B2 EU Central: Amsterdam. Traffic inklusive; bei durchschnittlich mehr als 100 Mbit/s über 24 Stunden wird vorübergehend auf 100 Mbit/s gedrosselt. | 6 Monate Mindestlaufzeit und Abrechnungsperiode, also 22,14 € je Vorauszahlungsperiode; 0 € Einrichtung. IPv6-only reduziert den VPS-Preis um 0,60 €/Monat, IPv4+IPv6 ist ohne Aufpreis enthalten. Ein Tarif je Kunde; keine Gutscheinkombination. 2 GB sind knapp: Produktionsbuild lokal oder in CI erstellen und nur das fertige Image deployen. 60 GB für OS, Container, Anwendungsdaten und Bildcache beobachten. |
| **OVHcloud VPS-1 2027 + Backblaze B2 EU Central + Restic** | VPS ab 3,81 € netto × 1,19 = 4,53 € brutto; B2 0 € bis 10 GB, bei 20 GB ca. 0,08 € brutto; zusammen ca. 4,53–4,61 € | 2 vCore, 4 GB RAM, 40 GB NVMe; deutsche Preisseite nennt das Modell, der konkrete Bestellstandort muss vor Auftrag geprüft werden. 500 Mbit/s öffentliche Bandbreite, laut Tarif unbegrenzter Traffic. | Die Seite zeigt den „ab“-Monatspreis; eine Konfiguratorauswahl mit 12 Monaten Vorauszahlung ergab 45,72 € netto/Jahr. Der Konfigurator konnte anschließend nicht zuverlässig geladen werden; Einrichtung und weitere Laufzeitoptionen sind offen. Enthalten ist eine tägliche Providerkopie der vorigen 24 Stunden; die Retention der für eine Wiederherstellung verfügbaren Punkte ist anhand der Produkttexte nicht eindeutig. Sie ersetzt das externe Repository nicht. 40 GB lokaler Speicher sind knapper als bei netcup. Verfügbarkeit/Standort und Endpreis vor Auftrag prüfen. |
| **Hetzner CX23 + Backblaze B2 EU Central + Restic** | CX23 5,49 € netto + IPv4 0,50 € netto; zusammen 5,99 € netto × 1,19 = 7,13 € brutto; mit 20 GB B2 konservativ ca. 0,08 € brutto, insgesamt ca. 7,21 € | 2 vCore, 4 GB RAM, 40 GB; 20 TB inkludierter EU-Traffic laut Cloud-Angebot. Standortoptionen Deutschland/Finnland. | Aktuelle Preisliste ab 15.06.2026, kein beworbener Promo-Satz. IPv4 separat berechnet; ohne IPv4 kostet der Server bereits 6,53 € brutto. Hetzner rechnet stündlich bis zum Monatscap ab. Produktseite zeigte „not available“; Lieferbarkeit ist daher offen. Keine Anbieter-Sicherung in dieser Summe angesetzt. |

Die B2-Mehrkosten rechnen sich aus 6,95 USD je TB und 30 Tage. Für 20 GB werden nur 10 GB oberhalb der dauerhaft freien ersten 10 GB berechnet: 10/1000 × 6,95 = 0,0695 USD/Monat. Für den Bruttovergleich setze ich konservativ 1 USD = 1 € und 19 % Umsatzsteuer an, somit rund 0,08 € brutto. Backblaze weist aus, dass EU-Umsatzsteuer abhängig von der Rechnungsadresse anfällt. B2 hat keine Mindestdateigröße und keine Mindestaufbewahrungsdauer. API-Klassen A, B und C sind im Pay-as-you-go-Tarif kostenlos; Klasse D kostet nach den ersten 2.500 Aufrufen pro Tag 0,004 USD je 10.000 Aufrufe. Egress ist bis zum Dreifachen des monatlichen Durchschnittsspeichers frei, danach 0,01 USD/GB (außer zu bestimmten Partnern). Ein vollständiger Restore von 20 GB läge somit im regulären Freikontingent, solange die Monatsmenge im Übrigen gering bleibt.

## Daten- und Alarmannahmen

Für die Kostenplanung setze ich im verschlüsselten Backup-Repository 1–5 GB erwarteten Speicher an; mit Puffer wird die 20-GB-Schwelle kalkuliert. Das ist eine Schätzung, weil Schema, Datenbankgröße und Importdateien noch nicht existieren. Eingeschlossen sind die SQLite-Datenbank über einen konsistenten SQLite-Backup-Mechanismus, benötigte Collectr-Importoriginale, Ansible-/Betriebskonfiguration ohne Geheimnisse sowie nötige nicht rekonstruierbare Betriebsdaten. Restic verschlüsselt lokal und dedupliziert. Die vorgeschlagenen 30 täglichen und 12 monatlichen Punkte erhöhen den Speicher nicht linear, aber tägliche Datenänderungen können die Schätzung überschreiten. Die erste echte Sicherung und spätere Wachstumsrate müssen gemessen werden.

Der englische Kartenbildcache wird separat behandelt: Bilder gelten als rekonstruierbar und bleiben aus dem Backup ausgeschlossen. Seine Größe ist unbekannt; sie kann den VPS-Datenträger stärker beanspruchen als Datenbank und Import. Für 15.000 physische Karten ist das keine bekannte Zahl von 15.000 eindeutigen Bildern. Cache-Begrenzung und Umfang sind später festzulegen. Für die 2-GB-Instanz sollte das Image vorab lokal/in CI gebaut werden, damit Next.js-Buildspitzen nicht mit dem laufenden Dienst um RAM konkurrieren.

Als externer Alarmkanal eignet sich Healthchecks.io Hobbyist: aktuell 0 USD/Monat, 20 überwachte Jobs und 100 Protokolleinträge je Job; E-Mail-Integrationen sind dokumentiert. Ein VPS-seitiger Timer kann den privaten Dienst lokal prüfen und nur bei Erfolg einen Heartbeat senden; ein ausbleibender Ping wird extern als fehlender Check-in gemeldet. Der Prüfer benötigt dabei keinen öffentlichen Zugriff auf die Anwendung. Das prüft keinen TLS-/Clientpfad von außen und ist kein Verfügbarkeitsnachweis; Meldung und E-Mail-Zustellung bleiben vom externen Anbieter abhängig. Backup-Erfolg und lokaler Dienstcheck wären getrennte Heartbeats.

Für Tailscale rechne ich vorläufig mit dem kostenlosen Personal-Tarif für nicht-kommerzielle private Nutzung (zwei Menschen liegen unter der aktuellen Grenze von sechs Nutzern) und Tailscale Serve mit HTTPS-Zertifikat unter `*.ts.net`; damit wird keine eigene Domain eingepreist. HTTPS erfordert das Aktivieren der Zertifikate für das Tailnet. Maschinenname und Tailnet-DNS-Name werden dabei in einem öffentlichen Certificate-Transparency-Log sichtbar. Diese Tarif-, Identitäts- und Zugriffsdetails bleiben Gegenstand von P0-04. Der private Dienst wird nicht durch Tailscale Funnel oder eine öffentliche Monitoring-Route geöffnet.

## Historischer Vergleich und ursprüngliche Empfehlung

Ursprüngliche Empfehlung vor der Benutzerentscheidung: netcup VPS nano + Restic nach Backblaze B2 EU Central. Diese Preis-/Ressourceneinschätzung bleibt als historischer Befund erhalten; netcup ist nicht die aktuelle Planungswahl.

Hetzner CX23 ist die ressourcenseitig passende, aber teurere dritte Option: mit separat bepreister IPv4 ergeben sich rund 7,13 € brutto vor externem Backup und ca. 7,21 € mit dem 20-GB-B2-Puffer. Selbst ohne IPv4 kostet der Server bereits etwa 6,53 € brutto. Alte Treffer mit 2,99/3,99 € gelten nicht für Neubestellungen nach der Preisanpassung. Die Produktseite meldete beim Abruf „not available“; sofortige Lieferbarkeit ist nicht belegt.

Keine dieser Kostenangaben belegt Dienstverfügbarkeit, Haltbarkeit einer konkreten Sicherung oder erfolgreichen Restore. Provider-Backups/Snapshots sind nicht als Ersatz für das separate, verschlüsselte externe Repository angesetzt. Tailscale-Personal-Tarif muss zur privaten nicht-kommerziellen Nutzung passen. Preise, Kontingente, FX und Standortverfügbarkeit können sich ändern; vor einer Bestellung im Warenkorb erneut prüfen. Die Planungswahl Hetzner liegt oberhalb des ursprünglichen 5-€-Ziels; das wurde mit der Benutzerentscheidung als Kostenrahmen akzeptiert. Keine Bestellung oder Betriebsprüfung ist erfolgt.

## Offizielle Quellen

Alle Quellen zuletzt abgerufen am 21.10.2026.

- [netcup VPS nano G11.5s: Preis, Ausstattung, Laufzeit, IPv4-Optionen](https://www.netcup.com/de/server/vps/vps-nano-g11.5s-6m-nue)
- [netcup VPS Lite: Standorte, Tarifübersicht und Traffic-Regel](https://www.netcup.com/de/server/vps-lite)
- [OVHcloud Deutschland VPS-Preise und Tarifdetails](https://www.ovhcloud.com/de/vps/)
- [Backblaze B2: Preis, Freikontingent, Transaktionen und Egress](https://www.backblaze.com/cloud-storage/pricing)
- [Backblaze B2: Datenregionen; EU Central in Amsterdam, regionsgleicher Speicherpreis](https://www.backblaze.com/docs/cloud-storage/data-regions)
- [Backblaze: Umsatzsteuer für EU-Kunden](https://help.backblaze.com/hc/en-us/articles/115004487993-VAT-for-EU-Customers)
- [Hetzner: Cloud-Preisanpassung ab 15.06.2026, deutsche Bruttopreise](https://docs.hetzner.com/de/general/infrastructure-and-availability/price-adjustment/)
- [Hetzner: öffentliche IPv4 als Zusatzoption](https://docs.hetzner.com/cloud/servers/primary-ips/overview/)
- [Hetzner: aktuelle Cost-optimized-Angebote](https://www.hetzner.com/cloud/cost-optimized/)
- [restic: Verschlüsselung und Verwaltung von Repository-Schlüsseln](https://restic.readthedocs.io/en/stable/070_encryption.html)
- [restic: Speicherziele, Backblaze B2 und Hinweis auf S3-kompatible Schnittstelle](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html)
- [Healthchecks.io: kostenloser Hobbyist-Tarif mit 20 Jobs und 100 Einträgen](https://healthchecks.io/pricing/)
- [Healthchecks.io: Check-ins, Alerts und E-Mail-Integrationen](https://healthchecks.io/docs/)
- [Tailscale: Personal-Preisplan und Nutzergrenze](https://tailscale.com/pricing)
- [Tailscale Serve: privat im Tailnet und HTTPS](https://tailscale.com/docs/features/tailscale-serve)
- [Tailscale HTTPS-Zertifikate und Certificate Transparency](https://tailscale.com/docs/how-to/set-up-https-certificates)
