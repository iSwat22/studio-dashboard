const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "public")));

// Home route → loads public/index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Health check (optional)
app.get("/health", (req, res) => {
  res.send("OK");
});

// Start server
app.listen(PORT, () => {
  console.log("Server running on port:", PORT);
});



 

