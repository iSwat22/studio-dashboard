// ---- Image -> Video (Veo on Vertex AI) ----
// Accepts ONE image as first frame + optional prompt
app.post("/api/image-to-video", upload.single("image"), async (req, res) => {
try {
const file = req.file;
const prompt = (req.body?.prompt || "").toString().trim();

if (!file) {
return res.status(400).json({ ok: false, error: "Missing image file" });
}

// Must have creds
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
return res.status(500).json({
ok: false,
error:
"Missing GOOGLE_APPLICATION_CREDENTIALS_JSON (Service Account JSON) in Render env vars.",
});
}

const projectId = process.env.GOOGLE_CLOUD_PROJECT || VERTEX_PROJECT_ID;
if (!projectId) {
return res.status(500).json({
ok: false,
error: "Missing GOOGLE_CLOUD_PROJECT in Render env vars.",
});
}

const accessToken = await getAccessToken();

const endpoint =
`https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/` +
`projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${VEO_MODEL_ID}:predictLongRunning`;

// Keep it short for testing
const durationSecondsRaw = Number(req.body?.durationSeconds ?? 6);
const durationSeconds = Math.max(1, Math.min(durationSecondsRaw, 20));

const aspectRatio = (req.body?.aspectRatio || "16:9").toString();

// Optional output bucket (RECOMMENDED)
// Example: gs://your-bucket/veo-output/
const storageUri = (DEFAULT_OUTPUT_GCS_URI || "").trim();

const body = {
instances: [
{
...(prompt ? { prompt } : {}),
image: {
mimeType: file.mimetype,
bytesBase64Encoded: fs.readFileSync(file.path).toString("base64"),
},
},
],
parameters: {
aspectRatio,
durationSeconds,
sampleCount: 1,
...(storageUri ? { storageUri } : {}),
},
};

// 1) Start generation
const startResp = await fetch(endpoint, {
method: "POST",
headers: {
Authorization: `Bearer ${accessToken}`,
"Content-Type": "application/json; charset=utf-8",
},
body: JSON.stringify(body),
});

const startText = await startResp.text();
let startJson = null;
try {
startJson = JSON.parse(startText);
} catch {}

if (!startResp.ok) {
return res.status(502).json({
ok: false,
error: `Veo start failed (${startResp.status})`,
details: startJson || startText,
});
}

const operationName = startJson?.name;
if (!operationName) {
return res.status(502).json({
ok: false,
error: "No operation name returned from Veo",
details: startJson,
});
}

// 2) Poll
const pollEndpoint =
`https://${VERTEX_LOCATION}-aiplatform.googleapis.com/v1/` +
`projects/${projectId}/locations/${VERTEX_LOCATION}/publishers/google/models/${VEO_MODEL_ID}:fetchPredictOperation`;

for (let attempt = 1; attempt <= 40; attempt++) {
await new Promise((r) => setTimeout(r, 3000));

const pollResp = await fetch(pollEndpoint, {
method: "POST",
headers: {
Authorization: `Bearer ${accessToken}`,
"Content-Type": "application/json; charset=utf-8",
},
body: JSON.stringify({ operationName }),
});

const pollText = await pollResp.text();
let pollJson = null;
try {
pollJson = JSON.parse(pollText);
} catch {}

if (!pollResp.ok) {
return res.status(502).json({
ok: false,
error: `Veo poll failed (${pollResp.status})`,
details: pollJson || pollText,
});
}

if (pollJson?.done) {
const videos = pollJson?.response?.videos || [];
if (!videos.length) {
return res.status(502).json({
ok: false,
error: "Veo finished but returned no videos",
details: pollJson,
});
}

const v0 = videos[0];

// If bytes returned
if (v0?.bytesBase64Encoded) {
return res.json({
ok: true,
mimeType: v0.mimeType || "video/mp4",
base64: v0.bytesBase64Encoded,
});
}

// If GCS returned
if (v0?.gcsUri) {
const signed = await signGcsUrl(v0.gcsUri);
return res.json({
ok: true,
mimeType: v0.mimeType || "video/mp4",
gcsUri: v0.gcsUri,
videoUrl: signed, // playable
});
}

return res.status(502).json({
ok: false,
error: "Unknown video payload format",
details: v0,
});
}
}

return res.status(504).json({ ok: false, error: "Timed out waiting for Veo" });
} catch (err) {
console.error("image-to-video error:", err);
return res.status(500).json({ ok: false, error: err?.message || "Server error" });
} finally {
// cleanup uploaded temp file
try {
if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
} catch {}
}
});


