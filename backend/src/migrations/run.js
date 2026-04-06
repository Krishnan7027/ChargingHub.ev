require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const { rows: executed } = await client.query('SELECT filename FROM migrations ORDER BY id');
    const executedFiles = new Set(executed.map((r) => r.filename));

    const migrationsDir = path.join(__dirname);
    const files = fs.readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (executedFiles.has(file)) {
        console.log(`Skipping (already executed): ${file}`);
        continue;
      }

      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Completed: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Failed: ${file}`, err.message);
        throw err;
      }
    }

    console.log('All migrations complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
