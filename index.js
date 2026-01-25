import express from "express";
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

// If ffmpeg is available, generate a tiny, valid mp4 (2 seconds)
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
// ✅ Range-stream exports (better playback + scrub)
// ======================================================
app.get("/exports/:file", (req, res) => {
try {
const file = req.params.file;
const filePath = path.join(EXPORTS_DIR, file);

if (!fs.existsSync(filePath)) return res.status(404).send("Not found");

const stat = fs.statSync(filePath);
const range = req.headers.range;

res.setHeader("Content-Type", "video/mp4");
res.setHeader("Accept-Ranges", "bytes");

if (!range) {
res.setHeader("Content-Length", stat.size);
return fs.createReadStream(filePath).pipe(res);
}

const [startStr, endStr] = range.replace("bytes=", "").split("-");
const start = parseInt(startStr, 10);
const end = endStr ? parseInt(endStr, 10) : stat.size - 1;

res.status(206);
res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
res.setHeader("Content-Length", end - start + 1);

return fs.createReadStream(filePath, { start, end }).pipe(res);
} catch (e) {
console.error("exports stream error:", e);
res.status(500).send("stream error");
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
// ✅ REAL TEXT → VIDEO via Vertex AI Veo
// ======================================================
const veoJobs = new Map();

function getServiceAccountPath() {
// Render Secret Files mount here:
// /etc/secrets/<filename>
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
const accessToken = token?.token || token; // google-auth-lib varies by version
if (!accessToken) throw new Error("Could not get Google access token");
return accessToken;
}

function veoEndpointBase() {
const projectId = process.env.GCP_PROJECT_ID;
const location = process.env.GCP_LOCATION || "us-central1";
const modelId = process.env.VEO_MODEL_ID || "veo-2.0-generate-exp";
if (!projectId) throw new Error("Missing GCP_PROJECT_ID env var");
return {
location,
modelId,
predictLongRunningUrl: `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predictLongRunning`,
fetchOperationUrl: `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:fetchPredictOperation`,
};
}

// ----- GCS helpers (download Veo outputs when they are gcsUri) -----
function parseGcsUri(gcsUri) {
// gs://bucket/path/to/object.mp4
if (typeof gcsUri !== "string") return null;
if (!gcsUri.startsWith("gs://")) return null;
const noScheme = gcsUri.slice("gs://".length);
const slash = noScheme.indexOf("/");
if (slash < 0) return null;
const bucket = noScheme.slice(0, slash);
const object = noScheme.slice(slash + 1);
if (!bucket || !object) return null;
return { bucket, object };
}

async function downloadGcsUriToFile(gcsUri, outPath) {
const parsed = parseGcsUri(gcsUri);
if (!parsed) throw new Error("Invalid gcsUri: " + gcsUri);

const accessToken = await getAccessToken();

// GCS JSON API download (alt=media)
const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(
parsed.bucket
)}/o/${encodeURIComponent(parsed.object)}?alt=media`;

const r = await fetch(url, {
method: "GET",
headers: { Authorization: `Bearer ${accessToken}` },
});

if (!r.ok) {
const txt = await r.text().catch(() => "");
throw new Error(`Failed to download GCS video (${r.status}): ${txt.slice(0, 300)}`);
}

const buf = Buffer.from(await r.arrayBuffer());
fs.writeFileSync(outPath, buf);
return outPath;
}

function writeBase64Mp4ToFile(base64, outPath) {
const buf = Buffer.from(String(base64), "base64");
fs.writeFileSync(outPath, buf);
return outPath;
}

async function startVeoJob({ prompt, durationSeconds, aspectRatio }) {
const { predictLongRunningUrl } = veoEndpointBase();
const accessToken = await getAccessToken();

// Optional output bucket (recommended).
const bucket = process.env.VEO_GCS_BUCKET;
const storageUri = bucket ? `gs://${bucket}` : undefined;

// Clamp duration to avoid Veo errors
let dur = clampNum(durationSeconds, 1, 60, 8);
dur = Math.round(dur);

const aspectRaw = String(aspectRatio || "16:9").trim();
const aspect = ["16:9", "9:16", "1:1"].includes(aspectRaw) ? aspectRaw : "16:9";

const params = storageUri ? { storageUri } : {};
params.durationSeconds = dur;
params.aspectRatio = aspect;

const body = {
instances: [{ prompt }],
parameters: params,
};

const r = await fetch(predictLongRunningUrl, {
method: "POST",
headers: {
Authorization: `Bearer ${accessToken}`,
"Content-Type": "application/json; charset=utf-8",
},
body: JSON.stringify(body),
});

const text = await r.text();
let data;
try {
data = JSON.parse(text);
} catch {
data = { raw: text };
}

if (!r.ok) {
throw new Error(data?.error?.message || "Veo request failed");
}

const operationName = data?.name;
if (!operationName) throw new Error("Veo did not return operation name");
return operationName;
}

async function pollVeoOperation(operationName) {
const { fetchOperationUrl } = veoEndpointBase();
const accessToken = await getAccessToken();

const r = await fetch(fetchOperationUrl, {
method: "POST",
headers: {
Authorization: `Bearer ${accessToken}`,
"Content-Type": "application/json; charset=utf-8",
},
body: JSON.stringify({ operationName }),
});

const text = await r.text();
let data;
try {
data = JSON.parse(text);
} catch {
data = { raw: text };
}

if (!r.ok) {
const msg = data?.error?.message || "Veo poll failed";
const err = new Error(msg);
err.details = data;
throw err;
}

const done = Boolean(data?.done);
if (!done) return { done: false };

const resp = data?.response || {};
const videos = resp?.videos || [];

const firstGcs = videos.find((v) => typeof v?.gcsUri === "string")?.gcsUri;
if (firstGcs) return { done: true, gcsUri: firstGcs };

const firstB64 = videos.find((v) => typeof v?.bytesBase64Encoded === "string")
?.bytesBase64Encoded;
if (firstB64) return { done: true, base64: firstB64 };

return { done: true, error: "Veo finished but no video found", raw: data };
}

app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

// accept duration + aspect from UI
let durationSeconds = Number(req.body?.durationSeconds ?? 8);
if (!Number.isFinite(durationSeconds)) durationSeconds = 8;
durationSeconds = Math.max(1, Math.min(60, Math.round(durationSeconds)));

const aspectRatioRaw = String(req.body?.aspectRatio || "16:9").trim();
const aspectRatio = ["16:9", "9:16", "1:1"].includes(aspectRatioRaw)
? aspectRatioRaw
: "16:9";

const operationName = await startVeoJob({ prompt, durationSeconds, aspectRatio });

// Track it
veoJobs.set(operationName, {
createdAt: Date.now(),
prompt,
durationSeconds,
aspectRatio,
});

return res.json({ ok: true, operationName });
} catch (err) {
console.error("text-to-video error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

app.post("/api/text-to-video/status", async (req, res) => {
try {
const { operationName } = req.body || {};
if (!operationName)
return res.status(400).json({ ok: false, error: "Missing operationName" });

const result = await pollVeoOperation(operationName);

if (!result.done) return res.json({ ok: true, done: false });

// ✅ If Veo returned base64 → return playable immediately
if (result.base64) {
return res.json({
ok: true,
done: true,
base64: result.base64,
mimeType: "video/mp4",
videoUrl: null,
proxyUrl: null,
});
}

// ✅ If Veo returned gcsUri → download to /public/exports and return URL
if (result.gcsUri) {
const fileName = `${safeId("veo")}.mp4`;
const outPath = path.join(EXPORTS_DIR, fileName);

await downloadGcsUriToFile(result.gcsUri, outPath);

const videoUrl = `/exports/${fileName}`;
return res.json({
ok: true,
done: true,
gcsUri: result.gcsUri,
videoUrl,
proxyUrl: null,
absoluteUrl: absoluteSelfUrl(req, videoUrl),
note: "Downloaded from GCS into /public/exports for playback.",
});
}

return res.status(500).json({
ok: false,
done: true,
error: result.error || "Video finished but no playable output returned",
raw: result.raw,
});
} catch (err) {
console.error("text-to-video/status error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// ======================================================
// ✅ TEXT → VOICE (Google Cloud Text-to-Speech) ADDED ✅
// Uses SAME service account token method as Veo
// ======================================================
app.post("/api/text-to-voice", async (req, res) => {
try {
const text = (req.body?.text || "").trim();
if (!text) return res.status(400).json({ ok: false, error: "Missing text" });

// You can pass these from UI later
const voiceName = String(req.body?.voiceName || "en-US-Journey-D");
const languageCode = String(req.body?.languageCode || "en-US");
const speakingRate = clampNum(req.body?.speakingRate, 0.7, 1.3, 1.0);
const pitch = clampNum(req.body?.pitch, -5, 5, 0);

const accessToken = await getAccessToken();

const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
method: "POST",
headers: {
Authorization: `Bearer ${accessToken}`,
"Content-Type": "application/json",
},
body: JSON.stringify({
input: { text },
voice: { languageCode, name: voiceName },
audioConfig: { audioEncoding: "MP3", speakingRate, pitch },
}),
});

const j = await r.json().catch(() => ({}));
if (!r.ok) {
return res.status(r.status).json({
ok: false,
error: j?.error?.message || "TTS request failed",
details: j,
});
}

if (!j.audioContent) {
return res.status(500).json({ ok: false, error: "No audioContent returned" });
}

return res.json({ ok: true, mimeType: "audio/mpeg", base64: j.audioContent });
} catch (err) {
console.error("text-to-voice error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// ======================================================
// ✅ MUX VIDEO + VOICE (FFmpeg) ADDED ✅
// Input: videoBase64 OR videoUrl + audioBase64
// Output: mp4 saved to /public/exports and returns URL
// ======================================================
app.post("/api/mux-video-audio", async (req, res) => {
try {
const audioBase64 = String(req.body?.audioBase64 || "").trim();
if (!audioBase64) return res.status(400).json({ ok: false, error: "Missing audioBase64" });

const videoBase64 = String(req.body?.videoBase64 || "").trim();
const videoUrl = String(req.body?.videoUrl || "").trim();

if (!videoBase64 && !videoUrl) {
return res.status(400).json({ ok: false, error: "Provide videoBase64 OR videoUrl" });
}

// Paths
const inVid = path.join(TMP_DIR, `${safeId("vid")}.mp4`);
const inAud = path.join(TMP_DIR, `${safeId("aud")}.mp3`);
const outName = `${safeId("final")}.mp4`;
const outVid = path.join(EXPORTS_DIR, outName);

// Write audio
fs.writeFileSync(inAud, Buffer.from(audioBase64, "base64"));

// Get video bytes
if (videoBase64) {
fs.writeFileSync(inVid, Buffer.from(videoBase64, "base64"));
} else {
// videoUrl must be local (/exports/...) or absolute to your app
const full = videoUrl.startsWith("http")
? videoUrl
: absoluteSelfUrl(req, videoUrl);

const r = await fetch(full);
if (!r.ok) throw new Error(`Failed to fetch videoUrl for mux (${r.status})`);
const buf = Buffer.from(await r.arrayBuffer());
fs.writeFileSync(inVid, buf);
}

// ffmpeg mux
await new Promise((resolve, reject) => {
const ff = spawn("ffmpeg", [
"-y",
"-i",
inVid,
"-i",
inAud,
"-map",
"0:v:0",
"-map",
"1:a:0",
"-c:v",
"copy",
"-c:a",
"aac",
"-shortest",
"-movflags",
"+faststart",
outVid,
]);

ff.on("close", (code) => {
if (code === 0) resolve();
else reject(new Error(`FFmpeg failed with code ${code}`));
});
});

// Cleanup temp
try { fs.unlinkSync(inVid); } catch {}
try { fs.unlinkSync(inAud); } catch {}

const finalUrl = `/exports/${outName}`;
return res.json({
ok: true,
videoUrl: finalUrl,
absoluteUrl: absoluteSelfUrl(req, finalUrl),
});
} catch (err) {
console.error("mux-video-audio error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// ======================================================
// Server start
// ======================================================
app.listen(PORT, () => {
console.log(`✅ QuanneLeap API running on port ${PORT}`);
});


