import nextEnvironment from "@next/env";
import pg from "pg";

const { loadEnvConfig } = nextEnvironment;

// Standalone scripts load the same .env files and precedence rules as Next.js.
loadEnvConfig(process.cwd());

const { Pool } = pg;

export function createDatabasePool() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env.local and update it.",
    );
  }

  return new Pool({
    connectionString,
    // Local development stays plaintext; hosted PostgreSQL can require TLS.
    ssl: process.env.DATABASE_SSL === "true" ? true : undefined,
  });
}
