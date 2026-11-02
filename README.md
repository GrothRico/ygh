# Yu-Gi-Oh Sammlung und Deckbau

Private deutschsprachige Webanwendung für zwei Brüder: rund 15.000 Karten, ihre physischen Standorte, Decks und Cubes. Geplant für Desktop, iPhone und Android über Tailscale.

Vorhanden sind das technische Grundgerüst, Zugriffsschutz, Docker-/Ansible-Werkzeuge, Backup-/Restore-Helfer, CI, eine responsive Anwendungshülle und das Katalogschema. **Kartenverwaltung und Produktivbetrieb sind noch nicht fertig.** Maßgeblich für weitere Aufträge sind [Paketstatus und Freigaben](docs/aufgaben/README.md).

- [Dokumentationsübersicht](docs/README.md): Einstieg und Zuständigkeit jeder Datei.
- [Entwicklung](docs/entwicklung.md): lokale Einrichtung, Prüfungen und Fehlersuche.
- [Betrieb](docs/betrieb.md): vorbereitete Abläufe und offene Live-Prüfungen.
- [Projektspezifikation](docs/projektspezifikation.md): Funktionsumfang und Bestandsregeln.
- [Arbeitsregeln](AGENTS.md), [LLM-Arbeitsweise](docs/arbeit-mit-llm.md) und [Dokumentationsrichtlinien](docs/dokumentationsrichtlinien.md).

Eine TypeScript-/Next.js-Anwendung, SQLite/Drizzle, Docker Compose und Ansible. Privater Zugriff über Tailscale Serve; kein öffentlicher Appzugang. Entscheidungen und Gründe stehen im [Entscheidungsregister](docs/entscheidungen.md), historische Zwischenberichte und Prüfprotokolle sind in der [Dokumentationsübersicht](docs/README.md#belege-und-historie) verlinkt.
