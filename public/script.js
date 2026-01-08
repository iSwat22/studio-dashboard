const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 10000;

/* =========================
   Middleware
========================= */
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   Health check
========================= */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* =========================
   TEXT → IMAGE API (TEST MODE)
   This MUST exist or frontend breaks
========================= */
app.post("/api/text-to-image", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    // 🚧 TEMP RESPONSE (until Google Imagen is wired)
    return res.json({
      message: "Text-to-image API working",
      promptReceived: prompt
    });

  } catch (err) {
    console.error("Text-to-image error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* =========================
   Frontend fallback
========================= */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   Start server
========================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


