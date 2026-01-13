import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import multer from "multer";
import { fileURLToPath } from "url";
import { GoogleAuth } from "google-auth-library";
import { Storage } from "@google-cloud/storage";

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Path helpers (for ES Modules) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Middleware ----
app.use(express.json({ limit: "2mb" }));
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
limits: { fileSize: 8 * 1024 * 1024 }, // 8MB per image
});

// =========================================================
// Veo (Vertex AI) helpers
// =========================================================

// Put your SERVICE ACCOUNT JSON in Render as GEMINI_API_KEY_VIDEO.
// (Yes, the name is weird, but that's what you wanted for the video credential.)
const VIDEO_CREDS_RAW = process.env.GEMINI_API_KEY_VIDEO;

// Optional: set these in Render too (recommended)
const VERTEX_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT; // ex: "my-project-id"
const VERTEX_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

// Veo model (choose one)
const VEO_MODEL_ID = process.env.VEO_MODEL_ID || "veo-3.1-generate-001";

// If you want Veo to store output to GCS, set a bucket/prefix
// example: gs://my-bucket/veo-output/
const DEFAULT_OUTPUT_GCS_URI = process.env.VEO_OUTPUT_GCS_URI;

let cachedAuth = null;
let cachedStorage = null;

function getAuthAndStorage() {
if (cachedAuth && cachedStorage) return { auth: cachedAuth, storage: cachedStorage };

let authOptions = { scopes: ["https://www.googleapis.com/auth/cloud-platform"] };

// If GEMINI_API_KEY_VIDEO contains JSON, use it directly.
if (VIDEO_CREDS_RAW) {
try {
const creds = JSON.parse(VIDEO_CREDS_RAW);
authOptions.credentials = creds;

// If GOOGLE_CLOUD_PROJECT not set, try to infer from creds
if (!process.env.GOOGLE_CLOUD_PROJECT && creds.project_id) {
process.env.GOOGLE_CLOUD_PROJECT = creds.project_id;
}
} catch {
// If it's not JSON, assume it's using normal ADC (rare on Render)
// or you provided a path (not recommended on Render).
}
}

cachedAuth = new GoogleAuth(authOptions);
cachedStorage = new Storage(authOptions.credentials ? { credentials: authOptions.credentials } : undefined);

return { auth: cachedAuth, storage: cachedStorage };
}

async function getAccessToken() {
const { auth } = getAuthAndStorage();
const client = await auth.getClient();
const tokenResponse = await client.getAccessToken();
const token = tokenResponse?.token;
if (!token) throw new Error("Failed to obtain Google access token (check Service Account + permissions).");
return token;
}

function parseGsUri(gsUri) {
// gs://bucket/path/to/file.mp4
const m = gsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
if (!m) return null;
return { bucket: m[1], object: m[2] };
}

async function signGcsUrl(gsUri) {
const parsed = parseGsUri(gsUri);
if (!parsed) return null;

const { storage } = getAuthAndStorage();
const file = storage.bucket(parsed.bucket).file(parsed.object);

const [url] = await file.getSignedUrl({
version: "v4",
action: "read",
expires: Date.now() + 15 * 60 * 1000, // 15 minutes
});

return url;
}

// ---- Health check ----
app.get("/api/health", (req, res) => {
res.json({
ok: true,
status: "healthy",
textImageKeyPresent: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
videoCredsPresent: Boolean(process.env.GEMINI_API_KEY_VIDEO),
project: process.env.GOOGLE_CLOUD_PROJECT || null,
location: process.env.GOOGLE_CLOUD_LOCATION || VERTEX_LOCATION,
veoModel: VEO_MODEL_ID,
});
});

// =========================================================
// TEXT -> VIDEO (REAL VEO on Vertex AI)
// Start job: returns operationName
// =========================================================
app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

// Must have creds
if (!process.env.GEMINI_API_KEY_VIDEO) {
return res.status(500).json({
ok: false,
error:
"Missing video credentials. Set GEMINI_API_KEY_VIDEO (Service Account JSON) in Render env vars.",
});
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT || VERTEX_PROJECT_ID;
if (!projectId) {
return res.status(500).json({
ok: false,
error: "Missing GOOGLE_CLOUD_PROJECT. Set it in Render env vars.",
});
}

const accessToken = await getAccessToken();

const endpoint = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${VEO_MODEL_ID}:predictLongRunning`;

// Options from request (all optional)
const aspectRatio = (req.body?.aspectRatio || "16:9").toString(); // "16:9" or "9:16"
const sampleCount = Number(req.body?.sampleCount ?? 1); // 1-4
const storageUri = (req.body?.outputGcsUri || DEFAULT_OUTPUT_GCS_URI || "").trim();

const body = {
instances: [{ prompt }],
parameters: {
aspectRatio,
sampleCount,
...(storageUri ? { storageUri } : {}),
...(req.body?.negativePrompt ? { negativePrompt: String(req.body.negativePrompt) } : {}),
...(req.body?.personGeneration ? { personGeneration: String(req.body.personGeneration) } : {}),
...(req.body?.seed !== undefined ? { seed: Number(req.body.seed) } : {}),
},
};

const apiRes = await fetch(endpoint, {
method: "POST",
headers: {
Authorization: `Bearer ${accessToken}`,
"Content-Type": "application/json; charset=utf-8",
},
body: JSON.stringify(body),
});

const text = await apiRes.text();
let data;
try {
data = JSON.parse(text);
} catch {
return res.status(500).json({ ok: false, error: "Vertex returned non-JSON response", raw: text.slice(0, 400) });
}

if (!apiRes.ok) {
return res.status(apiRes.status).json({
ok: false,
error: data?.error?.message || "Veo request failed",
details: data,
});
}

// Response contains an operation name
return res.json({
ok: true,
operationName: data?.name,
message: "Veo job started. Poll /api/text-to-video/status with operationName.",
});
} catch (err) {
console.error("Text-to-Video error:", err);
return res.status(500).json({ ok: false, error: err.message || "Text-to-Video failed" });
}
});

// =========================================================
// TEXT -> VIDEO STATUS (poll op)
// When done, returns { videoUrl } (signed URL) if GCS output is used.
// =========================================================
app.post("/api/text-to-video/status", async (req, res) => {
try {
const operationName = (req.body?.operationName || "").trim();
if (!operationName) return res.status(400).json({ ok: false, error: "Missing operationName" });

if (!process.env.GEMINI_API_KEY_VIDEO) {
return res.status(500).json({
ok: false,
error:
"Missing video credentials. Set GEMINI_API_KEY_VIDEO (Service Account JSON) in Render env vars.",
});
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT || VERTEX_PROJECT_ID;
if (!projectId) {
return res.status(500).json({ ok: false, error: "Missing GOOGLE_CLOUD_PROJECT. Set it in Render env vars." });
}

const accessToken = await getAccessToken();

const endpoint = `https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${VEO_MODEL_ID}:fetchPredictOperation`;

const body = { operationName };

const apiRes = await fetch(endpoint, {
method: "POST",
headers: {
Authorization: `Bearer ${accessToken}`,
"Content-Type": "application/json; charset=utf-8",
},
body: JSON.stringify(body),
});

const text = await apiRes.text();
let data;
try {
data = JSON.parse(text);
} catch {
return res.status(500).json({ ok: false, error: "Vertex returned non-JSON response", raw: text.slice(0, 400) });
}

if (!apiRes.ok) {
return res.status(apiRes.status).json({
ok: false,
error: data?.error?.message || "Operation fetch failed",
details: data,
});
}

// If not done yet
if (!data?.done) {
return res.json({ ok: true, done: false, operation: data });
}

// Done — try to pull video GCS URI
const gcsUri =
data?.response?.videos?.[0]?.gcsUri ||
data?.response?.generatedVideos?.[0]?.video?.uri ||
data?.response?.result?.generated_videos?.[0]?.video?.uri;

let videoUrl = null;
if (gcsUri) {
videoUrl = await signGcsUrl(gcsUri);
}

return res.json({
ok: true,
done: true,
gcsUri: gcsUri || null,
videoUrl, // playable if present
operation: data,
});
} catch (err) {
console.error("Text-to-Video status error:", err);
return res.status(500).json({ ok: false, error: err.message || "Status check failed" });
}
});

// ---- Text -> Image (Gemini 3 Pro Image) ----
app.post("/api/text-to-image", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
if (!API_KEY) {
return res.status(500).json({
ok: false,
error: "Missing API key. Set GOOGLE_API_KEY (or GEMINI_API_KEY) in Render Environment.",
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
raw: text.slice(0, 400),
});
}

if (!apiRes.ok) {
return res.status(apiRes.status).json({
ok: false,
error: data?.error?.message || data?.error || "Gemini request failed",
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

return res.json({ ok: true, message: "Image generated", mimeType, base64 });
} catch (err) {
console.error("text-to-image error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// ---- Image -> Video (FFmpeg stitch) ----
app.post("/api/image-to-video", upload.array("images", 20), async (req, res) => {
const uploaded = req.files || [];
const secondsPerImage = Number(req.body?.secondsPerImage ?? 1.5);

if (!uploaded.length) {
return res.status(400).json({ ok: false, error: "No images uploaded" });
}
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
reject(new Error(`FFmpeg failed (code ${code}). ${errBuf.slice(-800)}`));
});
});

res.setHeader("Content-Type", "video/mp4");
res.setHeader("Content-Disposition", `inline; filename="slideshow.mp4"`);

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


