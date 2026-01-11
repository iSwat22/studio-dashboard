import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Path helpers ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Middleware ----
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---- Health check ----
app.get("/api/health", (req, res) => {
res.json({
ok: true,
status: "healthy",
googleKeyPresent: Boolean(
process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY
)
});
});

// ---- Text → Image (WORKING — DO NOT TOUCH) ----
app.post("/api/text-to-image", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) {
return res.status(400).json({ ok: false, error: "Missing prompt" });
}

const API_KEY =
process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!API_KEY) {
return res.status(500).json({
ok: false,
error: "Missing GOOGLE_API_KEY or GEMINI_API_KEY"
});
}

const url =
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";

const payload = {
contents: [{ parts: [{ text: prompt }] }],
generationConfig: {
imageConfig: { aspectRatio: "1:1", imageSize: "1024" }
}
};

const apiRes = await fetch(url, {
method: "POST",
headers: {
"Content-Type": "application/json",
"x-goog-api-key": API_KEY
},
body: JSON.stringify(payload)
});

const data = await apiRes.json();
const parts = data?.candidates?.[0]?.content?.parts || [];
const imagePart = parts.find(p => p.inlineData?.data);

if (!imagePart) {
return res.status(500).json({ ok: false, error: "No image returned" });
}

res.json({
ok: true,
mimeType: imagePart.inlineData.mimeType || "image/png",
base64: imagePart.inlineData.data
});
} catch (err) {
console.error("text-to-image error:", err);
res.status(500).json({ ok: false, error: "Server error" });
}
});

// ---- Text → Video (CONTROL TEST — MUST PLAY) ----
app.post("/api/text-to-video", async (req, res) => {
return res.json({
ok: true,
videoUrl:  "/demo.mp4"
});
});

// ---- Fallback ----
app.get("*", (req, res) => {
res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
