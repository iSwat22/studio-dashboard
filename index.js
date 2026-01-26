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
// (So you never get black screen again)
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
veoModel: process.env.VEO_MODEL_ID || "veo-3.1-generate-exp",
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
const modelId = process.env.VEO_MODEL_ID || "veo-3.1-generate-exp";
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

const firstB64 = videos.find((v) => typeof v?.bytesBase64Encoded === "string")?.bytesBase64Encoded;
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
const aspectRatio = ["16:9", "9:16", "1:1"].includes(aspectRatioRaw) ? aspectRatioRaw : "16:9";

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
if (!operationName) return res.status(400).json({ ok: false, error: "Missing operationName" });

const result = await pollVeoOperation(operationName);

if (!result.done) return res.json({ ok: true, done: false });

if (result.gcsUri) {
return res.json({
ok: true,
done: true,
videoUrl: null,
gcsUri: result.gcsUri,
proxyUrl: null,
note: "Video stored in GCS.",
});
}

if (result.base64) {
return res.json({
ok: true,
done: true,
mimeType: "video/mp4",
base64: result.base64,
});
}

return res.status(500).json({
ok: false,
error: result.error || "Veo finished but no video found",
details: result.raw || null,
});
} catch (err) {
console.error("text-to-video status error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// ======================================================
// ✅ OPTION A: LONGER VIDEOS (BATCH CLIPS + FFmpeg CONCAT)
// New endpoints so we do NOT break your current ones.
// POST /api/text-to-video-batch
// POST /api/text-to-video-batch/status
// ======================================================
const batchJobs = new Map();

function ffmpegConcatMp4(files, outPath) {
return new Promise((resolve, reject) => {
const listPath = path.join(TMP_DIR, `concat_${Date.now()}_${Math.random().toString(16).slice(2)}.txt`);

// concat demuxer needs: file '/abs/path'
const lines = files.map((f) => `file '${String(f).replace(/'/g, "'\\''")}'`).join("\n");
fs.writeFileSync(listPath, lines);

const argsCopy = ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", outPath];
const ff1 = spawn("ffmpeg", argsCopy);

let errBuf = "";
ff1.stderr.on("data", (d) => (errBuf += d.toString()));
ff1.on("close", (code) => {
// remove list file
try { fs.unlinkSync(listPath); } catch {}

if (code === 0) return resolve(outPath);

// fallback: re-encode if stream copy fails
const argsRe = ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", outPath];
const ff2 = spawn("ffmpeg", argsRe);
let err2 = "";
ff2.stderr.on("data", (d) => (err2 += d.toString()));
ff2.on("close", (code2) => {
try { fs.unlinkSync(listPath); } catch {}
if (code2 === 0) return resolve(outPath);
reject(new Error(`FFmpeg concat failed. copyErr: ${errBuf.slice(-500)} reErr: ${err2.slice(-500)}`));
});
});
});
}

app.post("/api/text-to-video-batch", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

// totalSeconds = how long you want overall (ex: 60)
const totalSeconds = clampNum(req.body?.totalSeconds ?? req.body?.durationSeconds ?? 16, 8, 1800, 16);

// clipSeconds = each Veo clip length (keep 8 by default)
const clipSeconds = clampNum(req.body?.clipSeconds ?? 8, 4, 8, 8);

const aspectRatioRaw = String(req.body?.aspectRatio || "16:9").trim();
const aspectRatio = ["16:9", "9:16", "1:1"].includes(aspectRatioRaw) ? aspectRatioRaw : "16:9";

const clipsNeeded = Math.ceil(totalSeconds / clipSeconds);
if (clipsNeeded < 1) return res.status(400).json({ ok: false, error: "Invalid clip count" });
if (clipsNeeded > 240) return res.status(400).json({ ok: false, error: "Too many clips (max 240)" });

const batchId = safeId("batch");

// Create job
const job = {
batchId,
createdAt: Date.now(),
prompt,
totalSeconds,
clipSeconds,
aspectRatio,
clipsNeeded,
clipOps: [], // operationName list
clipFiles: [], // local mp4 paths
currentIndex: 0,
done: false,
finalFile: null,
error: null,
};

// Start first clip immediately
const op0 = await startVeoJob({ prompt, durationSeconds: clipSeconds, aspectRatio });
job.clipOps.push(op0);

batchJobs.set(batchId, job);

return res.json({
ok: true,
batchId,
clipsNeeded,
clipSeconds,
totalSeconds,
aspectRatio,
});
} catch (err) {
console.error("text-to-video-batch error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

app.post("/api/text-to-video-batch/status", async (req, res) => {
try {
const { batchId } = req.body || {};
if (!batchId) return res.status(400).json({ ok: false, error: "Missing batchId" });

const job = batchJobs.get(batchId);
if (!job) return res.status(404).json({ ok: false, error: "Unknown batch" });

if (job.error) {
return res.status(500).json({ ok: false, done: true, error: job.error });
}

if (job.done && job.finalFile) {
const rel = `/exports/${path.basename(job.finalFile)}`;
const abs = absoluteSelfUrl(req, rel);
const cacheBust = `${abs}${abs.includes("?") ? "&" : "?"}cb=${Date.now()}`;
return res.json({ ok: true, done: true, finalVideoUrl: cacheBust, clipsDone: job.clipFiles.length, clipsNeeded: job.clipsNeeded });
}

// Poll current in-progress clips, but only one at a time to keep it simple/stable.
const idx = job.clipFiles.length; // next file index we need to complete
const opName = job.clipOps[idx];
if (!opName) {
// If we have completed some clips and need to start next op
if (job.clipOps.length < job.clipsNeeded) {
const nextOp = await startVeoJob({ prompt: job.prompt, durationSeconds: job.clipSeconds, aspectRatio: job.aspectRatio });
job.clipOps.push(nextOp);
batchJobs.set(batchId, job);
}
return res.json({ ok: true, done: false, stage: "starting", clipsDone: job.clipFiles.length, clipsNeeded: job.clipsNeeded });
}

const polled = await pollVeoOperation(opName);

if (!polled.done) {
return res.json({
ok: true,
done: false,
stage: "generating",
clipsDone: job.clipFiles.length,
clipsNeeded: job.clipsNeeded,
});
}

// Clip is done -> save it locally
const clipOut = path.join(TMP_DIR, `${batchId}_clip_${String(idx + 1).padStart(3, "0")}.mp4`);

try {
if (polled.gcsUri) {
await downloadGcsUriToFile(polled.gcsUri, clipOut);
} else if (polled.base64) {
writeBase64Mp4ToFile(polled.base64, clipOut);
} else {
throw new Error(polled.error || "Clip finished but no output");
}
} catch (e) {
job.error = e?.message || "Failed saving clip";
batchJobs.set(batchId, job);
return res.status(500).json({ ok: false, done: true, error: job.error });
}

job.clipFiles.push(clipOut);

// Start next clip if still needed
if (job.clipOps.length < job.clipsNeeded) {
const nextOp = await startVeoJob({ prompt: job.prompt, durationSeconds: job.clipSeconds, aspectRatio: job.aspectRatio });
job.clipOps.push(nextOp);
}

// If all clips finished -> concat
if (job.clipFiles.length >= job.clipsNeeded) {
const finalName = `video_${batchId}.mp4`;
const finalPath = path.join(EXPORTS_DIR, finalName);

try {
await ffmpegConcatMp4(job.clipFiles, finalPath);

// cleanup tmp clips
for (const f of job.clipFiles) {
try { fs.unlinkSync(f); } catch {}
}

job.finalFile = finalPath;
job.done = true;
} catch (e) {
job.error = e?.message || "FFmpeg concat failed";
}

batchJobs.set(batchId, job);

if (job.error) {
return res.status(500).json({ ok: false, done: true, error: job.error });
}

const rel = `/exports/${path.basename(job.finalFile)}`;
const abs = absoluteSelfUrl(req, rel);
const cacheBust = `${abs}${abs.includes("?") ? "&" : "?"}cb=${Date.now()}`;
return res.json({ ok: true, done: true, finalVideoUrl: cacheBust, clipsDone: job.clipFiles.length, clipsNeeded: job.clipsNeeded });
}

batchJobs.set(batchId, job);

return res.json({
ok: true,
done: false,
stage: "clip_saved",
clipsDone: job.clipFiles.length,
clipsNeeded: job.clipsNeeded,
});
} catch (err) {
console.error("text-to-video-batch status error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// =========================================================
// IMAGE -> VIDEO (FFmpeg slideshow)
// =========================================================
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

app.post("/api/image-to-video", upload.array("images", 20), async (req, res) => {
const uploaded = req.files || [];
const secondsPerImage = Number(req.body?.secondsPerImage ?? 1.5);

if (!uploaded.length) return res.status(400).json({ ok: false, error: "No images uploaded" });
if (!Number.isFinite(secondsPerImage) || secondsPerImage <= 0 || secondsPerImage > 10) {
return res.status(400).json({ ok: false, error: "secondsPerImage must be between 0 and 10" });
}

const outPath = path.join(TMP_DIR, `out_${Date.now()}_${Math.random().toString(16).slice(2)}.mp4`);

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

// ---- Fallback to index.html (SPA fallback) ----
// ✅ Only serve index.html for routes WITHOUT file extensions
app.get("*", (req, res) => {
if (path.extname(req.path)) return res.status(404).send("Not found");
res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});


