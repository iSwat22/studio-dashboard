import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// ✅ Fal.ai client
import { fal } from "@fal-ai/client";

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Path helpers (ES Modules) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Middleware ----
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ✅ Configure Fal.ai
// Supports either FAL_KEY or your custom env name "video_key"
const FAL_KEY =
process.env.FAL_KEY ||
process.env.VIDEO_KEY ||
process.env.video_key ||
"";

if (FAL_KEY) {
fal.config({ credentials: FAL_KEY });
}

// ---- Health check ----
app.get("/api/health", (req, res) => {
res.json({
ok: true,
status: "healthy",
googleKeyPresent: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
falKeyPresent: Boolean(FAL_KEY),
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
mimeType: imagePart.inlineData.mimeType || "image/png",
base64: imagePart.inlineData.data,
});
} catch (err) {
console.error("text-to-image error:", err);
res.status(500).json({ ok: false, error: err?.message || "Server error" });
}
});

// ======================================================
// ✅ TEXT → VIDEO (REAL) using Fal.ai LTX Video
// Model: fal-ai/ltx-video
// Output: { video: { url: "..." } }
// ======================================================
app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

if (!FAL_KEY) {
return res.status(500).json({
ok: false,
error: "Missing Fal.ai key. Set FAL_KEY (or video_key) in Render env vars.",
});
}

// Run Fal model (waits until it finishes)
const result = await fal.subscribe("fal-ai/ltx-video", {
input: { prompt },
logs: true,
});

const videoUrl = result?.data?.video?.url;
if (!videoUrl) {
return res.status(500).json({
ok: false,
error: "Fal did not return a video URL.",
details: result?.data || result,
});
}

return res.json({ ok: true, videoUrl });
} catch (err) {
console.error("text-to-video error:", err);
return res.status(500).json({ ok: false, error: err?.message || "Server error" });
}
});

// ---- Image -> Video (not wired yet) ----
app.post("/api/image-to-video", async (req, res) => {
return res.status(501).json({
ok: false,
error: "Not wired yet. We'll hook this to Fal after Text→Video is confirmed working.",
});
});

// ---- Fallback ----
app.get("*", (req, res) => {
res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
