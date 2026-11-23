const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set before running migrations.');
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS backend_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const directory = path.join(__dirname, '..', 'migrations');
    const migrations = fs
      .readdirSync(directory)
      .filter((name) => /^\d+_.+\.sql$/.test(name))
      .sort();

    for (const name of migrations) {
      await client.query('BEGIN');
      try {
        const applied = await client.query(
          'SELECT 1 FROM backend_migrations WHERE name = $1',
          [name],
        );
        if (applied.rowCount === 0) {
          await client.query(
            fs.readFileSync(path.join(directory, name), 'utf8'),
          );
          await client.query('INSERT INTO backend_migrations (name) VALUES ($1)', [
            name,
          ]);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
