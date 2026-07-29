import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createDatabasePool } from "./database.mjs";

const migrationsDirectory = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);
const pool = createDatabasePool();

async function migrate() {
  const client = await pool.connect();

  try {
    // Filenames form the immutable migration identity and execution order.
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const filenames = (await readdir(migrationsDirectory))
      .filter((filename) => filename.endsWith(".sql"))
      .sort();

    for (const filename of filenames) {
      const alreadyApplied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE filename = $1",
        [filename],
      );

      if (alreadyApplied.rowCount) {
        console.log(`skip ${filename}`);
        continue;
      }

      const sql = await readFile(
        new URL(`../migrations/${filename}`, import.meta.url),
        "utf8",
      );

      // Record a migration only when its complete SQL file commits successfully.
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (filename) VALUES ($1)",
          [filename],
        );
        await client.query("COMMIT");
        console.log(`applied ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

try {
  await migrate();
} catch (error) {
  console.error("Migration failed.", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
