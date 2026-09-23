import * as schema from "./schema.js";
import { drizzle } from "drizzle-orm/postgres-js";
import { getQueryClient } from "./client.js";

let database: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!database) database = drizzle(getQueryClient(), { schema });
  return database;
}

export { getDbExec, getQueryClient } from "./client.js";
export { schema };
