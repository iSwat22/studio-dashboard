const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Store files on disk
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const unique = Date.now() + "-" + Math.random().toString(36).slice(2);
    cb(null, `${unique}-${safeName}`);
  },
});

const upload = multer({ storage });

// Upload page + list of uploaded files
router.get("/", (req, res) => {
  const files = fs.readdirSync(uploadDir);

  const list = files
    .map((f) => `<li><a href="/uploads/file/${encodeURIComponent(f)}">${f}</a></li>`)
    .join("");

  res.send(`
    <h1>Uploads</h1>

    <form method="POST" action="/uploads" enctype="multipart/form-data">
      <input type="file" name="files" multiple required />
      <button type="submit">Upload</button>
    </form>

    <hr>

    <h3>Files</h3>
    <ul>${list || "<li>No files uploaded yet</li>"}</ul>

    <p><a href="/">Back home</a></p>
  `);
});

// Handle upload
router.post("/", upload.array("files", 20), (req, res) => {
  res.redirect("/uploads");
});

// Serve uploaded file
router.get("/file/:name", (req, res) => {
  const filePath = path.join(uploadDir, req.params.name);
  if (!fs.existsSync(filePath)) return res.status(404).send("File not found");
  res.sendFile(filePath);
});

module.exports = router;
