import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------
// Path helpers (ESM)
// --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------
// Middleware
// --------------------
app.use(express.json({ limit: "5mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Serve generated videos
const OUTPUT_DIR = path.join(__dirname, "outputs");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);
app.use("/outputs", express.static(OUTPUT_DIR));

// --------------------
// Health check
// --------------------
app.get("/api/health", (req, res) => {
res.json({
ok: true,
googleKeyPresent: Boolean(process.env.GOOGLE_API_KEY),
veoKeyPresent: Boolean(process.env.GOOGLE_VEO_API_KEY),
});
});

// ======================================================
// TEXT → IMAGE (Gemini) — WORKING
// ======================================================
app.post("/api/text-to-image", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) {
return res.status(400).json({ ok: false, error: "Missing prompt" });
}

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
return res.status(500).json({
ok: false,
error: "Missing GOOGLE_API_KEY",
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

if (!apiRes.ok) {
return res.status(apiRes.status).json({
ok: false,
error: data?.error?.message || "Gemini error",
details: data,
});
}

const parts = data?.candidates?.[0]?.content?.parts || [];
const imagePart = parts.find((p) => p.inlineData?.data);

if (!imagePart) {
return res.status(500).json({
ok: false,
error: "No image returned",
details: data,
});
}

res.json({
ok: true,
mimeType: imagePart.inlineData.mimeType || "image/png",
base64: imagePart.inlineData.data,
});
} catch (err) {
console.error("text-to-image error:", err);
res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// ======================================================
// TEXT → VIDEO (Google Veo)
// Returns a REAL MP4 served from /outputs
// ======================================================
app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) {
return res.status(400).json({ ok: false, error: "Missing prompt" });
}

const API_KEY =
process.env.GOOGLE_VEO_API_KEY || process.env.GOOGLE_API_KEY;

if (!API_KEY) {
return res.status(500).json({
ok: false,
error: "Missing GOOGLE_VEO_API_KEY",
});
}

// ⚠️ Model name may differ by account.
// If this errors with “model not found”, we’ll swap it.
const model = "veo-2";

// 1) Start generation
const startUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateVideo`;

const startRes = await fetch(startUrl, {
method: "POST",
headers: {
"Content-Type": "application/json",
"x-goog-api-key": API_KEY,
},
body: JSON.stringify({ prompt }),
});

const startData = await startRes.json();

if (!startRes.ok) {
return res.status(startRes.status).json({
ok: false,
error: startData?.error?.message || "Veo start failed",
details: startData,
});
}

const jobName = startData?.name;
if (!jobName) {
return res.status(500).json({
ok: false,
error: "No job id returned from Veo",
details: startData,
});
}

// 2) Poll until done
const pollUrl = `https://generativelanguage.googleapis.com/v1beta/${jobName}`;
let finalData = null;

for (let i = 0; i < 60; i++) {
await new Promise((r) => setTimeout(r, 2000));
const pollRes = await fetch(pollUrl, {
headers: { "x-goog-api-key": API_KEY },
});
const pollData = await pollRes.json();
if (pollData?.done) {
finalData = pollData;
break;
}
}

if (!finalData) {
return res
.status(504)
.json({ ok: false, error: "Timed out waiting for Veo" });
}

// 3) Extract inline video data
const inline = finalData?.response?.candidates?.[0]?.content?.parts?.find(
(p) => p.inlineData?.data
);

if (!inline) {
return res.status(500).json({
ok: false,
error: "No inline video returned",
details: finalData,
});
}

// 4) Save MP4 locally
const fileName = `veo_${crypto.randomBytes(8).toString("hex")}.mp4`;
const filePath = path.join(OUTPUT_DIR, fileName);
fs.writeFileSync(filePath, Buffer.from(inline.inlineData.data, "base64"));

return res.json({
ok: true,
videoUrl: `/outputs/${fileName}`,
});
} catch (err) {
console.error("text-to-video error:", err);
res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// ======================================================
// Image → Video (placeholder — later)
// ======================================================
app.post("/api/image-to-video", async (req, res) => {
res.status(501).json({
ok: false,
error: "Image→Video not wired yet",
});
});

// --------------------
// Fallback
// --------------------
app.get("*", (req, res) => {
res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
