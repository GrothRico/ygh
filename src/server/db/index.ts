import "server-only";

import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

export function openDatabase(databasePath: string) {
  const sqlite = new Database(databasePath);
  sqlite.pragma("foreign_keys = ON");

  return {
    db: drizzle(sqlite, { schema }),
    close: () => sqlite.close(),
  };
}
