const express = require("express");
const app = express();

// Simple in-memory storage for now (we'll add a database later)
const projects = [];

// Home
app.get("/", (req, res) => {
  res.send(`🎬 Studio server is running.<br><br>
  Go to <a href="/projects">/projects</a>`);
});

// List projects
app.get("/projects", (req, res) => {
  const list = projects
    .map((p, i) => `<li>${i + 1}. ${p.name} (created: ${p.createdAt})</li>`)
    .join("");

  res.send(`
    <h1>Projects</h1>
    <p>Create one by going to: <code>/projects/new?name=Genesis%20Part%201</code></p>
    <ul>${list || "<li>No projects yet</li>"}</ul>
    <p><a href="/">Back home</a></p>
  `);
});

// Create a new project
app.get("/projects/new", (req, res) => {
  const name = (req.query.name || "").trim();
  if (!name) return res.status(400).send("Missing project name. Use ?name=Your%20Project");

  projects.push({ name, createdAt: new Date().toISOString() });
  res.redirect("/projects");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
