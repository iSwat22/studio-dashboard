/* ======================================================
QuanneLeap.AI — create-video.js (Single Source of Truth)
- Uses ONLY create-video.html IDs
- Calls /api/text-to-video then polls /api/text-to-video/status
- Supports:
- proxyUrl / videoUrl (direct playback)
- base64 mp4 (Blob playback)
- gcsUri (shows message; next step is stream/signed-url endpoint)

✅ NEW (Option A):
- If durationSeconds > 8, it automatically uses:
POST /api/text-to-video-batch
POST /api/text-to-video-batch/status
- Final result is a playable URL (/public/exports/*.mp4)

✅ NEW (VOICE):
- After we have a playable video URL, we call:
POST /api/text-to-video-narrated
{ videoUrl, text }
- Result: finalVideoUrl that includes audio
====================================================== */

const USER = { name: "KC", role: "Admin", plan: "Platinum", stars: "∞", isAdmin: true };

// Track Blob URLs so we can revoke them and avoid memory leaks
let lastBlobUrl = null;

function applyUserUI() {
const planPill = document.getElementById("planPill");
const starsPill = document.getElementById("starsPill");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");
const avatarCircle = document.getElementById("avatarCircle");

if (planPill) planPill.textContent = USER.plan;
if (starsPill) starsPill.textContent = USER.isAdmin ? "★ ∞" : `★ ${USER.stars}`;
if (profileName) profileName.textContent = USER.name;
if (profileRole) profileRole.textContent = USER.role;
if (avatarCircle) avatarCircle.textContent = (USER.name || "U").trim().charAt(0).toUpperCase();
}

function $(id) {
return document.getElementById(id);
}

function setStatus(msg) {
const empty = $("previewEmpty");
if (empty) empty.textContent = msg;
console.log("[T2V]", msg);
}

function resetVideoElement() {
const video = $("previewVideo");
const empty = $("previewEmpty");
const download = $("downloadBtn");

if (video) {
video.pause?.();
video.removeAttribute("src");
video.load();
video.style.display = "none";
}

if (empty) empty.style.display = "block";
if (download) download.style.display = "none";

// Revoke any previous blob url to avoid memory leak
if (lastBlobUrl) {
try { URL.revokeObjectURL(lastBlobUrl); } catch {}
lastBlobUrl = null;
}
}

function showVideo(url) {
const video = $("previewVideo");
const empty = $("previewEmpty");
const download = $("downloadBtn");

if (!video) return;

// show video area
if (empty) empty.style.display = "none";
video.style.display = "block";

// IMPORTANT: force reload each time
video.pause?.();
video.removeAttribute("src");
video.load();

// cache-bust to avoid 304 weirdness during testing (only for http urls)
const finalUrl =
url.startsWith("blob:")
? url
: url + (url.includes("?") ? "&" : "?") + "cb=" + Date.now();

video.src = finalUrl;
video.setAttribute("playsinline", "");
video.muted = false;
video.load();

// optional download button
if (download) {
download.href = finalUrl;
download.download = "quannaleap-text-video.mp4";
download.style.display = "inline-flex";
}

// Try autoplay (may be blocked)
video.play().catch(() => {
// fine if blocked — user can press play
});
}

function base64ToBlobUrl(base64, mimeType = "video/mp4") {
// base64 could be plain or data-url-like; normalize
const cleaned = String(base64).includes(",")
? String(base64).split(",").pop()
: String(base64);

const byteChars = atob(cleaned);
const byteNums = new Array(byteChars.length);
for (let i = 0; i < byteChars.length; i++) {
byteNums[i] = byteChars.charCodeAt(i);
}
const byteArray = new Uint8Array(byteNums);
const blob = new Blob([byteArray], { type: mimeType });

const blobUrl = URL.createObjectURL(blob);
lastBlobUrl = blobUrl;
return blobUrl;
}

/* ======================================================
Helpers for narrated mux step
====================================================== */
function stripCb(url) {
// remove repeated cb params (and anything after if it got glued wrong)
// keeps the real video URL clean for the backend
try {
const u = new URL(url, window.location.origin);
u.searchParams.delete("cb");
return u.toString();
} catch {
// if it's not parseable, do a basic split
return String(url).split("&cb=")[0].split("?cb=")[0];
}
}

// ✅ FIXED: This returns finalVideoUrl (so caller can show it)
async function makeNarratedVideo({ videoUrl, text }) {
const res = await fetch("/api/text-to-video-narrated", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
videoUrl: stripCb(videoUrl),
text: String(text || "").trim(),
}),
});

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) {
throw new Error(data?.error || "Narration failed");
}

if (!data.finalVideoUrl) {
throw new Error("Narration finished but no finalVideoUrl returned");
}

return data.finalVideoUrl;
}

function getNarrationTextFallbackToPrompt(prompt) {
// If you add a narration textbox in HTML later, use id="narration"
const narrationEl = $("narration");
const narrationText = (narrationEl?.value || "").trim();
return narrationText || prompt; // fallback = prompt
}

async function startTextToVideoJob({ prompt, durationSeconds, aspectRatio }) {
const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt, durationSeconds, aspectRatio }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) throw new Error(data.error || "Failed to start video job");
if (!data.operationName) throw new Error("Server did not return operationName");
return data.operationName;
}

async function pollTextToVideo(operationName) {
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxAttempts = 100;

for (let i = 1; i <= maxAttempts; i++) {
setStatus(`Generating video… (${i}/${maxAttempts})`);
await sleep(2500);

const res = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) throw new Error(data.error || "Status check failed");

if (data.done) {
// ✅ Case 1: URL playback
const finalUrl = data.proxyUrl || data.videoUrl;
if (finalUrl) return { type: "url", value: finalUrl };

// ✅ Case 2: Base64 playback
if (data.base64) {
return {
type: "base64",
value: data.base64,
mimeType: data.mimeType || "video/mp4",
};
}

// ✅ Case 3: GCS URI (needs streaming/signed URL endpoint)
if (data.gcsUri) {
return { type: "gcs", value: data.gcsUri };
}

throw new Error("Video finished, but no playable output returned");
}
}

throw new Error("Timed out waiting for the video");
}

/* ======================================================
✅ NEW: Batch (Option A) for duration > 8 seconds
====================================================== */
async function startTextToVideoBatchJob({ prompt, totalSeconds, aspectRatio }) {
const res = await fetch("/api/text-to-video-batch", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
prompt,
totalSeconds, // overall length you want
clipSeconds: 8, // keep Veo clips at 8s
aspectRatio,
}),
});

const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) throw new Error(data.error || "Failed to start batch video job");
if (!data.batchId) throw new Error("Server did not return batchId");
return data.batchId;
}

async function pollTextToVideoBatch(batchId) {
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxAttempts = 600; // longer because we're generating multiple clips

for (let i = 1; i <= maxAttempts; i++) {
setStatus(`Generating long video… (${i}/${maxAttempts})`);
await sleep(2500);

const res = await fetch("/api/text-to-video-batch/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ batchId }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) throw new Error(data.error || "Batch status check failed");

if (data.done) {
if (data.finalVideoUrl) return { type: "url", value: data.finalVideoUrl };
throw new Error("Batch finished, but no finalVideoUrl returned");
}
}

throw new Error("Timed out waiting for the long video");
}

async function onGenerateClick() {
const promptEl = $("prompt"); // from create-video.html
const generateBtn = $("generateBtn");
const durationEl = $("duration");
const aspectEl = $("aspect");

const prompt = (promptEl?.value || "").trim();
if (!prompt) return setStatus("Please enter a prompt.");

// Reset UI
resetVideoElement();

const durationSeconds = Number(durationEl?.value || 8);

// Map your UI aspect values to backend aspect ratios
const aspectUi = String(aspectEl?.value || "landscape");
const aspectRatio =
aspectUi === "portrait" ? "9:16" :
aspectUi === "square" ? "1:1" :
"16:9";

try {
if (generateBtn) generateBtn.disabled = true;

// Narration text (if no narration field exists, uses prompt)
const narrationText = getNarrationTextFallbackToPrompt(prompt);

// ✅ AUTO SWITCH:
// <= 8 sec uses regular endpoint
// > 8 sec uses batch endpoint (Option A)
if (Number.isFinite(durationSeconds) && durationSeconds > 8) {
setStatus("Starting long video job… (batch)");
const batchId = await startTextToVideoBatchJob({
prompt,
totalSeconds: durationSeconds,
aspectRatio,
});

const result = await pollTextToVideoBatch(batchId);

if (result.type === "url") {
setStatus("Adding voice…");
const narratedUrl = await makeNarratedVideo({
videoUrl: result.value,
text: narrationText,
});

setStatus("✅ Video + Voice ready");
showVideo(narratedUrl);
return;
}

setStatus("❌ Unknown result type");
return;
}

// ---- Normal (<= 8 sec) ----
setStatus("Starting video job…");
const opName = await startTextToVideoJob({ prompt, durationSeconds, aspectRatio });

const result = await pollTextToVideo(opName);

// We need a URL to mux. If we got base64, we can still PLAY it,
// but we cannot mux it on the server without uploading it.
if (result.type === "url") {
setStatus("Adding voice…");
const narratedUrl = await makeNarratedVideo({
videoUrl: result.value,
text: narrationText,
});

setStatus("✅ Video + Voice ready");
showVideo(narratedUrl);
return;
}

if (result.type === "base64") {
// Still show video (no voice mux for this case)
setStatus("✅ Video ready (base64). Voice mux needs a URL output, not base64.");
const blobUrl = base64ToBlobUrl(result.value, result.mimeType);
showVideo(blobUrl);
return;
}

if (result.type === "gcs") {
setStatus(
`✅ Veo finished. Output is in GCS: ${result.value}\nNext step: add a stream/signed-url endpoint so the preview can play it.`
);
return;
}

setStatus("❌ Unknown result type");
} catch (err) {
console.error(err);
setStatus(`❌ ${err?.message || err}`);
} finally {
if (generateBtn) generateBtn.disabled = false;
}
}

function initButtons() {
const clearBtn = $("clearBtn");
const pasteBtn = $("pasteBtn");
const generateBtn = $("generateBtn");

if (clearBtn) {
clearBtn.addEventListener("click", () => {
const p = $("prompt");
if (p) p.value = "";
resetVideoElement();
setStatus("Cleared.");
});
}

if (pasteBtn) {
pasteBtn.addEventListener("click", async () => {
try {
const txt = await navigator.clipboard.readText();
const p = $("prompt");
if (p) p.value = (p.value ? p.value + "\n" : "") + txt;
setStatus("Pasted from clipboard.");
} catch {
setStatus("Clipboard paste blocked. (Browser permissions)");
}
});
}

if (generateBtn) {
generateBtn.addEventListener("click", onGenerateClick);
}
}

/* ---------- BOOT ---------- */
document.addEventListener("DOMContentLoaded", () => {
applyUserUI();
initButtons();
setStatus("Your generated video will appear here.");
});



