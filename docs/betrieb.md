# Betrieb und offene Betriebsabnahme

Stand mit Code und Freigaben abgeglichen: 2. November 2026. **Es gibt noch keinen eingerichteten Zielserver und keinen Betriebsauftrag.** Die folgenden Abläufe beschreiben die implementierten Werkzeuge und die spätere manuelle Einrichtung. Sie sind keine Ausführungsfreigabe. Paketstatus: [Aufgabenindex](aufgaben/README.md); verbindliche Architekturentscheidungen: [E03/E04/E06](entscheidungen.md); historische Nachweise: [Prüfchronik](historie/pruefprotokolle-p1.md).

## Ziel und Voraussetzungen

Geplant ist ein manuell bestellter Hetzner-VPS mit Ubuntu 26.04 LTS amd64. Anbieter, Kosten und externe Konten vor Bestellung anhand des freigegebenen Rahmens prüfen. Das Ansible-Beispielinventory enthält reservierte Beispielwerte. Echte Logins, Hostname, Image-ID, Prüfsummen und Inventories gehören in ignorierte Dateien; Geheimnisse über Ansible Vault und geschützte Laufzeitdateien, niemals in Git.

Persönliches Gerät mit Tailscale → privates HTTPS über Serve → Host-Loopback TCP/3000 → unprivilegierter App-Container → SQLite im lokalen Volume. Kein Funnel, kein öffentlicher App-/DB-Port. Die zwei Nutzer dürfen TCP/443 erreichen, Rico zusätzlich TCP/22 und Tailscale SSH als `deploy` mit sudo. Persönliche Geräte bleiben ungetaggt. Die App prüft bei jeder geschützten Operation aktive Benutzerzuordnung und erforderliche Rechte; der lokale Host bleibt Teil der Vertrauensgrenze.

## Einrichtung in Reihenfolge

1. Zielhost, Kosten und Betriebsauftrag festlegen. IdP-, Tailscale- und Anbieter-Konten mit MFA/Passkeys und unabhängig verwahrten Recovery-Codes absichern. Echte Werte aus `infra/ansible/inventory/hosts.example.yml` in ein ignoriertes Inventory übernehmen. SSH-Hostfingerprint über einen vertrauenswürdigen Weg prüfen.
2. `render-tailnet-policy.yml` lokal rendern und die vollständige Policy prüfen. Der Operator wendet sie in Tailscale an; keine pauschale Default-Freigabe daneben belassen. MagicDNS, HTTPS und Device Approval konfigurieren. Ein neutraler Hostname berücksichtigt öffentlich sichtbare Zertifikatsnamen.
3. `bootstrap.yml` richtet Host/Docker/Adminzugang ein, `install-tailscale.yml` installiert den Daemon. Enrollment ist manuell: `tailscale up --ssh --advertise-tags=tag:ygh-server`, danach Gerät genehmigen. Frische Tailscale-SSH-Verbindung und sudo prüfen. Erst dann `finalize-firewall.yml` und `configure-serve.yml`; unbekannte Serve-/Funnel-Zustände dürfen nicht ungeprüft zurückgesetzt werden. Anbieter-Konsole bleibt Recoveryweg.
4. `configure-logging.yml` vor dem App-Deployment anwenden. Wirksame journald-Konfiguration, Rotation und Logausgabe prüfen. Wiederholung der Einrichtung auf dem freigegebenen Host auf unerwartete Änderungen prüfen.
5. Geprüftes Image bereitstellen und `deploy.yml` kontrolliert ausführen. Bei bewusster Erstinitialisierung `ygh_initialize_new_database: true`, danach wieder `false`. Anschließend Backup-/Alarmkonten und Recovery-Unterlagen einrichten, Backup und Restore praktisch abnehmen.

Ansible-Pins und reine lokale Syntaxprüfungen stehen in [Entwicklung](entwicklung.md#ansible-lokal-prüfen). Diese Übersicht ersetzt nicht die Zielhostprüfung und die Prüfung des tatsächlichen Inventories vor jeder Ausführung.

## Image, Deployment und Migration

Lokales Release-Artefakt erzeugen (kein Serverzugriff):

```sh
docker build --platform linux/amd64 -t ygh:release-001 .
docker image inspect --format '{{.Id}}' ygh:release-001
docker save --output /tmp/ygh-image.tar ygh:release-001
shasum -a 256 /tmp/ygh-image.tar
```

Tag pro Release bewusst wählen. Tarball, SHA-256 und unveränderliche Image-ID zusammen dokumentieren. Das exakte Archiv samt Prüfsumme unabhängig von VPS und Backupziel aufbewahren: ein Neubau aus gleichem Quellstand garantiert keine identische Image-ID. Der Server braucht weder Registry- noch Git-Zugang.

`deploy.yml` prüft Archiv und Image, stoppt den Dienst und hält den gemeinsamen Wartungs-Lock über Migration und Wiederanlauf. Der DB-Helper sichert eine vorhandene Datenbank konsistent im Datenvolume und prüft ihre Integrität vor der Migration. Fehler lassen die App gestoppt; kein automatischer Image-/Datenbankrollback. Die lokale Vor-Migrationskopie ersetzt kein externes Backup. Fehlende DB ohne explizite Erstinitialisierung wird abgelehnt. Nur die Erstinitialisierung legt die beiden Benutzer an; bestehende Sperrwerte bleiben erhalten. Deployments nacheinander durchführen.

## Katalogspeicher und automatische Aktualisierung

Katalog und Bildcache liegen serverseitig im persistenten Docker-Datenvolume `ygh-app-data`, das unter `/data` eingebunden ist. Die SQLite-Datei `/data/collection.sqlite` enthält Karten, Sets, bestätigte Varianten und Drucke, unbestätigte Quellbeobachtungen, den Status des letzten Katalogimports sowie die vier vollständigen JSON-Antwortdokumente des letzten erfolgreichen Imports. Diese Dokumente bleiben als einzelne aktuelle Snapshots erhalten, nicht als Verlauf; unbekannte Antwortfelder und Einträge ohne englische Zuordnung bleiben darin verfügbar. Sie liegen im SQLite-Datenvolume und damit in der normalen Datenbanksicherung. Suche und Oberfläche lesen weiterhin nur normalisierte Katalogfelder. JPG-Dateien liegen getrennt unter `/data/card-images/`. Die Anwendung nutzt dafür keinen Browser-`localStorage`; die Suche liest Katalogzeilen aus SQLite und normalisiert sowie bewertet die Treffer in TypeScript. Sie begrenzt die Antwort auf 30 Treffer. Für Bilder löst die geschützte Route die Karten-ID erst über den Katalog auf und liefert dann eine vorhandene Cachedatei aus.

Implementiert sind ein Hostrunner, systemd-Service/Timer und das separate Playbook `infra/ansible/configure-catalog-update.yml`. Das Playbook wird von keinem anderen Playbook automatisch aufgerufen und wurde nicht auf einem Zielhost angewendet. Auf einem ausdrücklich freigegebenen Host richtet es den Timer für sonntags 06:00 UTC mit bis zu zehn Minuten zusätzlicher Verzögerung ein; `Persistent=true` lässt einen verpassten Lauf nachholen. Der Service wartet höchstens zwölf Stunden und schreibt CLI-Zusammenfassungen, Fortschritt sowie generische Wrappermeldungen ins Journal. Er lädt weder ein Image noch stoppt er die App.

Der Runner verwendet den gemeinsamen Wartungs-Lock `/run/lock/ygh-maintenance.lock`, den auch Backup und Deployment halten. Ist er belegt, protokolliert der Kataloglauf einen Skip und beendet sich ohne Docker-/Provider-Aufruf. Andernfalls findet er genau einen laufenden Compose-Appcontainer, liest dessen unveränderliche Image-ID und `/data`-Volume aus und startet daraus einen kurzlebigen Container: UID/GID 1000, keine Linux-Capabilities, `no-new-privileges`, schreibgeschütztes Root-Dateisystem, kleines temporäres `/tmp`, nur das notwendige Datenvolume und das vorhandene private App-Netzwerk für HTTPS. Docker darf kein Image nachladen. Der Runner gibt keine Anwendungs- oder Backupgeheimnisse weiter und veröffentlicht keine Ports. Der Worker wird beim Erfolg oder regulären Fehler unter gehaltenem Lock entfernt. Nach einem harten Prozessabbruch vor der Trap-Ausführung den markierten Worker (`com.ygh.maintenance=catalog-update`) erst prüfen und gezielt entfernen, wenn er sicher nicht mehr arbeitet; gegebenenfalls zusätzlich den Bildimport-Sperrmarker nach den [Entwicklungsanweisungen](entwicklung.md#kartensuche-und-bilder) prüfen.

Der Worker führt zuerst denselben vollständigen DE-/EN-Katalogimport samt Setliste und Versionsstand aus. Ein Fehler dabei lässt den bisherigen Katalog unverändert und verhindert Bildabrufe gegen unvollständige Metadaten. Erst nach erfolgreichem Metadatenimport startet der Bildimport. Scheitert dieser, bleiben die aktualisierten Metadaten und zuvor erfolgreich geladene JPGs erhalten; sie werden nicht zurückgerollt. Die wöchentliche Synchronisierung aktualisiert die von der Quelle gelieferten Felder; sie garantiert weder alle verfügbaren API-Felder, alle Varianten/Drucke noch vollständige oder korrigierte Artworks. Der Bildimport ergänzt nur fehlende gültige JPGs. Bereits gültige Cachedateien werden übersprungen; Änderungen eines Anbieterbildes unter derselben ID werden nicht automatisch erkannt. Ein erster Lauf kann mehrere Stunden dauern und hält dabei den Wartungs-Lock, blockiert also Backup und Deployment, während die App weiterläuft. Der Bildcache ist regenerierbar und bleibt wie bisher außerhalb des Backups.

Die Installation ist ein eigener, bewusster Betriebsschritt nach Bereitstellung eines passenden Images und auf einem freigegebenen Zielhost; dieses Implementierungspaket führt kein Ansible aus. Nach dem freigegebenen Setup lässt sich ein Lauf über `systemctl start ygh-catalog-update.service` manuell anstoßen; auch dieser Weg verwendet denselben Wartungs-Lock. Timer und Service lassen sich auf dem Zielhost mit `systemctl list-timers ygh-catalog-update.timer`, `systemctl status ygh-catalog-update.service` und `journalctl -u ygh-catalog-update.service` prüfen.

## Logs, Backups und Alarme

Die Parameter und ihre Begründung stehen verbindlich in [E06](entscheidungen.md#e06--sicherung-und-betriebsprüfung). Implementierung: `configure-logging.yml`, `configure-backup.yml`, Vorlagen unter `infra/ansible/templates/`, Helper unter `infra/ansible/files/` und `scripts/`.

- Die produktive Compose-Vorlage schreibt nach journald. Zeit- und Größenlimits können die tatsächlich verfügbare Historie verkürzen. Separate apt-/cloud-init-Dateilogs bleiben unter logrotate und sind kein Teil des externen Journalarchivs. Lokale tailscaled-Logs sind kein zentrales Konfigurationsaudit.
- Der tägliche Job stoppt die App kurz, erstellt einen SQLite-/Importdateisnapshot und startet denselben Container vor Manifestabschluss und Upload wieder. Backup und Deployment verwenden denselben Lock. Ein Shell-Trap kann Stromausfall oder SIGKILL nicht reparieren.
- Restic sichert Appdaten und das abgeschlossene UTC-Journalfenster getrennt verschlüsselt. Exit 0 bedeutet vollständigen Erfolg, 1 Backup-/Prüffehler, 2 fehlgeschlagenen Wiederanlauf der App. Restic Exit 3 gilt als unvollständig und wird nicht als Erfolg gemeldet. Fehler verhindern anschließende Retention.
- Ziel ist Backblaze B2 EU Central in Amsterdam, getrennt vom geplanten deutschen VPS. Das ist noch nicht eingerichtet. Der normale Sicherungsschlüssel benötigt für Bereinigung Löschrechte; diese Lösung verspricht keine unveränderliche Sicherung bei kompromittierten Zugangsdaten.
- Healthchecks.io erhält Host-/App-Check-ins und Backupzustand. Empfänger wird im Anbieter-Konto eingerichtet. Der Liveness-Endpunkt prüft nur die Erreichbarkeit des App-Prozesses; Freiplatz wird zusätzlich geprüft. Ein VPS-Totalausfall wird extern durch ausbleibende Signale erkannt. Echte Zustellung ist noch nicht getestet.

Vor der ersten Einrichtung B2-Adresse, Restic-Passwort, bucket-beschränkten Sicherungsschlüssel und unabhängige Recoverykopie bereitstellen. `configure-backup.yml` aktiviert den Timer, initialisiert aber kein Repository. Bei Ersteinrichtung Timer zunächst anhalten, ein ausdrücklich neues Repository kontrolliert initialisieren, anschließend einen manuellen Job prüfen und Timer bewusst wieder starten. Bei bestehendem Repository nicht erneut initialisieren.

Laufzeitdateien `/etc/ygh/backup.env`, `alarms.env` und die manuell bereitgestellte `restore.env` sind root-eigen mit Modus 0600. **Systemd-EnvironmentFiles niemals per `source` oder `.` als Shellcode laden.** Die dokumentierten administrativen Aufrufe verwenden systemd zum Einlesen der Werte; konkrete Beispiele bleiben im [Backup-Prüfprotokoll](historie/pruefprotokolle-p1.md#p1-11-verschlüsselter-backupjob) nachvollziehbar.

Retention ist standardmäßig deaktiviert. Zuerst den root-only Bericht von `ygh-backup --retention-dry-run` über die konfigurierte systemd-Umgebung prüfen: Host, stabile Quellpfade, Tags und Löschvorschläge. Erst danach `ygh_backup_retention_enabled: true` konfigurieren. Monatlicher Lesetest und Check nach Prune sind Repositoryprüfungen, kein Ersatz für Restore.

## Isolierter Restore-Test

Initial und danach vierteljährlich manuell auf isoliertem Ziel durchführen. Dort keine App, Timer, Heartbeats, Serve, Produktionszugriffe oder B2-Schreibschlüssel aktivieren. Externe Schreib-/Pruneläufe vorher pausieren: der lokale Wartungs-Lock koordiniert keine anderen Rechner; Restic arbeitet für den lesenden Schlüssel ohne Repository-Lock.

Repositoryadresse, Restic-Passwort, separaten lesenden B2-Schlüssel sowie exakten Image-Tarball/Prüfsumme aus unabhängiger Verwahrung bereitstellen. Image nach Prüfsummenabgleich laden. Restorewrapper und Verifier mit Docker/Restic bereitstellen; keine vollständige Produktionskonfiguration deployen. `restore.env` enthält `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.

Beispiel erst nach Betriebsfreigabe, Platzhalter bewusst ersetzen:

```sh
sudo systemd-run --wait --pipe \
  -p EnvironmentFile=/etc/ygh/restore.env \
  /usr/local/sbin/ygh-restore-check \
  --snapshot <restic-snapshot-id> \
  --target /var/lib/ygh/restores/restore-<eindeutige-id>
```

Das Ziel muss neu oder leer sein. Wrapper und Verifier lehnen unzulässige Pfade ab und prüfen Image-ID, Manifest, Migrationshistorie, SQLite-Integrität sowie Importdateien. Keine Migration, kein Image-Download und kein Start der App erfolgen automatisch. Unvollständige Restores bleiben zur Diagnose liegen. Fachliche Kartenmengen müssen ergänzt werden, sobald ein Bestandsschema existiert; bisher wurden synthetische Nutzer und Importdateien geprüft.

Ergebnis ohne Geheimnisse oder Sammlungsinhalte protokollieren. Nur das bewusst gewählte Testziel bereinigen; anschließend pausierte Quelljobs wieder aktivieren. Ein Produktiv-Datenpfadwechsel nach einem Schaden erfordert einen gesonderten Wiederherstellungsauftrag.

## Offene Betriebsabnahme P1-14

Diese Liste benennt offene Nachweise, keine erledigten Maßnahmen:

- Reale Hosteinrichtung und Wiederholung ohne Datenverlust; Docker/journald/systemd-/Backupintegration und wirksame Zeitpläne.
- Erlaubte Desktop-/Smartphonezugriffe über Tailscale und HTTPS; Ablehnung fremder/gesperrter Identität, Serve-Headerersetzung und Gerätewiderruf.
- Öffentliche IPv4-/IPv6-Unerreichbarkeit von App/DB/SSH, kein direkter Upstreamzugriff, kein Funnel; frischer Adminzugang und Wiederherstellung über Anbieter-Konsole.
- Echte B2-Sicherung, geprüfter Retention-Dry-run, Zielausfall und App-Wiederanlauf im Fehlerfall.
- Externe Alarm- und E-Mail-Zustellung einschließlich ausbleibender Heartbeats bei Hostausfall; Speichergrenzen synthetisch prüfen statt echte Platte zu füllen.
- Unabhängige Schlüssel-/Imageverwahrung und vollständiger Restore aus dem echten externen Repository auf isoliertem Ziel.
- Safari/WebKit sowie echte iPhone-/Android-Installation und erneuter Start der PWA. Der bisherige WebKit-Versuch war kein bestandener Test.

Vor echten Sammlungsdaten sind diese Gates erforderlich. Reale Collectr-Migration benötigt zusätzlich die Freigabe von P0-02 und den Dateinachweis P3-05. Eine Paketabnahme der implementierten Hilfsmittel ersetzt diese Betriebsabnahme nicht.
