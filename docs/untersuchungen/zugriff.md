# P0-04 – Privater Zugriff und Identität

**Recherche: 2026-10-21. Als Planungsgrundlage freigegeben; keine Implementierung oder Produktionsfreigabe.**

## Empfehlung

Ein Tailscale-Tailnet mit genau zwei Benutzerkonten und Tailscale Serve vor der Next.js-Anwendung. Die beiden Menschen melden sich am Tailscale-Identitätsanbieter an; Geräte werden einzeln freigegeben. Für den Tailnet-Anbieter wird Google als einfacher, bereits unterstützter IdP empfohlen, sofern beide Nutzer dort je ein eigenes Konto haben. Für beide Konten MFA aktivieren, vorzugsweise mit Passkeys. Sonst muss vor Einrichtung ein anderer unterstützter IdP mit derselben MFA-Vorgabe festgelegt werden. Tailscale selbst ist kein Passwortanbieter und übernimmt die Anmeldung an den IdP. Die konkreten beiden Login-Namen sind Betriebsinput und bleiben hier Platzhalter.

Tailscale Serve stellt `https://<server>.<tailnet>.ts.net` mit Tailscales Zertifikat bereit und leitet innerhalb des Tailnets an den lokalen App-Port weiter. MagicDNS und HTTPS-Zertifikate sind dafür erforderlich. Funnel bleibt deaktiviert. Die Tailscale-Dokumentation weist darauf hin, dass Hostnamen im öffentlichen Certificate-Transparency-Log erscheinen; daher vor Aktivierung einen neutralen Servernamen und Tailnet-DNS-Namen wählen. Die Anwendung, Datenbank und SSH erhalten keine öffentliche Freigabe.

## Identität und Autorisierung in der Anwendung

Serve setzt bei Tailnet-Anfragen `Tailscale-User-Login` und weitere Benutzerheader. Vorhandene gleichnamige eingehende Header entfernt Serve zum Schutz vor Spoofing. Der Login-Header ist ein Loginname, keine unveränderliche Subject-ID. Die App akzeptiert ausschließlich die zwei konfigurierten Login-Namen, ordnet sie je einem aktiven Anwendungsbenutzer zu und weist fehlende, unbekannte oder deaktivierte Identitäten geschlossen ab. Rico erhält serverseitig die Admin-Rolle; der zweite Benutzer erhält keine Admin-Rechte. UI-Ausblendungen sind keine Autorisierung.

Falls `identity_subject` in der Benutzertabelle den Serve-Login enthält, ist seine Bedeutung genau dieser aktuelle Loginname. Eine Umbenennung des Kontos sperrt den Zugriff zunächst, bis die Allowlist und die Zuordnung kontrolliert aktualisiert wurden. Sie erzeugt keine neue Person und soll bestehende Bestandszuordnung sowie Verlauf nicht still aufteilen. Login-Namen sind daher für die beiden Benutzer eindeutig zu halten; eine robuste, vom Proxy gelieferte unveränderliche Benutzer-ID steht mit diesen Serve-Headern nicht zur Verfügung.

Kein zusätzliches OIDC-Login in der Anwendung und keine Auth-Bibliothek für diesen Pfad: Serve/Tailscale übernimmt Authentifizierung und HTTPS, während normale TypeScript-Serverfunktionen Headervertrauen, Allowlist, aktiven Benutzer und Rolle prüfen. So entsteht keine zweite Identitätsplattform und keine eigene Kryptografie. Eine Bibliothek wäre neu zu bewerten, falls später echte App-Cookies, ein unabhängiger Login oder standardisierte OIDC-Tokenvalidierung hinzukommen.

Jede geschützte Route, Server Action, API, Datei-, Bild- und Exportausgabe prüft die Identität und erforderliche Rolle serverseitig bei jedem Aufruf. Direkte Upstream-Aufrufe ohne Serve-Header und nicht erlaubte Logins erhalten 401/403. Öffentliche statische Assets enthalten keine Sammlungsbilder, Importe oder Exporte. Private dynamische Antworten dürfen weder statisch erzeugt noch in gemeinsam genutzten Caches gespeichert werden; private Daten kommen auch nicht in den PWA-Offlinecache.

## Vertrauensgrenzen und Netzregeln

- Rico ist einziger Tailscale-Owner; der Bruder ist Member ohne Adminrechte. Nur Rico ist `tagOwner` des Server-Tags. Das ist wichtig, weil ein Owner/Admin Tags auch ohne einzelne Tag-Owner-Regel anwenden kann.
- Next.js lauscht im Container auf `0.0.0.0:3000`, aber nur in einem eigenen Docker-Bridge-Netz mit der App. Compose veröffentlicht diesen Port am Host ausschließlich als `127.0.0.1:3000`; kein Host-Netzwerk, Docker Direct Routing oder gerouteter Bridge-Modus. Docker Engine mindestens Version 28 einsetzen und aktuell halten; laut Docker waren Loopback-Publikationen vor Version 28 im lokalen L2-Netz erreichbar. Host-Firewall blockiert öffentliche App-, DB- und SSH-Ports; SQLite hat keinen veröffentlichten Port.
- Der Upstream kann Serve nicht kryptographisch von einem anderen lokalen Hostprozess unterscheiden. Loopback-Bindung, isoliertes Bridge-Netz und Hostadministration bilden daher die Proxy-Vertrauensgrenze; ein anderer lokaler Prozess mit Zugriff auf den Upstream könnte den Header nachahmen. Serve selbst ersetzt eingehende Identitätsheader mit der wirklichen Tailnet-Identität. App-Zugriff wird zusätzlich über die Allowlist geprüft.
- Die pauschale Tailscale-Default-Allow-Regel wird durch explizite Grants ersetzt: genau die zwei Benutzer dürfen TCP 443 am Server-Tag erreichen. Für Tailscale SSH braucht es zusätzlich sowohl TCP 22 im Grant als auch eine `ssh`-Regel nur für Rico und ein vorhandenes Linux-Konto `deploy` mit sudo. Der Bruder erhält keine Shell. Persönliche Benutzergeräte bleiben nutzerzugeordnet und werden nicht getaggt.
- Device Approval wird vor Geräteaufnahme aktiviert. Neue Geräte bleiben bis zur manuellen Freigabe durch Rico blockiert. Wird ein Gerät verloren, wird es in der Tailscale-Konsole widerrufen; bei möglichem Kontenverlust werden zusätzlich IdP-Sitzungen/Anmeldemittel gesperrt und der Benutzerzugang im Tailnet entzogen. Das schließt die Netzwerkverbindung, beendet aber nicht rückwirkend bereits geladene oder exportierte Daten.
- Bei schreibenden HTTP-Anfragen und Server Actions prüft die Anwendung `Origin` gegen die fest konfigurierte HTTPS-Origin sowie den erwarteten `Host`; sie vertraut dafür nicht blind `Forwarded`-/`X-Forwarded-*`-Headern. Keine Cross-Origin-Freigabe. Mutationen erfolgen nie über GET. Tailscale-Identität allein verhindert keine durch einen Browser ausgelösten Cross-Site-Anfrage.

## Sitzung, Logout und Wiederherstellung

Es gibt in dieser Empfehlung keine eigene Cookie-Sitzung: Serve liefert die Identität pro Anfrage, die App prüft sie pro Anfrage erneut gegen Allowlist und aktiven Benutzer. Setzt Rico einen Benutzer in der Anwendung auf `active=false`, werden seine folgenden App-Anfragen sofort abgewiesen. Für Netzwerkzugriff widerruft er zusätzlich das verlorene Gerät oder entfernt den Benutzer aus dem Tailnet; laufende Requests und bereits geladene Daten werden nicht rückwirkend zurückgeholt. Damit gibt es keine App-Logout-Schaltfläche, die eine Tailnet-Verbindung beendet. Browser schließen ist kein Logout. Zum Beenden des Zugriffs wird Tailscale auf dem jeweiligen Gerät getrennt; zum Abmelden der Geräteidentität wird die Abmeldefunktion des Tailscale-Clients genutzt. Ein späteres Wiederverbinden nach bloßem Trennen ist weiterhin möglich. Auf Geräten sind Bildschirmsperre und IdP-MFA vorausgesetzt.

Rico bleibt einziger Tailnet-Owner und Anwendungsadministrator. Zugriff auf Tailscale, den IdP und das Hetzner-Konto erhält MFA/Passkey; Recovery-Codes werden offline verwahrt. Tailscales dokumentierter Passkey-Admin-Weg ist als unabhängige Wiederherstellungsoption zu prüfen, falls der primäre IdP ausfällt. Bei Ausfall des VPS oder Tailnet-Zugangs bleibt die Hetzner-Konsole der manuelle Wiederherstellungsweg; dort kann Rico den vorhandenen Server prüfen und Tailscale/Firewall reparieren. Es wird kein öffentlicher SSH-Notfallzugang vorgesehen. Zugangsdaten, Recovery-Codes und Schlüssel werden nicht in Repository oder Logs abgelegt.

## Kleiner Prüfplan für P1

1. Von beiden erlaubten Konten auf Desktop, iPhone und Android über Serve mit gültigem HTTPS anmelden; ein drittes Konto und ein nicht freigegebenes Gerät bleiben gesperrt.
2. Verbindungsversuche an öffentlichen App-, DB- und SSH-Ports sowie an den Loopback-Upstream von einem anderen Tailnet-Gerät müssen scheitern. Über Serve als Bruder einen gefälschten Rico-Header senden; die Anfrage muss weiter als Bruder ausgewertet werden und darf keine Adminfunktion öffnen.
3. Pro Server Action, Route Handler sowie Bild-/Datei-/Exportpfad ohne Identität, mit fremder Identität und mit deaktiviertem Benutzer die erwartete Ablehnung prüfen; Rico-only-Aktionen als zweiter Benutzer ablehnen.
4. Schreibende Requests mit falschem/missing Origin, fremdem Host und Cross-Site-Formular ablehnen. GET darf nichts ändern. Prüfen, dass private Seiten/Dateien nicht statisch oder gemeinsam gecacht und nicht offline gespeichert werden.
5. Testgerät in Tailscale widerrufen und prüfen, dass weitere Requests abgewiesen werden; Hetzner-Konsole als dokumentierten Recovery-Zugang erreichen, ohne einen öffentlichen Dienst zu öffnen.

Diese Planung ist kein Sicherheitsbeweis und keine Produktionssicherheitsgarantie. Die Prüfungen sind erst nach den Implementierungspaketen und vor P1-14 auszuführen.

## Geprüfte Primärquellen

- Tailscale, [Serve einschließlich Identitätsheadern und Spoofing-Schutz](https://tailscale.com/docs/features/tailscale-serve), abgerufen 2026-10-21.
- Tailscale, [Tailscale-Identität und Headergrenzen](https://tailscale.com/docs/concepts/tailscale-identity), abgerufen 2026-10-21.
- Tailscale, [Google als IdP](https://tailscale.com/docs/integrations/identity/google-sso) und [unterstützte IdPs/MFA](https://tailscale.com/docs/integrations/identity), abgerufen 2026-10-21.
- Tailscale, [Grants](https://tailscale.com/docs/features/access-control/grants), [Gerätefreigabe](https://tailscale.com/docs/features/access-control/device-management/device-approval) und [Passkey-Admin-Wiederherstellung](https://tailscale.com/docs/reference/tailnet-passkey-admin), abgerufen 2026-10-21.
- Tailscale, [Tailscale SSH und notwendige Netzwerk-/SSH-Regeln](https://tailscale.com/docs/features/tailscale-ssh), [Tags und Tag-Owner](https://tailscale.com/docs/features/tags) sowie [Benutzerrollen](https://tailscale.com/docs/reference/user-roles), abgerufen 2026-10-21.
- Tailscale, [HTTPS-Zertifikate und öffentliches Certificate-Transparency-Log](https://tailscale.com/docs/how-to/set-up-https-certificates), abgerufen 2026-10-21.
- Docker, [Portpublishing und Loopback-Bindung](https://docs.docker.com/engine/network/port-publishing/), abgerufen 2026-10-21.
- Next.js, [Authentifizierung, Autorisierung und serverseitige Prüfungen](https://nextjs.org/docs/app/guides/authentication) sowie [Server Functions](https://nextjs.org/docs/app/getting-started/mutating-data), abgerufen 2026-10-21.
- Hetzner, [VNC-Konsole](https://docs.hetzner.com/cloud/servers/getting-started/vnc-console/) als Zugang zum vorhandenen Server, abgerufen 2026-10-21.
