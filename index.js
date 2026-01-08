
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Path helpers (for ES Modules) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Middleware ----
app.use(express.json({ limit: "2mb" })); // IMPORTANT: this fixes missing JSON body issues

// Serve your frontend (adjust if your public folder is different)
app.use(express.static(path.join(__dirname, "public")));

// ---- Health check ----
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    keyPresent: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
  });
});

// ---- Text -> Image (Gemini 3 Pro Image) ----
app.post("/api/text-to-image", async (req, res) => {
  try {
    const prompt = (req.body?.prompt || "").trim();
    if (!prompt) {
      return res.status(400).json({ ok: false, error: "Missing prompt" });
    }

    const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing API key. Set GOOGLE_API_KEY (or GEMINI_API_KEY) in Render Environment.",
      });
    }

    // Gemini API endpoint (image generation model)
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";

    const payload = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        imageConfig: {
          // you can change these later
          aspectRatio: "1:1",
          imageSize: "1024",
        },
      },
    };

    const apiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await apiRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "Gemini returned non-JSON response",
        raw: text.slice(0, 400),
      });
    }

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({
        ok: false,
        error: data?.error?.message || data?.error || "Gemini request failed",
        details: data,
      });
    }

    // Find the first inline image in the response
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);

    if (!imagePart) {
      return res.status(500).json({
        ok: false,
        error: "No image returned from model",
        details: data,
      });
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const base64 = imagePart.inlineData.data;

    return res.json({
      ok: true,
      message: "Image generated",
      mimeType,
      base64,
    });
  } catch (err) {
    console.error("text-to-image error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Server error" });
  }
});

// ---- Fallback to index.html ----
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


    
 







 

