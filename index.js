
const express = require("express");
const app = express();

app.use(express.urlencoded({ extended: true }));

// In-memory storage (temporary). We'll add a database soon.
const projects = [];

// Home
app.get("/", (req, res) => {
  res.send(`🎬 Studio server is running.<br><br>
  Go to <a href="/projects">Projects</a>`);
});

// Projects page with form + list
app.get("/projects", (req, res) => {
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

// Create project (POST from form)
app.post("/projects/create", (req, res) => {
  const name = (req.body.name || "").trim();
  if (!name) return res.status(400).send("Missing project name.");

  const id = Math.random().toString(36).slice(2);
  projects.push({ id, name, createdAt: new Date().toISOString() });

  res.redirect("/projects");
});

// Delete project
app.get("/projects/delete", (req, res) => {
  const id = (req.query.id || "").trim();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx !== -1) projects.splice(idx, 1);
  res.redirect("/projects");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

