import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import multer from "multer";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Path helpers (ES Modules) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Middleware ----
app.use(express.json({ limit: "5mb" }));

// Serve /public as website root (this serves demo.mp4 too)
app.use(express.static(path.join(__dirname, "public")));

// ---- Multer (uploads for image->video) ----
const TMP_DIR = os.tmpdir();
const upload = multer({
storage: multer.diskStorage({
destination: (req, file, cb) => cb(null, TMP_DIR),
filename: (req, file, cb) => {
const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}_${safe}`);
},
}),
limits: { fileSize: 8 * 1024 * 1024 },
});

// ---- Health check ----
app.get("/api/health", (req, res) => {
res.json({
ok: true,
status: "healthy",
keyPresent: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
videoKeyPresent: Boolean(process.env.VIDEO_KEY),
});
});

// ---- Text -> Image (Gemini) ----
app.post("/api/text-to-image", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) {
return res.status(500).json({
ok: false,
error: "Missing GOOGLE_API_KEY or GEMINI_API_KEY",
});
}

const url =
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";

const payload = {
contents: [{ parts: [{ text: prompt }] }],
generationConfig: {
imageConfig: { aspectRatio: "1:1", imageSize: "1024" },
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

const data = await apiRes.json();

const parts = data?.candidates?.[0]?.content?.parts || [];
const imagePart = parts.find((p) => p.inlineData?.data);

if (!imagePart) {
return res.status(500).json({ ok: false, error: "No image returned" });
}

res.json({
ok: true,
mimeType: imagePart.inlineData.mimeType,
base64: imagePart.inlineData.data,
});
} catch (err) {
console.error("text-to-image error:", err);
res.status(500).json({ ok: false, error: "Server error" });
}
});

// ======================================================
// ✅ TEXT → VIDEO (DEMO ROUTE: returns your local /demo.mp4)
// Put demo.mp4 inside /public
// Test: https://YOURDOMAIN/demo.mp4 should play
// ======================================================
app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

// Return local mp4 from /public (same domain = fewer playback issues)
res.json({
ok: true,
videoUrl: "/demo.mp4",
});
} catch (err) {
console.error("text-to-video error:", err);
res.status(500).json({ ok: false, error: "Server error" });
}
});

// ---- Image -> Video (FFmpeg placeholder for now) ----
app.post("/api/image-to-video", upload.array("images", 20), async (req, res) => {
return res.status(501).json({
ok: false,
error: "FFmpeg not installed yet (next step)",
});
});

// ---- SAFE FALLBACK (Fixes Render crash vs app.get('*')) ----
// Any non-API route should load the SPA/home page.
app.use((req, res, next) => {
if (req.path.startsWith("/api")) return next();
return res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
