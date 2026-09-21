import "dotenv/config";
import { migrateDatabase } from "../server/db/migrate.js";

await migrateDatabase();
console.log("Database schema is ready.");
