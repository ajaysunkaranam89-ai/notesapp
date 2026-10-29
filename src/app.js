const express = require("express");
const os = require("os");
const path = require("path");
const { validateNote } = require("./validate");

// state.dbReady is flipped to true by server.js once the table exists.
function createApp(pool, state = { dbReady: true }) {
  const app = express();
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(path.join(__dirname, "..", "public")));

  // Liveness: the process is up. Never touches the database, so a database outage
  // does not make Kubernetes restart healthy app pods.
  app.get("/live", (req, res) => res.json({ status: "alive" }));

  // Readiness: the app can serve traffic only when the database answers.
  app.get("/health", async (req, res) => {
    if (!state.dbReady) return res.status(503).json({ status: "starting", db: "initialising" });
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", db: "up" });
    } catch (err) {
      res.status(503).json({ status: "unavailable", db: "down" });
    }
  });

  app.get("/api/info", (req, res) => {
    res.json({
      pod: os.hostname(),
      dbHost: process.env.DB_HOST || "localhost",
      dbName: process.env.DB_NAME || "notes",
      version: process.env.APP_VERSION || "dev"
    });
  });

  app.get("/api/notes", async (req, res, next) => {
    try {
      const { rows } = await pool.query("SELECT id, title, body, created_at FROM notes ORDER BY id DESC");
      res.json(rows);
    } catch (err) { next(err); }
  });

  app.post("/api/notes", async (req, res, next) => {
    const result = validateNote(req.body);
    if (!result.ok) return res.status(400).json({ error: result.error });
    try {
      const { rows } = await pool.query(
        "INSERT INTO notes (title, body) VALUES ($1, $2) RETURNING id, title, body, created_at",
        [result.value.title, result.value.body]
      );
      res.status(201).json(rows[0]);
    } catch (err) { next(err); }
  });

  app.delete("/api/notes/:id", async (req, res, next) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: "invalid id" });
    try {
      const { rowCount } = await pool.query("DELETE FROM notes WHERE id = $1", [id]);
      if (rowCount === 0) return res.status(404).json({ error: "note not found" });
      res.status(204).end();
    } catch (err) { next(err); }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("request failed:", err.message);
    res.status(500).json({ error: "internal error" });
  });

  return app;
}

module.exports = { createApp };
