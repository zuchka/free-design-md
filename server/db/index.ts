import * as schema from "./schema.js";
import { drizzle } from "drizzle-orm/libsql";
import { getDbExec } from "./client.js";

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!database) database = drizzle(getDbExec(), { schema });
  return database;
}

export { getDbExec } from "./client.js";
export { schema };
