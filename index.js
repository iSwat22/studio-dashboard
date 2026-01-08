const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// middleware
app.use(express.json());

// serve static frontend files from /public
app.use(express.static(path.join(__dirname, "public")));

// health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/**
 * TEXT -> IMAGE (Google Imagen via Gemini API)
 * Expects: { prompt: "..." }
 * Returns: { ok: true, images: ["data:image/png;base64,..."] }
 */
app.post("/api/text-to-image", async (req, res) => {
  try {
    const prompt = (req.body.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ ok: false, error: "Prompt is required." });
    }

    const apiKey =
      process.env.GOOGLE_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_AI_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error:
          "Missing Google API key. Set GOOGLE_API_KEY (or GEMINI_API_KEY) in your environment variables.",
      });
    }

    // IMPORTANT:
    // This uses Google's Generative Language API endpoint (Gemini / Imagen).
    // Your project/key must have access to image generation.
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages";

    const r = await fetch(`${endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: prompt,
        // You can tweak these:
        // "imageSize": "1024x1024",
        // "numberOfImages": 1
      }),
    });

    const data = await r.json();

    if (!r.ok) {
      return res.status(400).json({
        ok: false,
        error: data?.error?.message || "Image generation failed.",
        details: data,
      });
    }

    // Response usually contains base64 images
    const imgs =
      data?.generatedImages?.map((x) => x?.bytesBase64Encoded).filter(Boolean) ||
      data?.images?.map((x) => x?.bytesBase64Encoded).filter(Boolean) ||
      [];

    if (!imgs.length) {
      return res.status(500).json({
        ok: false,
        error:
          "No images returned. Your key/project may not have Imagen access yet.",
        details: data,
      });
    }

    // Convert base64 to data URLs so browser can display immediately
    const dataUrls = imgs.map((b64) => `data:image/png;base64,${b64}`);

    res.json({ ok: true, images: dataUrls });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Serve index.html at root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("Server running on port:", PORT);
  console.log(
    "KEY PRESENT:",
    process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY ? "YES" : "NO"
  );
});








 

