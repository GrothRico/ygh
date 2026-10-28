# Yu-Gi-Oh Sammlung und Deckbau

Private Anwendung für zwei Brüder zur Verwaltung von ungefähr 15.000 Karten, ihren physischen Standorten, Decks und Cubes. Bedienung auf Deutsch im Desktop-Browser sowie auf iPhone und Android als installierbare Web-App.

P1-01 bis P1-10 sind abgenommen. P1-11 enthält den lokalen Backupjob und steht nach Implementierung und Prüfungen auf Review. Kein B2-Konto, echter Zielhost, Timerlauf oder Restore wurde eingerichtet beziehungsweise ausgeführt. Kartenverwaltung und Produktivbetrieb sind noch nicht fertig; den Wiedereinstieg beschreibt der [Zwischenbericht](docs/zwischenbericht-2026-10-22.md).

## Projektdokumentation

- [Projektspezifikation](docs/projektspezifikation.md): Funktionsumfang, verbindliche Regeln, technische Architektur, Sicherheit und Betrieb.
- [Datenmodell](docs/datenmodell.md): Tabellen, Beziehungen und konkrete Abläufe.
- [Meilensteine](docs/meilensteine.md): Umsetzungsschritte mit überprüfbaren Abnahmekriterien und offenen Untersuchungen.
- [Arbeitsablauf mit einem LLM](docs/arbeit-mit-llm.md): kleine Einzelaufträge, Review und fertige Start-/Reviewprompts.
- [Aufgabenindex](docs/aufgaben/README.md): getrennte Arbeitspakete für alle Meilensteine, jeweils mit Abhängigkeiten und Abnahme.
- [Arbeitsregeln für Agents](AGENTS.md): verbindliche Grenzen für Umfang, Sicherheit und Abschluss.
- [Entscheidungsregister](docs/entscheidungen.md): beschlossene Architektur und noch zu klärende technische Verträge.
- [Entwicklungsprüfungen](docs/entwicklung.md): lokale Einrichtung, Befehle und Prüfmatrix.

## Umsetzung starten

Ein günstiges Coding-Modell bekommt jeweils genau eine Paket-ID aus dem Aufgabenindex. Zuerst werden die offenen technischen Verträge in P0 geklärt; anschließend folgt die Implementierung in kleinen Schritten. Die Planung allein autorisiert keine Implementierung, Bestellung oder produktive Ausführung. Der Aufgabenindex unterscheidet geplante, laufende und geprüfte Pakete.

## Technische Richtung

TypeScript, Next.js, SQLite mit Drizzle, Docker Compose und Ansible auf einem gemieteten Linux-VPS. Zugriff ausschließlich privat über Tailscale. Planungswahl ist Hetzner CX23 mit IPv4 und externem Backup, grob 7,21 € pro Monat bei den dokumentierten Annahmen. Bestellung erfolgt manuell; Details stehen im Entscheidungsregister.

Eine Anwendung, eine Datenbank und wenige Dienste. Fachlogik bleibt in normalen TypeScript-Modulen. Keine Microservices, kein Kubernetes, keine allgemeine Regelmaschine und keine automatisierte Yu-Gi-Oh!-Spielengine.

Stand: 27. Oktober 2026; P1-10 abgenommen, P1-11 im Review.
