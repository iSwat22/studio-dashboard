const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleAuth } = require("google-auth-library");

const app = express();

// ---------- Middleware ----------
app.use(cors());
app.use(express.json({ limit: "2mb" })); // text prompts are small
app.use(express.urlencoded({ extended: true }));

// Serve your frontend (if you keep HTML files in /public)
app.use(express.static(path.join(__dirname, "public")));

// Health check (easy test)
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ---------- Google Auth Helper (BEST PRACTICE) ----------
// Put your Service Account JSON into Render as env var: GOOGLE_SERVICE_ACCOUNT_JSON
// (Copy/paste the entire JSON from Google Cloud service account key.)
function getGoogleAuthClient() {
const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
if (!saJson) return null;

let credentials;
try {
credentials = JSON.parse(saJson);
} catch (e) {
throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
}

return new GoogleAuth({
credentials,
scopes: ["https://www.googleapis.com/auth/cloud-platform"]
});
}

async function getAccessToken() {
const auth = getGoogleAuthClient();
if (!auth) {
throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_JSON (recommended on Render)");
}

const client = await auth.getClient();
const tokenResponse = await client.getAccessToken();
const token = tokenResponse?.token;

if (!token) throw new Error("Failed to obtain Google access token");
return token;
}

// =============================
// Text -> Video (Veo on Vertex)
// =============================
app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

// CONFIG
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID; // required
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

// Use the doc model id (your "exp" one can fail)
const MODEL_ID = process.env.VEO_MODEL_ID || "veo-2.0-generate-001";

// OPTIONAL but recommended: output bucket
// Example: gs://your-bucket/videos/
const STORAGE_URI = process.env.VEO_STORAGE_URI || "";

if (!PROJECT_ID) {
return res.status(500).json({ ok: false, error: "Missing GOOGLE_CLOUD_PROJECT_ID env var" });
}

const ACCESS_TOKEN = await getAccessToken();

const startEndpoint =
`https://${LOCATION}-aiplatform.googleapis.com/v1/` +
`projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predictLongRunning`;

// IMPORTANT: Keep this aligned with docs.
// If you provide storageUri, you'll usually get gcsUri back.
const requestBody = {
instances: [{ prompt }],
parameters: {
sampleCount: 1,
...(STORAGE_URI ? { storageUri: STORAGE_URI } : {})
}
};

// 1) Start generation
const startResp = await fetch(startEndpoint, {
method: "POST",
headers: {
Authorization: `Bearer ${ACCESS_TOKEN}`,
"Content-Type": "application/json; charset=utf-8"
},
body: JSON.stringify(requestBody)
});

const startText = await startResp.text();
let startJson = null;
try { startJson = JSON.parse(startText); } catch {}

if (!startResp.ok) {
console.error("Veo start error:", startResp.status, startText);
return res.status(502).json({
ok: false,
error: `Veo start failed (${startResp.status})`,
details: startJson || startText
});
}

const operationName = startJson?.name;
if (!operationName) {
console.error("No operation name returned:", startText);
return res.status(502).json({ ok: false, error: "No operation name returned from Veo" });
}

// 2) Poll
const pollEndpoint =
`https://${LOCATION}-aiplatform.googleapis.com/v1/` +
`projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:fetchPredictOperation`;

const maxAttempts = 40; // 40 * 3s = 120s
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
await new Promise((r) => setTimeout(r, 3000));

const pollResp = await fetch(pollEndpoint, {
method: "POST",
headers: {
Authorization: `Bearer ${ACCESS_TOKEN}`,
"Content-Type": "application/json; charset=utf-8"
},
body: JSON.stringify({ operationName })
});

const pollText = await pollResp.text();
let pollJson = null;
try { pollJson = JSON.parse(pollText); } catch {}

if (!pollResp.ok) {
console.error("Veo poll error:", pollResp.status, pollText);
return res.status(502).json({
ok: false,
error: `Veo poll failed (${pollResp.status})`,
details: pollJson || pollText
});
}

if (pollJson?.done) {
const videos = pollJson?.response?.videos || [];
if (!videos.length) {
console.error("Veo done but no videos:", pollJson);
return res.status(502).json({ ok: false, error: "Veo finished but returned no videos" });
}

const v0 = videos[0];

// If bytes returned
if (v0?.bytesBase64Encoded) {
return res.json({
ok: true,
base64: v0.bytesBase64Encoded,
mimeType: v0.mimeType || "video/mp4"
});
}

// If gcsUri returned
if (v0?.gcsUri) {
const proxyUrl = `/api/video-proxy?gcsUri=${encodeURIComponent(v0.gcsUri)}`;
return res.json({
ok: true,
videoUrl: proxyUrl,
mimeType: v0.mimeType || "video/mp4",
gcsUri: v0.gcsUri
});
}

return res.status(502).json({
ok: false,
error: "Unknown video payload format",
details: v0
});
}
}

return res.status(504).json({ ok: false, error: "Timed out waiting for Veo video" });
} catch (err) {
console.error("text-to-video error:", err);
return res.status(500).json({ ok: false, error: err?.message || "Server error" });
}
});

// ===========================================
// Video Proxy: streams Veo gcsUri as mp4
// ===========================================
app.get("/api/video-proxy", async (req, res) => {
try {
const gcsUri = (req.query?.gcsUri || "").toString();
if (!gcsUri.startsWith("gs://")) {
return res.status(400).send("Missing or invalid gcsUri");
}

const ACCESS_TOKEN = await getAccessToken();

const without = gcsUri.replace("gs://", "");
const firstSlash = without.indexOf("/");
const bucket = firstSlash === -1 ? without : without.slice(0, firstSlash);
const object = firstSlash === -1 ? "" : without.slice(firstSlash + 1);

if (!bucket || !object) {
return res.status(400).send("Invalid gcsUri format");
}

const downloadUrl =
`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}` +
`/o/${encodeURIComponent(object)}?alt=media`;

const upstream = await fetch(downloadUrl, {
headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
});

if (!upstream.ok) {
const t = await upstream.text().catch(() => "");
console.error("GCS proxy fetch failed:", upstream.status, t.slice(0, 400));
return res.status(502).send(`Failed to fetch video from GCS (${upstream.status})`);
}

res.setHeader("Content-Type", upstream.headers.get("content-type") || "video/mp4");
res.setHeader("Cache-Control", "no-store");

// NOTE: for big videos, streaming is better than buffering.
// But this is fine for short clips.
const arrayBuffer = await upstream.arrayBuffer();
res.send(Buffer.from(arrayBuffer));
} catch (err) {
console.error("video-proxy error:", err);
res.status(500).send(err?.message || "Server error");
}
});

// ---------- Start server ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
console.log(`✅ Server listening on port ${PORT}`);
});

