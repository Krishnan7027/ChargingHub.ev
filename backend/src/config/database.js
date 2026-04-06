const { Pool } = require('pg');
const env = require('./env');

// Support DATABASE_URL (Render, Heroku, Railway, Neon) or individual vars
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: env.db.host,
      port: env.db.port,
      database: env.db.name,
      user: env.db.user,
      password: env.db.password,
      ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

// Connection health check
async function checkConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    return { connected: true, timestamp: result.rows[0].now };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  checkConnection,
};
