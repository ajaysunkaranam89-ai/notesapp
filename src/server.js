const { createPool, initDb } = require("./db");
const { createApp } = require("./app");

const PORT = Number(process.env.PORT || 3000);
const pool = createPool();
const state = { dbReady: false };
const app = createApp(pool, state);

// Start listening immediately so /live answers while the database is still coming up;
// /health stays 503 (not ready) until the table exists.
const server = app.listen(PORT, () => console.log(`notes-app listening on ${PORT}`));

initDb(pool)
  .then(() => { state.dbReady = true; })
  .catch((err) => {
    console.error("giving up on the database:", err.message);
    process.exit(1);
  });

// Kubernetes sends SIGTERM when a pod stops: finish requests, close the pool, exit.
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
