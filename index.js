// --- Text -> Video (Veo) ---
app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

// ====== CONFIG ======
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID; // set in Render
const LOCATION = "us-central1";
const MODEL_ID = "veo-2.0-generate-exp"; // from Google docs
const ACCESS_TOKEN = process.env.GOOGLE_CLOUD_ACCESS_TOKEN;
// NOTE: Vertex docs show Bearer token auth (gcloud access token). [oai_citation:5‡Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)

if (!PROJECT_ID) {
return res.status(500).json({ ok: false, error: "Missing GOOGLE_CLOUD_PROJECT_ID env var" });
}
if (!ACCESS_TOKEN) {
return res.status(500).json({
ok: false,
error:
"Missing GOOGLE_CLOUD_ACCESS_TOKEN env var (Vertex Veo needs Bearer token auth).",
});
}

const endpoint =
`https://${LOCATION}-aiplatform.googleapis.com/v1/` +
`projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${MODEL_ID}:predictLongRunning`;

const requestBody = {
instances: [{ prompt }],
parameters: {
durationSeconds: 8,
sampleCount: 1,
// IMPORTANT:
// If you set storageUri, response returns gcsUri. [oai_citation:6‡Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
// If you omit storageUri, docs say video bytes may be returned instead. [oai_citation:7‡Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
// storageUri: "gs://YOUR_BUCKET/output/"
},
};

// 1) START GENERATION (long-running op)
const startResp = await fetch(endpoint, {
method: "POST",
headers: {
"Authorization": `Bearer ${ACCESS_TOKEN}`,
"Content-Type": "application/json; charset=utf-8",
},
body: JSON.stringify(requestBody),
});

const startText = await startResp.text(); // <-- always read as text first
let startJson = null;
try { startJson = JSON.parse(startText); } catch (_) {}

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

const maxAttempts = 30; // ~30 * 3s = 90s
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
await new Promise(r => setTimeout(r, 3000));

const pollResp = await fetch(pollEndpoint, {
method: "POST",
headers: {
"Authorization": `Bearer ${ACCESS_TOKEN}`,
"Content-Type": "application/json; charset=utf-8",
},
body: JSON.stringify({ operationName }),
});

const pollText = await pollResp.text();
let pollJson = null;
try { pollJson = JSON.parse(pollText); } catch (_) {}

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

// Common case (docs sample): gcsUri result [oai_citation:8‡Google Cloud Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation)
if (videos[0].gcsUri) {
return res.json({ ok: true, gcsUri: videos[0].gcsUri, mimeType: videos[0].mimeType || "video/mp4" });
}

// If bytes are returned (varies by config), handle it:
if (videos[0].bytesBase64Encoded) {
return res.json({ ok: true, base64: videos[0].bytesBase64Encoded, mimeType: videos[0].mimeType || "video/mp4" });
}

return res.status(502).json({ ok: false, error: "Unknown video payload format", details: videos[0] });
}
}

return res.status(504).json({ ok: false, error: "Timed out waiting for Veo video" });
} catch (err) {
console.error("text-to-video error:", err);
return res.status(500).json({ ok: false, error: err?.message || "Server error" });
}
})
