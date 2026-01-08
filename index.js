// index.js (FULL FILE - COPY/PASTE ALL OF THIS)

const express = require("express");
const path = require("path");

const app = express();

// ✅ MUST HAVE: lets Express read JSON bodies from fetch()
app.use(express.json());

// ✅ Serve your frontend files from /public
app.use(express.static(path.join(__dirname, "public")));

// ✅ Home route (serves public/index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ✅ Quick health check
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    keyPresent: !!process.env.GOOGLE_API_KEY
  });
});

/**
 * ✅ Text → Image endpoint
 * This returns VALID JSON every time (prevents "Unexpected end of JSON input").
 * Right now it’s a stub so you can confirm the button + request works.
 * Next step: connect this to Google Imagen and return base64 image.
 */
app.post("/api/text-to-image", async (req, res) => {
  try {
    const prompt = (req.body?.prompt || "").trim();

    if (!prompt) {
      return res.status(400).json({
        ok: false,
        error: "Missing prompt"
      });
    }

    // ✅ STUB RESPONSE (so frontend works immediately)
    // Replace this later with real Imagen output.
    return res.json({
      ok: true,
      message: `Received prompt: "${prompt}". Backend is working. (Imagen not connected yet.)`
      // Later you will return:
      // base64: "...",
      // mimeType: "image/png"
    });
  } catch (err) {
    console.error("Text-to-image error:", err);

    // ✅ Always return JSON even on crash
    return res.status(500).json({
      ok: false,
      error: err.message || "Server error"
    });
  }
});

// ✅ Render uses PORT env var
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("KEY PRESENT:", process.env.GOOGLE_API_KEY ? "YES" : "NO");
  console.log(`Server running on port ${PORT}`);
});








 

