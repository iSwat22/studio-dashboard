
import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import multer from "multer";
import { fileURLToPath } from "url";
import { Readable } from "stream";

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Path helpers (ES Modules) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");

// ---- Middleware ----
app.use(express.json({ limit: "10mb" }));

app.use(
express.static(PUBLIC_DIR, {
etag: true,
lastModified: true,
setHeaders: (res, filePath) => {
if (filePath.endsWith(".mp4")) {
res.setHeader("Content-Type", "video/mp4");
res.setHeader("Accept-Ranges", "bytes");
}
},
})
);

// ======================================================
// Helpers
// ======================================================
function absoluteSelfUrl(req, p) {
const proto =
req.headers["x-forwarded-proto"]?.toString().split(",")[0].trim() ||
req.protocol ||
"https";
const host =
req.headers["x-forwarded-host"]?.toString().split(",")[0].trim() ||
req.get("host");
return `${proto}://${host}${p.startsWith("/") ? p : "/" + p}`;
}

// ======================================================
// Health
// ======================================================
app.get("/api/health", (req, res) => {
res.json({
ok: true,
node: process.version,
hasImageKey: Boolean(process.env.GOOGLE_API_KEY),
hasVideoKey: Boolean(process.env.GEMINI_API_KEY_VIDEO),
});
});

// ======================================================
// TEXT → IMAGE (UNCHANGED / WORKING)
// ======================================================
app.post("/api/text-to-image", async (req, res) => {
try {
const prompt = req.body?.prompt?.trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

const apiRes = await fetch(
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
{
method: "POST",
headers: {
"Content-Type": "application/json",
"x-goog-api-key": process.env.GOOGLE_API_KEY,
},
body: JSON.stringify({
contents: [{ parts: [{ text: prompt }] }],
}),
}
);

const data = await apiRes.json();
const part = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

if (!part) throw new Error("No image returned");

res.json({
ok: true,
base64: part.inlineData.data,
mimeType: part.inlineData.mimeType,
});
} catch (err) {
res.status(500).json({ ok: false, error: err.message });
}
});

// ======================================================
// TEXT → VIDEO (REAL VEO IMPLEMENTATION)
// ======================================================
const videoJobs = new Map();

app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = req.body?.prompt?.trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

const veoRes = await fetch(
"https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-preview:generateContent",
{
method: "POST",
headers: {
"Content-Type": "application/json",
"x-goog-api-key": process.env.GEMINI_API_KEY_VIDEO,
},
body: JSON.stringify({
contents: [{ parts: [{ text: prompt }] }],
videoConfig: {
durationSeconds: 8,
aspectRatio: "16:9",
},
}),
}
);

const veoData = await veoRes.json();
if (!veoData?.name) throw new Error("Veo did not return operation");

const op = veoData.name;
videoJobs.set(op, { veoOperation: op });

res.json({ ok: true, operationName: op });
} catch (err) {
res.status(500).json({ ok: false, error: err.message });
}
});

app.post("/api/text-to-video/status", async (req, res) => {
try {
const { operationName } = req.body;
const job = videoJobs.get(operationName);
if (!job) return res.status(404).json({ ok: false, error: "Unknown job" });

const statusRes = await fetch(
`https://generativelanguage.googleapis.com/v1beta/${job.veoOperation}`,
{
headers: {
"x-goog-api-key": process.env.GEMINI_API_KEY_VIDEO,
},
}
);

const status = await statusRes.json();
if (!status.done) return res.json({ ok: true, done: false });

const videoPart =
status.response?.candidates?.[0]?.content?.parts?.find(p => p.fileData);

if (!videoPart) throw new Error("No video returned");

res.json({
ok: true,
done: true,
videoUrl: videoPart.fileData.fileUri,
});
} catch (err) {
res.status(500).json({ ok: false, error: err.message });
}
});

// ======================================================
// IMAGE → VIDEO (FFmpeg slideshow — unchanged)
// ======================================================
const TMP_DIR = os.tmpdir();
const upload = multer({ dest: TMP_DIR });

app.post("/api/image-to-video", upload.array("images", 20), async (req, res) => {
res.status(501).json({ ok: false, error: "Image-to-video unchanged / disabled for now" });
});

// ======================================================
// SPA Fallback
// ======================================================
app.get("*", (req, res) => {
if (path.extname(req.path)) return res.status(404).send("Not found");
res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});
