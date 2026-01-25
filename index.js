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
// Generate: ...:predictLongRunning (returns operation name) [oai_citation:4‡Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
// Poll: ...:fetchPredictOperation (done + video result) [oai_citation:5‡Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
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

app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

const { predictLongRunningUrl } = veoEndpointBase();
const accessToken = await getAccessToken();

// Optional output bucket (recommended). If not set, Veo may return bytesBase64Encoded. [oai_citation:6‡Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
const bucket = process.env.VEO_GCS_BUCKET;
const storageUri = bucket ? `gs://${bucket}` : undefined;

// Request shape based on Veo model reference. [oai_citation:7‡Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
// Keep it minimal so it WORKS first.
const body = {
instances: [
{
prompt,
},
],
parameters: storageUri
? {
storageUri,
}
: {},
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
return res.status(r.status).json({
ok: false,
error: data?.error?.message || "Veo request failed",
details: data,
});
}

const operationName = data?.name;
if (!operationName) {
return res.status(500).json({
ok: false,
error: "Veo did not return operation name",
details: data,
});
}

// Track it
veoJobs.set(operationName, {
createdAt: Date.now(),
prompt,
storageUri: storageUri || null,
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

const { fetchOperationUrl } = veoEndpointBase();
const accessToken = await getAccessToken();

// Poll body per model reference. [oai_citation:8‡Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
const body = {
operationName,
};

const r = await fetch(fetchOperationUrl, {
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
return res.status(r.status).json({
ok: false,
error: data?.error?.message || "Veo poll failed",
details: data,
});
}

const done = Boolean(data?.done);
if (!done) return res.json({ ok: true, done: false });

// When done, response includes videos with gcsUri OR bytesBase64Encoded. [oai_citation:9‡Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
const resp = data?.response || {};
const videos = resp?.videos || [];

// Case A: output is GCS URIs
const firstGcs = videos.find((v) => typeof v?.gcsUri === "string")?.gcsUri;
if (firstGcs) {
// Client can either:
// 1) Use a signed URL endpoint you add later
// 2) Or you can fetch it server-side and stream it (next step)
return res.json({
ok: true,
done: true,
videoUrl: null,
gcsUri: firstGcs,
proxyUrl: null,
note: "Video stored in GCS. Next step: add signed-url or stream endpoint.",
});
}

// Case B: bytesBase64Encoded returned
const firstB64 = videos.find((v) => typeof v?.bytesBase64Encoded === "string")?.bytesBase64Encoded;
if (firstB64) {
// Return base64 to client (works immediately for testing)
return res.json({
ok: true,
done: true,
mimeType: "video/mp4",
base64: firstB64,
});
}

return res.status(500).json({
ok: false,
error: "Veo finished but no video found in response",
details: data,
});
} catch (err) {
console.error("text-to-video status error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// =========================================================
// IMAGE -> VIDEO (FFmpeg slideshow)
// =========================================================
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

// ---- Fallback to index.html (SPA fallback) ----
// ✅ Only serve index.html for routes WITHOUT file extensions
app.get("*", (req, res) => {
if (path.extname(req.path)) return res.status(404).send("Not found");
res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});

