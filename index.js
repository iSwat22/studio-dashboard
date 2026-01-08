const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve frontend files from /public
app.use(express.static(path.join(__dirname, "public")));

// Home route -> loads your dashboard page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Health check
app.get("/health", (req, res) => {
  res.send("OK");
});

// Text -> Image API (placeholder for now)
// This confirms your frontend can call the backend successfully.
// Next step, we replace the placeholder with the real Google image generation call.
app.post("/api/text-to-image", async (req, res) => {
  try {
    const prompt = (req.body?.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // Placeholder response (so it won't crash or 'fail' during setup)
    return res.json({
      ok: true,
      message: "Route works. Next step: connect Google text-to-image.",
      promptReceived: prompt
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log("Server running on port:", PORT);
});








 

