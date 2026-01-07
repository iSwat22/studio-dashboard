const express = require("express");
const router = express.Router();

// In-memory storage (temporary). We'll add a database later.
const projects = [];

// List projects + form
router.get("/", (req, res) => {
  const list = projects
    .map(
      (p, i) =>
        `<li>
          <b>${p.name}</b>
          <small>(created: ${p.createdAt})</small>
          — <a href="/projects/delete?id=${p.id}" onclick="return confirm('Delete this project?')">Delete</a>
        </li>`
    )
    .join("");

  res.send(`
    <h1>Projects</h1>

    <form method="POST" action="/projects/create">
      <label>Project name:</label><br>
      <input name="name" type="text" placeholder="My Next Movie" style="width: 320px; padding: 8px;" required />
      <button type="submit" style="padding: 8px 12px; margin-left: 8px;">Create Project</button>
    </form>

    <hr>

    <ul>${list || "<li>No projects yet</li>"}</ul>

    <p><a href="/">Back home</a></p>
  `);
});

// Create project
router.post("/create", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).send("Missing project name.");

  const id = Math.random().toString(36).slice(2);
  projects.push({ id, name, createdAt: new Date().toISOString() });

  res.redirect("/projects");
});

// Delete project
router.get("/delete", (req, res) => {
  const id = (req.query.id || "").trim();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx !== -1) projects.splice(idx, 1);
  res.redirect("/projects");
});

module.exports = router;

