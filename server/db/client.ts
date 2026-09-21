import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

let client: Client | null = null;

function databaseUrl(): string {
  return process.env.DATABASE_URL?.trim() || "file:./data/app.db";
}

function ensureLocalDirectory(url: string) {
  if (!url.startsWith("file:")) return;
  const filePath = url.slice("file:".length);
  const directory = path.dirname(path.resolve(filePath));
  mkdirSync(directory, { recursive: true });
}

export function getDbExec(): Client {
  if (client) return client;
  const url = databaseUrl();
  ensureLocalDirectory(url);
  client = createClient({
    url,
    authToken: process.env.DATABASE_AUTH_TOKEN?.trim() || undefined,
  });
  return client;
}

export function resetDbClientForTests() {
  client?.close();
  client = null;
}
