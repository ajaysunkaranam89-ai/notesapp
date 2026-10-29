const { Pool } = require("pg");

// Connection settings come only from environment variables, so the same image runs
// locally, in Docker Compose and in Kubernetes (ConfigMap + Secret).
function createPool(env = process.env) {
  const pool = new Pool({
    host: env.DB_HOST || "localhost",
    port: Number(env.DB_PORT || 5432),
    database: env.DB_NAME || "notes",
    user: env.DB_USER || "notes",
    password: env.DB_PASSWORD,
    max: Number(env.DB_POOL_MAX || 5),
    connectionTimeoutMillis: 5000
  });

  // An idle connection that the database drops (restart, failover) emits "error" on the pool.
  // Without this handler Node treats it as unhandled and the whole app crashes.
  pool.on("error", (err) => console.error("idle database connection lost:", err.message));

  return pool;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Creates the table if needed. Retries while the database is still starting,
// which is normal when the app and database start at the same time.
async function initDb(pool, { retries = 30, delayMs = 2000, log = console.log } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS notes (
          id         SERIAL PRIMARY KEY,
          title      VARCHAR(100) NOT NULL,
          body       TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      log("database ready");
      return;
    } catch (err) {
      log(`database not ready (attempt ${attempt}/${retries}): ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
}

module.exports = { createPool, initDb };
