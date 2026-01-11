
// =============================
// Text -> Video (Veo on Vertex)
// =============================
app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

// ====== CONFIG (Render env vars) ======
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID; // required
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
const MODEL_ID = process.env.VEO_MODEL_ID || "veo-2.0-generate-exp";

// IMPORTANT: Vertex needs a Bearer token (OAuth). If you don't have this, Veo won't run.
const ACCESS_TOKEN = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;

if (!PROJECT_ID) {
return res.status(500).json({ ok: false, error: "Missing GOOGLE_CLOUD_PROJECT_ID env var" });
}
if (!ACCESS_TOKEN) {
return res.status(500).json({
ok: false,
error: "Missing GOOGLE_CLOUD_ACCESS_TOKEN env var (Vertex Veo uses Bearer auth).",
});
}

const startEndpoint =
`https://${LOCATION}-aiplatform.googleapis.com/v1/` +
`projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predictLongRunning`;

const requestBody = {
instances: [{ prompt }],
parameters: {
durationSeconds: 8,
sampleCount: 1,
// If you set storageUri, you'll usually get gcsUri back.
// storageUri: "gs://YOUR_BUCKET/output/"
},
};

// 1) START GENERATION (long-running op)
const startResp = await fetch(startEndpoint, {
method: "POST",
headers: {
Authorization: `Bearer ${ACCESS_TOKEN}`,
"Content-Type": "application/json; charset=utf-8",
},
body: JSON.stringify(requestBody),
});

const startText = await startResp.text();
let startJson = null;
try { startJson = JSON.parse(startText); } catch {}

if (!startResp.ok) {
console.error("Veo start error:", startResp.status, startText);
return res.status(502).json({
ok: false,
error: `Veo start failed (${startResp.status})`,
details: startJson || startText,
});
}

const operationName = startJson?.name;
if (!operationName) {
console.error("No operation name returned:", startText);
return res.status(502).json({ ok: false, error: "No operation name returned from Veo" });
}

// 2) POLL STATUS
const pollEndpoint =
`https://${LOCATION}-aiplatform.googleapis.com/v1/` +
`projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:fetchPredictOperation`;

const maxAttempts = 30; // 30 * 3s = 90s
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
await new Promise((r) => setTimeout(r, 3000));

const pollResp = await fetch(pollEndpoint, {
method: "POST",
headers: {
Authorization: `Bearer ${ACCESS_TOKEN}`,
"Content-Type": "application/json; charset=utf-8",
},
body: JSON.stringify({ operationName }),
});

const pollText = await pollResp.text();
let pollJson = null;
try { pollJson = JSON.parse(pollText); } catch {}

if (!pollResp.ok) {
console.error("Veo poll error:", pollResp.status, pollText);
return res.status(502).json({
ok: false,
error: `Veo poll failed (${pollResp.status})`,
details: pollJson || pollText,
});
}

if (pollJson?.done) {
const videos = pollJson?.response?.videos || [];
if (!videos.length) {
console.error("Veo done but no videos:", pollJson);
return res.status(502).json({ ok: false, error: "Veo finished but returned no videos" });
}

const v0 = videos[0];

// ✅ BEST CASE: bytes returned (frontend can play immediately)
if (v0?.bytesBase64Encoded) {
return res.json({
ok: true,
base64: v0.bytesBase64Encoded,
mimeType: v0.mimeType || "video/mp4",
});
}

// ✅ COMMON CASE: gcsUri returned -> browser can't play gcsUri directly
// So we return a URL to our proxy endpoint that streams it.
if (v0?.gcsUri) {
const proxyUrl = `/api/video-proxy?gcsUri=${encodeURIComponent(v0.gcsUri)}`;
return res.json({
ok: true,
videoUrl: proxyUrl,
mimeType: v0.mimeType || "video/mp4",
gcsUri: v0.gcsUri,
});
}

return res.status(502).json({
ok: false,
error: "Unknown video payload format",
details: v0,
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
// This is what fixes the "black player" issue.
// ===========================================
app.get("/api/video-proxy", async (req, res) => {
try {
const gcsUri = (req.query?.gcsUri || "").toString();
if (!gcsUri.startsWith("gs://")) {
return res.status(400).send("Missing or invalid gcsUri");
}

const ACCESS_TOKEN = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
return res.status(500).send("Missing GOOGLE_CLOUD_ACCESS_TOKEN");
}

// Parse: gs://bucket/path/to/file.mp4
const without = gcsUri.replace("gs://", "");
const firstSlash = without.indexOf("/");
const bucket = firstSlash === -1 ? without : without.slice(0, firstSlash);
const object = firstSlash === -1 ? "" : without.slice(firstSlash + 1);

if (!bucket || !object) {
return res.status(400).send("Invalid gcsUri format");
}

// Google Cloud Storage JSON API (media download)
const downloadUrl =
`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}` +
`/o/${encodeURIComponent(object)}?alt=media`;

const upstream = await fetch(downloadUrl, {
headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
});

if (!upstream.ok) {
const t = await upstream.text().catch(() => "");
console.error("GCS proxy fetch failed:", upstream.status, t.slice(0, 400));
return res.status(502).send(`Failed to fetch video from GCS (${upstream.status})`);
}

res.setHeader("Content-Type", upstream.headers.get("content-type") || "video/mp4");
res.setHeader("Cache-Control", "no-store");

// Stream mp4 bytes to the browser
const arrayBuffer = await upstream.arrayBuffer();
res.send(Buffer.from(arrayBuffer));
} catch (err) {
console.error("video-proxy error:", err);
res.status(500).send(err?.message || "Server error");
}
});
