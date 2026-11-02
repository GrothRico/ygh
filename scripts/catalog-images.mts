import { CatalogImagesError, syncCatalogImageCache } from "../src/server/catalog/image-cache.ts";

function databasePathFromEnvironment(): string {
  const databasePath = process.env.DATABASE_PATH;
  if (!databasePath || !databasePath.startsWith("/")) {
    throw new CatalogImagesError("invalid_database_path");
  }
  return databasePath;
}

async function run(): Promise<void> {
  const [command, ...extraArguments] = process.argv.slice(2);
  if (command !== "sync" || extraArguments.length > 0) {
    console.error("Verwendung: npm run catalog:images -- sync");
    process.exitCode = 2;
    return;
  }

  try {
    const databasePath = databasePathFromEnvironment();
    const result = await syncCatalogImageCache(databasePath, {
      onProgress: (processed, total) => {
        if (processed % 500 === 0 || processed === total) {
          console.log(`Bilder geprüft: ${processed}/${total}`);
        }
      },
    });
    console.log(`Bildcache fertig: ${result.downloaded} geladen, ${result.cached} bereits vorhanden, ${result.unavailable} beim Anbieter nicht verfügbar.`);
  } catch (error) {
    const errorCode = error instanceof CatalogImagesError ? error.errorCode : "image_import_failed";
    if (errorCode === "provider_blocked") {
      console.error("Der Anbieter hat den Abruf abgelehnt oder begrenzt. Der Lauf wurde gestoppt; nach Prüfung später erneut starten.");
    } else if (errorCode === "image_import_locked") {
      console.error("Ein Bildimport läuft bereits oder ein alter Sperrmarker ist vorhanden. Prozess prüfen, dann gegebenenfalls den dokumentierten Sperrmarker entfernen.");
    } else if (errorCode === "invalid_database_path" || errorCode === "image_import_failed") {
      console.error("Katalogdatenbank nicht verfügbar. DATABASE_PATH und vorhandene Katalogmigration prüfen.");
    } else if (errorCode === "image_cache_write_failed" || errorCode === "image_import_unavailable") {
      console.error("Bildcache nicht verfügbar. Verzeichnis, Berechtigungen und freien Speicher prüfen; erfolgreiche Dateien bleiben erhalten.");
    } else if (errorCode === "network_error" || errorCode === "provider_error") {
      console.error("Bildanbieter nicht verfügbar. Lauf gestoppt; Verbindung prüfen und später manuell fortsetzen.");
    } else if (errorCode === "invalid_image_response") {
      console.error("Bildanbieter lieferte einen ungültigen oder zu großen Inhalt. Lauf gestoppt; nicht automatisch erneut versuchen.");
    } else {
      console.error(`Bildimport fehlgeschlagen (${errorCode}). Bereits geschriebene Dateien bleiben erhalten; nach Fehlerbehebung erneut starten.`);
    }
    process.exitCode = 1;
  }
}

await run();
