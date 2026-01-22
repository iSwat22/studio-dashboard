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

// ---- Middleware ----
app.use(express.json({ limit: "10mb" }));
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

// ======================================================
// Helpers
// ======================================================
function isHttpUrl(u) {
try {
const x = new URL(u);
return x.protocol === "http:" || x.protocol === "https:";
} catch {
return false;
}
}

// VERY IMPORTANT: prevent open-proxy abuse
const VIDEO_PROXY_ALLOWLIST = [
"storage.googleapis.com",
"generativelanguage.googleapis.com",
"googleapis.com",
"quanne-leap-api.onrender.com",
];

function isAllowedVideoHost(urlStr) {
try {
const u = new URL(urlStr);
const host = u.hostname.toLowerCase();
return VIDEO_PROXY_ALLOWLIST.some((allowed) => {
allowed = allowed.toLowerCase();
return host === allowed || host.endsWith("." + allowed);
});
} catch {
return false;
}
}

// ======================================================
// Video Proxy (fixes Range streaming issues when needed)
// ======================================================
app.get("/api/video-proxy", async (req, res) => {
try {
const url = String(req.query?.url || "").trim();
if (!url) return res.status(400).send("Missing url");
if (!isHttpUrl(url)) return res.status(400).send("Invalid url");
if (!isAllowedVideoHost(url)) return res.status(403).send("Host not allowed");

const range = req.headers.range;

const upstream = await fetch(url, {
method: "GET",
headers: range ? { Range: range } : {},
});

// allow 200 or 206
if (!upstream.ok && upstream.status !== 206) {
const txt = await upstream.text().catch(() => "");
return res.status(upstream.status).send(txt || `Upstream error ${upstream.status}`);
}

const contentType = upstream.headers.get("content-type") || "video/mp4";
const contentLength = upstream.headers.get("content-length");
const contentRange = upstream.headers.get("content-range");
const acceptRanges = upstream.headers.get("accept-ranges") || "bytes";

res.setHeader("Content-Type", contentType);
res.setHeader("Accept-Ranges", acceptRanges);
if (contentLength) res.setHeader("Content-Length", contentLength);
if (contentRange) res.setHeader("Content-Range", contentRange);

if (upstream.status === 206) res.status(206);

// Convert Web ReadableStream -> Node stream
const nodeStream = Readable.fromWeb(upstream.body);
nodeStream.pipe(res);
} catch (err) {
console.error("video-proxy error:", err);
res.status(500).send("Proxy error");
}
});

// ---- Health check ----
app.get("/api/health", (req, res) => {
res.json({
ok: true,
status: "healthy",
node: process.version,
hasGoogleApiKey: Boolean(process.env.GOOGLE_API_KEY),
hasGeminiVideoKey: Boolean(process.env.GEMINI_API_KEY_VIDEO),
});
});

// =========================================================
// TEXT -> IMAGE (Gemini 3 Pro Image via API KEY)
// Needs: GOOGLE_API_KEY in Render env vars
// =========================================================
app.post("/api/text-to-image", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
return res.status(500).json({
ok: false,
error: "Missing GOOGLE_API_KEY in Render Environment.",
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

const text = await apiRes.text();
let data;
try {
data = JSON.parse(text);
} catch {
return res.status(500).json({
ok: false,
error: "Gemini returned non-JSON response",
raw: text.slice(0, 500),
});
}

if (!apiRes.ok) {
return res.status(apiRes.status).json({
ok: false,
error: data?.error?.message || "Gemini request failed",
details: data,
});
}

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

return res.json({ ok: true, mimeType, base64 });
} catch (err) {
console.error("text-to-image error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// ======================================================
// TEXT → VIDEO (placeholder wiring test)
// - returns a REAL static file so the <video> can load
// - you MUST have: /public/demo.mp4
// ======================================================
const videoJobs = new Map();

app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

// Keep key check, but we’re still in placeholder mode
const API_KEY = process.env.GEMINI_API_KEY_VIDEO;
if (!API_KEY) {
return res.status(500).json({
ok: false,
error: "Missing GEMINI_API_KEY_VIDEO in environment",
});
}

const operationName = `veo_${Date.now()}_${Math.random().toString(36).slice(2)}`;

videoJobs.set(operationName, {
done: false,
createdAt: Date.now(),
videoUrl: null,
});

// Simulate generation; when done, point to LOCAL static file
setTimeout(() => {
videoJobs.set(operationName, {
done: true,
// This MUST exist at /public/demo.mp4
videoUrl: "/demo.mp4",
});
}, 3000);

return res.json({ ok: true, operationName });
} catch (err) {
console.error("text-to-video error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

app.post("/api/text-to-video/status", async (req, res) => {
try {
const { operationName } = req.body || {};
if (!operationName) return res.status(400).json({ ok: false, error: "Missing operationName" });

const job = videoJobs.get(operationName);
if (!job) return res.status(404).json({ ok: false, error: "Unknown operation" });

if (!job.done) return res.json({ ok: true, done: false });

// If it’s a local URL (/demo.mp4), no proxy needed.
return res.json({
ok: true,
done: true,
videoUrl: job.videoUrl,
proxyUrl: null,
});
} catch (err) {
console.error("text-to-video status error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// =========================================================
// IMAGE -> VIDEO (FFmpeg slideshow)
// =========================================================
app.post("/api/image-to-video", upload.array("images", 20), async (req, res) => {
const uploaded = req.files || [];
const secondsPerImage = Number(req.body?.secondsPerImage ?? 1.5);

if (!uploaded.length) return res.status(400).json({ ok: false, error: "No images uploaded" });
if (!Number.isFinite(secondsPerImage) || secondsPerImage <= 0 || secondsPerImage > 10) {
return res.status(400).json({ ok: false, error: "secondsPerImage must be between 0 and 10" });
}

const outPath = path.join(
TMP_DIR,
`out_${Date.now()}_${Math.random().toString(16).slice(2)}.mp4`
);

try {
const args = ["-y"];

for (const f of uploaded) {
args.push("-loop", "1", "-t", String(secondsPerImage), "-i", f.path);
}

const n = uploaded.length;
const filter = `concat=n=${n}:v=1:a=0,format=yuv420p`;

args.push(
"-filter_complex",
filter,
"-r",
"30",
"-pix_fmt",
"yuv420p",
"-movflags",
"+faststart",
outPath
);

await new Promise((resolve, reject) => {
const ff = spawn("ffmpeg", args);
let errBuf = "";
ff.stderr.on("data", (d) => (errBuf += d.toString()));
ff.on("close", (code) => {
if (code === 0) return resolve();
reject(new Error(`FFmpeg failed (code ${code}). ${errBuf.slice(-900)}`));
});
});

res.setHeader("Content-Type", "video/mp4");
res.setHeader("Content-Disposition", 'inline; filename="slideshow.mp4"');

const stream = fs.createReadStream(outPath);
stream.pipe(res);

stream.on("close", () => {
try { fs.unlinkSync(outPath); } catch {}
for (const f of uploaded) {
try { fs.unlinkSync(f.path); } catch {}
}
});
} catch (err) {
console.error("image-to-video error:", err);

try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
for (const f of uploaded) {
try { fs.unlinkSync(f.path); } catch {}
}

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


