import "server-only";

import { Pool, type PoolClient, type QueryResultRow } from "pg";

declare global {
  var roomBookerDatabasePool: Pool | undefined;
}

let productionPool: Pool | undefined;

function createPool() {
  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "true" ? true : undefined,
  });
}

export function getDatabasePool() {
  if (process.env.NODE_ENV === "production") {
    productionPool ??= createPool();
    return productionPool;
  }

  globalThis.roomBookerDatabasePool ??= createPool();
  return globalThis.roomBookerDatabasePool;
}

export async function query<Row extends QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
) {
  return getDatabasePool().query<Row>(text, [...values]);
}

export async function withTransaction<Result>(
  work: (client: PoolClient) => Promise<Result>,
) {
  const client = await getDatabasePool().connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
