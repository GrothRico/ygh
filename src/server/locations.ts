import "server-only";

import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { openDatabase } from "./db";

export type LocationKind = "unknown" | "folder";
export type LocationRow = { id: string; name: string; kind: LocationKind; parentId: string | null };

type LocationInput = { id: string; name: string; kind: LocationKind; parent_id: string | null };

export class LocationError extends Error {
  constructor(readonly code: "invalid_name" | "parent_missing" | "parent_invalid" | "cycle" | "root_protected" | "not_empty" | "location_missing") {
    super(code);
    this.name = "LocationError";
  }
}

function withDatabase<T>(databasePath: string, operation: (database: Database.Database) => T): T {
  const connection = openDatabase(databasePath);
  try { return operation(connection.db.$client); }
  finally { connection.close(); }
}

function normalizedName(value: string): string {
  if (typeof value !== "string") throw new LocationError("invalid_name");
  const name = value.trim();
  if (name.length < 1 || name.length > 100) throw new LocationError("invalid_name");
  return name;
}

function transaction<T>(database: Database.Database, operation: () => T): T {
  return database.transaction(operation).immediate();
}

function getLocation(database: Database.Database, id: string): LocationInput | undefined {
  return database.prepare("SELECT id, name, kind, parent_id FROM locations WHERE id = ?").get(id) as LocationInput | undefined;
}

function assertFolderParent(database: Database.Database, parentId: string | null): void {
  if (parentId === null) return;
  const parent = getLocation(database, parentId);
  if (!parent) throw new LocationError("parent_missing");
  if (parent.kind !== "folder" && parent.kind !== "unknown") throw new LocationError("parent_invalid");
}

export function listLocations(databasePath: string): LocationRow[] {
  return withDatabase(databasePath, (database) => database.prepare(`
    SELECT id, name, kind, parent_id AS parentId
    FROM locations
    ORDER BY name COLLATE NOCASE, id
  `).all() as LocationRow[]);
}

export function createLocation(databasePath: string, nameInput: string, parentId: string | null): string {
  const name = normalizedName(nameInput);
  return withDatabase(databasePath, (database) => transaction(database, () => {
    assertFolderParent(database, parentId);
    const id = randomUUID();
    database.prepare("INSERT INTO locations (id, name, kind, parent_id) VALUES (?, ?, 'folder', ?)").run(id, name, parentId);
    return id;
  }));
}

export function renameLocation(databasePath: string, id: string, nameInput: string): void {
  const name = normalizedName(nameInput);
  withDatabase(databasePath, (database) => transaction(database, () => {
    if (!getLocation(database, id)) throw new LocationError("location_missing");
    database.prepare("UPDATE locations SET name = ? WHERE id = ?").run(name, id);
  }));
}

export function moveLocation(databasePath: string, id: string, parentId: string | null): void {
  withDatabase(databasePath, (database) => transaction(database, () => {
    const location = getLocation(database, id);
    if (!location) throw new LocationError("location_missing");
    if (location.kind === "unknown") throw new LocationError("root_protected");
    assertFolderParent(database, parentId);
    if (id === parentId) throw new LocationError("cycle");
    if (parentId !== null) {
      const descendant = database.prepare(`
        WITH RECURSIVE descendants(id) AS (
          SELECT id FROM locations WHERE parent_id = ?
          UNION ALL
          SELECT child.id FROM locations child JOIN descendants d ON child.parent_id = d.id
        ) SELECT 1 AS found FROM descendants WHERE id = ? LIMIT 1
      `).get(id, parentId);
      if (descendant) throw new LocationError("cycle");
    }
    database.prepare("UPDATE locations SET parent_id = ? WHERE id = ?").run(parentId, id);
  }));
}

export function deleteLocation(databasePath: string, id: string): string | null {
  return withDatabase(databasePath, (database) => transaction(database, () => {
    const location = getLocation(database, id);
    if (!location) throw new LocationError("location_missing");
    if (location.kind === "unknown") throw new LocationError("root_protected");
    if (database.prepare("SELECT 1 FROM locations WHERE parent_id = ? LIMIT 1").get(id) || database.prepare("SELECT 1 FROM stock WHERE location_id = ? LIMIT 1").get(id)) throw new LocationError("not_empty");
    database.prepare("DELETE FROM locations WHERE id = ?").run(id);
    return location.parent_id;
  }));
}
