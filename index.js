import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import multer from "multer";
import { fileURLToPath } from "url";
import { Readable } from "stream";
import { GoogleAuth } from "google-auth-library";

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORS (fixes "Could not send request" from browser tools / your UI)
app.use(
cors({
origin: "*",
methods: ["GET", "POST", "OPTIONS"],
allowedHeaders: ["Content-Type", "Authorization"],
})
);
app.options("*", cors());

// ---- Path helpers (ES Modules) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");
const EXPORTS_DIR = path.join(PUBLIC_DIR, "exports");
const TMP_DIR = os.tmpdir();

// Ensure exports directory exists (Option A = save on Render server)
try {
if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });
} catch (e) {
console.log("⚠️ Could not create exports dir:", e?.message || e);
}

// ---- Middleware ----
app.use(express.json({ limit: "10mb" }));

// Serve static assets from /public
app.use(
express.static(PUBLIC_DIR, {
etag: true,
lastModified: true,
setHeaders: (res, filePath) => {
// Force correct headers for mp4
if (filePath.endsWith(".mp4")) {
res.setHeader("Content-Type", "video/mp4");
res.setHeader("Accept-Ranges", "bytes");
}
},
})
);
app.use("/exports", express.static(EXPORTS_DIR));

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

function safeId(prefix = "id") {
return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clampNum(n, min, max, fallback) {
const x = Number(n);
if (!Number.isFinite(x)) return fallback;
return Math.max(min, Math.min(max, x));
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
// ✅ Create a REAL demo.mp4 automatically if missing/invalid
// ======================================================
function createDemoMp4IfNeeded() {
const filePath = path.join(PUBLIC_DIR, "demo.mp4");

try {
// If file exists and looks non-trivial, keep it
if (fs.existsSync(filePath)) {
const size = fs.statSync(filePath).size;
if (size > 50_000) return; // >50KB = likely a real mp4
}
} catch {
// continue and regenerate
}

// If ffmpeg is available, generate a tiny, valid mp4
// (2 seconds, 1280x720, test pattern)
try {
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

const args = [
"-y",
"-f",
"lavfi",
"-i",
"testsrc=size=1280x720:rate=30",
"-t",
"2",
"-pix_fmt",
"yuv420p",
"-movflags",
"+faststart",
filePath,
];

const ff = spawn("ffmpeg", args);
ff.on("close", (code) => {
if (code === 0) {
console.log("✅ demo.mp4 created in /public");
} else {
console.log("⚠️ ffmpeg failed to create demo.mp4 (code:", code, ")");
}
});
} catch (e) {
console.log("⚠️ Could not create demo.mp4:", e?.message || e);
}
}

createDemoMp4IfNeeded();

// ======================================================
// ✅ HARD ROUTE: /demo.mp4 must NEVER fall back to index.html
// ======================================================
app.get("/demo.mp4", (req, res) => {
const filePath = path.join(PUBLIC_DIR, "demo.mp4");

if (!fs.existsSync(filePath)) {
return res.status(404).send("demo.mp4 not found in /public");
}

res.setHeader("Content-Type", "video/mp4");
res.setHeader("Accept-Ranges", "bytes");
return res.sendFile(filePath);
});

// ✅ Debug endpoint (confirm file exists + size on Render)
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

// ✅ Debug endpoint for exports
app.get("/api/debug/exports", (req, res) => {
try {
const exists = fs.existsSync(EXPORTS_DIR);
let files = [];
if (exists) {
files = fs
.readdirSync(EXPORTS_DIR)
.filter((f) => f.toLowerCase().endsWith(".mp4"))
.slice(-20);
}
res.json({ ok: true, exportsDir: EXPORTS_DIR, exists, files });
} catch (e) {
res.status(500).json({ ok: false, error: e?.message || "debug failed" });
}
});

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
hasVeoConfig: Boolean(process.env.GCP_PROJECT_ID),
veoLocation: process.env.GCP_LOCATION || "us-central1",
veoModel: process.env.VEO_MODEL_ID || "veo-2.0-generate-exp",
hasVeoBucket: Boolean(process.env.VEO_GCS_BUCKET),
hasExportsDir: fs.existsSync(EXPORTS_DIR),
});
});

// =========================================================
// TEXT -> IMAGE (Gemini 3 Pro Image via API KEY)
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
// ✅ REAL TEXT → VIDEO via Vertex AI Veo
// ======================================================
const veoJobs = new Map();

function getServiceAccountPath() {
const p = "/etc/secrets/gcp-service-account.json";
return p;
}

async function getAccessToken() {
const keyFile = getServiceAccountPath();
const auth = new GoogleAuth({
keyFile,
scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});
const client = await auth.getClient();
const token = await client.getAccessToken();
const accessToken = token?.token || token;
if (!accessToken) throw new Error("Could not get Google access token");
return accessToken;
}

// ======================================================
// ✅ TEXT → SPEECH (Google Cloud Text-to-Speech via Service Account)
// ======================================================
async function ttsSynthesizeToMp3Buffer({ text, voiceName, speakingRate, pitch }) {
if (!text || !String(text).trim()) throw new Error("Missing TTS text");

const accessToken = await getAccessToken();
const url = "https://texttospeech.googleapis.com/v1/text:synthesize";

const body = {
input: { text: String(text).trim() },
voice: {
languageCode: "en-US",
...(voiceName ? { name: voiceName } : {}),
},
audioConfig: {
audioEncoding: "MP3",
speakingRate: Number.isFinite(Number(speakingRate)) ? Number(speakingRate) : 1.0,
pitch: Number.isFinite(Number(pitch)) ? Number(pitch) : 0.0,
},
};

const r = await fetch(url, {
method: "POST",
headers: {
Authorization: `Bearer ${accessToken}`,
"Content-Type": "application/json; charset=utf-8",
},
body: JSON.stringify(body),
});

const txt = await r.text();
let data;
try {
data = JSON.parse(txt);
} catch {
data = { raw: txt };
}

if (!r.ok) {
throw new Error(data?.error?.message || `TTS request failed (${r.status})`);
}

const b64 = data?.audioContent;
if (!b64) throw new Error("TTS succeeded but no audioContent returned");

return Buffer.from(b64, "base64");
}

function writeMp3BufferToFile(mp3Buffer, outPath) {
fs.writeFileSync(outPath, mp3Buffer);
return outPath;
}

app.post("/api/text-to-speech", async (req, res) => {
try {
const text = String(req.body?.text || "").trim();
if (!text) return res.status(400).json({ ok: false, error: "Missing text" });

const mp3Buffer = await ttsSynthesizeToMp3Buffer({ text });

const fileName = `tts_${Date.now()}_${Math.random().toString(16).slice(2)}.mp3`;
const outPath = path.join(EXPORTS_DIR, fileName);
writeMp3BufferToFile(mp3Buffer, outPath);

const audioUrl = absoluteSelfUrl(req, `/exports/${fileName}`);
return res.json({ ok: true, audioUrl });
} catch (err) {
console.error("text-to-speech error:", err);
return res.status(500).json({ ok: false, error: err.message || "TTS error" });
}
});

// =========================================================
// ✅ NEW: MUX integration (safe additions only)
// Requires env: MUX_WORKER_URL = https://<your-railway-domain>
// =========================================================
function muxWorkerUrl() {
const base = String(process.env.MUX_WORKER_URL || "").trim();
if (!base) throw new Error("Missing MUX_WORKER_URL in Render Environment Variables");
return `${base.replace(/\/$/, "")}/mux`;
}

async function muxVideoAndAudioToMp4Buffer({ videoUrl, audioUrl }) {
const url = muxWorkerUrl();

const r = await fetch(url, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ videoUrl, audioUrl }),
});

if (!r.ok) {
const txt = await r.text().catch(() => "");
throw new Error(`Mux worker failed (${r.status}): ${txt.slice(0, 400)}`);
}

const ab = await r.arrayBuffer();
return Buffer.from(ab);
}

function writeMp4BufferToExports(mp4Buffer, filename) {
const outPath = path.join(EXPORTS_DIR, filename);
fs.writeFileSync(outPath, mp4Buffer);
return outPath;
}

app.post("/api/mux-final", async (req, res) => {
try {
const videoUrl = String(req.body?.videoUrl || "").trim();
const audioUrl = String(req.body?.audioUrl || "").trim();
if (!videoUrl || !audioUrl) {
return res.status(400).json({ ok: false, error: "videoUrl and audioUrl required" });
}

const mp4 = await muxVideoAndAudioToMp4Buffer({ videoUrl, audioUrl });

const fileName = `mux_${Date.now()}_${Math.random().toString(16).slice(2)}.mp4`;
writeMp4BufferToExports(mp4, fileName);

const finalVideoUrl = absoluteSelfUrl(req, `/exports/${fileName}`);
return res.json({ ok: true, finalVideoUrl });
} catch (err) {
console.error("mux-final error:", err);
return res.status(500).json({ ok: false, error: err.message || "Mux failed" });
}
});

app.post("/api/text-to-video-narrated", async (req, res) => {
try {
const videoUrl = String(req.body?.videoUrl || "").trim();
const text = String(req.body?.text || "").trim();
const voiceName = req.body?.voiceName ? String(req.body.voiceName).trim() : undefined;
const speakingRate = req.body?.speakingRate;
const pitch = req.body?.pitch;

if (!videoUrl) return res.status(400).json({ ok: false, error: "Missing videoUrl" });
if (!text) return res.status(400).json({ ok: false, error: "Missing text (narration script)" });

const mp3Buffer = await ttsSynthesizeToMp3Buffer({ text, voiceName, speakingRate, pitch });

const audioFile = `tts_${Date.now()}_${Math.random().toString(16).slice(2)}.mp3`;
const audioPath = path.join(EXPORTS_DIR, audioFile);
fs.writeFileSync(audioPath, mp3Buffer);

const audioUrl = absoluteSelfUrl(req, `/exports/${audioFile}`);

const mp4 = await muxVideoAndAudioToMp4Buffer({ videoUrl, audioUrl });

const outFile = `narrated_${Date.now()}_${Math.random().toString(16).slice(2)}.mp4`;
writeMp4BufferToExports(mp4, outFile);

const finalVideoUrl = absoluteSelfUrl(req, `/exports/${outFile}`);
return res.json({ ok: true, audioUrl, finalVideoUrl });
} catch (err) {
console.error("text-to-video-narrated error:", err);
return res.status(500).json({ ok: false, error: err.message || "Narration failed" });
}
});

// ---- Fallback to index.html (SPA fallback) ----
app.get("*", (req, res) => {
if (path.extname(req.path)) return res.status(404).send("Not found");
res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});


