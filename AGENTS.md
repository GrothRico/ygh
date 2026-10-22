# Arbeitsregeln für Coding Agents

## Aktueller Auftrag und Einstieg

Die Implementierung beginnt mit dem ausdrücklich beauftragten P1-01. Aktueller Paketstatus und vorhandene Dateien sind vor jeder Arbeit zu prüfen. Implementiere weitere Pakete erst, wenn der Benutzer sie ausdrücklich beauftragt. Eine Aufgabenliste ist keine pauschale Implementierungsfreigabe.

Lies zuerst `docs/arbeit-mit-llm.md`, den Eintrag des beauftragten Pakets in `docs/aufgaben/README.md`, seine Paketbeschreibung und nur die dort genannten Fachabschnitte. Prüfe danach den tatsächlichen Git- und Dateistand. Übernimm keine erfundenen Dateipfade, APIs oder Testbefehle aus einem Plan als bereits vorhanden.

## Umfang

- Bearbeite genau ein beauftragtes Paket. Starte anschließend nicht automatisch das nächste.
- Erfülle dessen Abnahme vollständig. Halbfertige Platzhalter gelten nicht als Ergebnis.
- Keine zusätzlichen Features, allgemeinen Refactorings, parallelen Agenten oder neuen Dienste ohne ausdrücklichen Auftrag.
- Bei fehlender Voraussetzung, ungeklärtem Sicherheitsvertrag oder nötigem Architekturwechsel: Befund und kleinste nötige Entscheidung nennen; abhängige Implementierung nicht improvisieren.
- Ein günstiges Modell soll Ausführung übernehmen, nicht ungeklärte Architekturentscheidungen verstecken. Auch ein stärkeres Modell darf keine unentschiedenen Punkte als beschlossen behandeln.

## Architektur und Code

- TypeScript, Next.js, SQLite/Drizzle, Docker Compose und Ansible; private Erreichbarkeit über Tailscale.
- Eine Anwendung, eine Datenbank, normale TypeScript-Funktionen für Fachlogik. Kein Event-Sourcing, kein allgemeines Repository-Framework, keine Regel-DSL und keine Microservices.
- Sobald der Anwendungsexport existiert, ihn bei neuen fachlichen Tabellen gezielt ergänzen und prüfen. Keine Geheimnisse exportieren.
- Schematabellen nur für die aktuelle Funktion einführen. Der Schemaentwurf ist kein Auftrag, alle Tabellen vorzubauen.
- Vor neuen Abhängigkeiten vorhandene Mittel prüfen. Nutzen begründen, Version prüfen und Lockfile pflegen. Für Framework-/Dienstwechsel ist eine Entscheidung erforderlich; gewöhnliche notwendige Bibliotheken innerhalb des Pakets brauchen keine zusätzliche Freigaberunde.
- Keine unsicheren Typumgehungen oder deaktivierten Prüfungen zum Erzeugen grüner Builds. Verständliche Namen und kurze Erklärungen für nicht offensichtliche fachliche Regeln.
- Oberfläche deutsch, interne Bezeichner konsistent englisch. Sprache einer Karte nicht aus ihrem Namen ableiten.

## Integrität und Sicherheit

- Physischer Bestand hat genau einen Standort. Teilmengenänderungen und fachlicher Verlauf sind atomar. Mengen nie negativ; Rezeptänderungen bewegen keinen Bestand.
- Deckkarten zählen zur Sammlung des Deckbesitzers; andere Karten einschließlich Cubes nach aktuellem Standort. Zusammen keine Doppelzählung.
- Keine öffentliche Registrierung und keine produktiven Auth-Bypässe. Jede geschützte Serverfunktion prüft Identität und Berechtigung.
- Keine Geheimnisse, Cookies, Tokens oder vollständigen Importdaten in Logs, Git oder Übergaben. Kein Zugriff auf echte Daten für gewöhnliche Tests.
- Keine Bestellung, produktive Ausführung von Ansible, Migration echter Daten oder Veröffentlichung allein aufgrund eines Implementierungspakets. Dafür braucht es einen ausdrücklichen Betriebsauftrag mit Zielsystem.
- Vorhandene Benutzeränderungen erhalten. Keine destruktiven Git-Befehle, keine ungefragten Pushes oder Commits. Keine Testdaten in produktive Bestände schreiben.

## Prüfen und Abschluss

- Verwende dokumentierte Befehle aus `docs/entwicklung.md`, sobald sie in P1-01 eingerichtet wurden. Bis dahin keine erfolgreichen Builds oder Tests behaupten.
- Tests prüfen fachliches Verhalten, nicht bloß Implementierungsdetails. Sicherheits-/Integritätsfehler nicht durch abgeschwächte Assertions verdecken.
- Nach zwei erfolglosen Reparaturversuchen derselben Ursache keine weitere breite Änderungskette: Diagnose, Fehlerausgabe ohne Geheimnisse und offene Entscheidung übergeben. Bereits sichere Teilergebnisse klar benennen.
- Berichte geänderte Dateien, zentrale Logik, tatsächlich ausgeführte Prüfungen mit Ergebnis, manuelle Prüfschritte und offene Grenzen. „Nicht ausgeführt“ ist kein „bestanden“.
- Aktualisiere nur den Status der beauftragten Aufgabe. Selbstprüfung führt zu `Review`, niemals eigenständig zu `Abgenommen`. Ein unabhängiger Review mit Befunden führt zu gezielter Nacharbeit, nicht pauschalem Umbau.
- Arbeitsregeln und Abnahmekriterien nicht ändern, um eine Implementierung nachträglich passend zu machen.

