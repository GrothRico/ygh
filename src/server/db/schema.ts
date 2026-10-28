import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  identitySubject: text("identity_subject").notNull().unique(),
  displayName: text("display_name").notNull(),
  active: integer("active", { mode: "boolean" })
    .notNull()
    .default(true),
}, (table) => [
  check("users_active_boolean", sql`${table.active} IN (0, 1)`),
]);
