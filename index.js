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

// Serve static assets from /public
app.use(
express.static(PUBLIC_DIR, {
etag: true,
lastModified: true,
setHeaders: (res, filePath) => {
// Ensure MP4s get correct headers
if (filePath.endsWith(".mp4")) {
res.setHeader("Content-Type", "video/mp4");
res.setHeader("Accept-Ranges", "bytes");
// while debugging:
res.setHeader("Cache-Control", "no-store");
}
},
})
);

/**
* ✅ HARD ROUTE: /demo.mp4 with TRUE Range streaming (Safari-safe)
* - Handles Range: bytes=...
* - Returns 206 Partial Content when Range header exists
* - Prevents falling back to index.html
*/
app.get("/demo.mp4", (req, res) => {
try {
const filePath = path.join(PUBLIC_DIR, "demo.mp4");

if (!fs.existsSync(filePath)) {
return res.status(404).send("demo.mp4 not found in /public");
}

const stat = fs.statSync(filePath);
const fileSize = stat.size;
const range = req.headers.range;

res.setHeader("Content-Type", "video/mp4");
res.setHeader("Accept-Ranges", "bytes");
res.setHeader("Cache-Control", "no-store");

// If no Range header, send entire file (200)
if (!range) {
res.setHeader("Content-Length", fileSize);
const stream = fs.createReadStream(filePath);
stream.pipe(res);
return;
}

// Parse Range: "bytes=start-end"
const match = /^bytes=(\d+)-(\d*)$/.exec(range);
if (!match) {
// Bad range format
res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
return;
}

const start = parseInt(match[1], 10);
const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

if (start >= fileSize || end >= fileSize || start > end) {
res.status(416).setHeader("Content-Range", `bytes */${fileSize}`).end();
return;
}

const chunkSize = end - start + 1;

res.status(206);
res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
res.setHeader("Content-Length", chunkSize);

const stream = fs.createReadStream(filePath, { start, end });
stream.pipe(res);
} catch (err) {
console.error("demo.mp4 stream error:", err);
res.status(500).send("demo.mp4 stream error");
}
});

// ✅ Debug endpoint (lets us confirm file exists + size on Render)
app.get("/api/debug/demo", (req, res) => {
const filePath = path.join(PUBLIC_DIR, "demo.mp4");
const exists = fs.existsSync(filePath);
let size = null;
if (exists) {
try {
size = fs.statSync(filePath).size;
} catch {}
}
res.json({
ok: true,
exists,
size,
publicDir: PUBLIC_DIR,
});
});

// ✅ Debug endpoint: read first bytes (to confirm it’s REALLY an MP4, not HTML)
app.get("/api/debug/demo-bytes", (req, res) => {
try {
const filePath = path.join(PUBLIC_DIR, "demo.mp4");
if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: "Missing demo.mp4" });

const fd = fs.openSync(filePath, "r");
const buf = Buffer.alloc(32);
fs.readSync(fd, buf, 0, 32, 0);
fs.closeSync(fd);

res.json({
ok: true,
first32_hex: buf.toString("hex"),
first32_ascii: buf.toString("ascii").replace(/[^\x20-\x7E]/g, "."),
note: "If this is an MP4, you often see 'ftyp' in the first bytes.",
});
} catch (e) {
console.error(e);
res.status(500).json({ ok: false, error: String(e?.message || e) });
}
});

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

// Build an absolute URL to THIS server (Render) for a path like "/demo.mp4"
function absoluteSelfUrl(req, p) {
const proto =
req.headers["x-forwarded-proto"]?.toString().split(",")[0].trim() ||
req.protocol ||
"https";
const host =
req.headers["x-forwarded-host"]?.toString().split(",")[0].trim() ||
req.get("host");
const cleanPath = String(p || "").startsWith("/") ? p : `/${p}`;
return `${proto}://${host}${cleanPath}`;
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
videoPath: "/demo.mp4",
});

setTimeout(() => {
const job = videoJobs.get(operationName);
if (!job) return;
job.done = true;
videoJobs.set(operationName, job);
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

// ABSOLUTE URL so browser always hits correct host + cache bust
const abs = absoluteSelfUrl(req, job.videoPath);
const cacheBust = `${abs}${abs.includes("?") ? "&" : "?"}cb=${Date.now()}`;

return res.json({
ok: true,
done: true,
videoUrl: cacheBust,
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

args.push("-filter_complex", filter, "-r", "30", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outPath);

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
// ✅ Only serve index.html for routes WITHOUT file extensions
app.get("*", (req, res) => {
if (path.extname(req.path)) {
return res.status(404).send("Not found");
}
res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
