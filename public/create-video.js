/* create-video.js */
console.log("create-video.js loaded");

// ======================================================
// TEXT -> VIDEO (create-video.html)
// - Starts job: POST /api/text-to-video
// - Polls: POST /api/text-to-video/status
// - Fixes: forces <video> to LOAD/PLAY + logs videoUrl + catches load errors
// ======================================================

const pickFirst = (...ids) =>
ids.map((id) => document.getElementById(id)).find(Boolean);

// Try multiple possible IDs so this works across your pages
const t2vPrompt = pickFirst("t2vPrompt", "prompt");
const t2vBtn = pickFirst("t2vBtn", "generateBtn");
const t2vStatus = pickFirst("t2vStatus", "status", "statusText", "outputStatus", "previewEmpty");
const t2vVideo = pickFirst("t2vVideo", "resultVideo", "video", "previewVideo");

const downloadBtn = pickFirst("downloadBtn");
const deleteBtn = pickFirst("deleteBtn");
const saveToAssetsBtn = pickFirst("saveToAssetsBtn");

const t2vDuration = pickFirst("t2vDuration", "duration");
const t2vAspect = pickFirst("t2vAspect", "aspect");

function setT2vStatus(msg) {
if (t2vStatus) t2vStatus.textContent = msg;
console.log("[T2V]", msg);
}

function hideT2vButtons() {
if (downloadBtn) downloadBtn.style.display = "none";
if (deleteBtn) downloadBtn.style.display = "none";
if (saveToAssetsBtn) saveToAssetsBtn.style.display = "none";
}

function showT2vButtons(finalUrl) {
if (downloadBtn) {
downloadBtn.href = finalUrl;
downloadBtn.download = "quanneleap-text-video.mp4";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
if (saveToAssetsBtn) saveToAssetsBtn.style.display = "inline-flex";
}

function extractVideoUrl(data) {
if (!data) return null;
if (typeof data === "string") return data;

return (
data.videoUrl ||
data.url ||
data.uri ||
data?.result?.videoUrl ||
data?.result?.url ||
data?.result?.uri ||
data?.data?.videoUrl ||
data?.data?.url ||
null
);
}

async function startTextToVideoJob(prompt, options) {
const payload = {
prompt,
aspectRatio: options.aspectRatio,
durationSeconds: options.durationSeconds,
};

const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

const data = await res.json().catch(() => ({}));
console.log("startTextToVideoJob response:", res.status, data);

if (!res.ok || !data.ok) throw new Error(data.error || "Failed to start video job");
if (!data.operationName) throw new Error("Server did not return operationName");

return data.operationName;
}

async function pollTextToVideo(operationName) {
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxAttempts = 120;

for (let i = 1; i <= maxAttempts; i++) {
setT2vStatus(`Generating video… (${i}/${maxAttempts})`);
await sleep(3000);

const res = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const data = await res.json().catch(() => ({}));
if (i === 1 || i % 5 === 0) console.log("pollTextToVideo tick:", i, res.status, data);

if (!res.ok || !data.ok) throw new Error(data.error || "Status check failed");

if (data.done) {
console.log("pollTextToVideo DONE:", res.status, data);
const videoUrl = extractVideoUrl(data);
if (videoUrl) return { videoUrl };

// Support base64 fallback
if (data.base64) {
return { base64: data.base64, mimeType: data.mimeType || "video/mp4" };
}

throw new Error("Video finished, but no videoUrl/base64 returned");
}
}

throw new Error("Timed out waiting for the video to finish");
}

// Only wire Text→Video if the page has the elements
if (t2vPrompt && t2vBtn && t2vVideo) {
let lastObjectUrl = null;

function clearT2vUI() {
if (lastObjectUrl) {
URL.revokeObjectURL(lastObjectUrl);
lastObjectUrl = null;
}

// Clear video
try { t2vVideo.pause?.(); } catch {}
t2vVideo.removeAttribute("src");
t2vVideo.load?.();
t2vVideo.style.display = "none";

hideT2vButtons();
setT2vStatus("Your generated video will appear here.");
}

async function setVideoSrc(url) {
// IMPORTANT: force <video> to load, and capture real load errors
t2vVideo.style.display = "block";
t2vVideo.controls = true;
t2vVideo.muted = false;

// clear first so the browser reloads even if same URL
t2vVideo.removeAttribute("src");
t2vVideo.load?.();

console.log("[T2V] Setting video src:", url);
t2vVideo.src = url;

// Catch “video file not accessible” issues
t2vVideo.onerror = () => {
console.error("[T2V] <video> failed to load:", url, t2vVideo.error);
setT2vStatus("❌ Video URL returned, but the browser could not load it (check Network tab for 403/404).");
};

t2vVideo.onloadeddata = () => {
console.log("[T2V] Video loaded OK");
setT2vStatus("✅ Video ready");
};

t2vVideo.load?.();

// Try autoplay (may be blocked — that’s fine)
try {
await t2vVideo.play?.();
} catch (e) {
console.warn("[T2V] Autoplay blocked (normal). Click play:", e);
}
}

async function generateT2v(prompt) {
t2vBtn.disabled = true;
clearT2vUI();

const durationSeconds = Number(t2vDuration?.value || 8);
const aspectRatio = String(t2vAspect?.value || "16:9");

try {
setT2vStatus("Starting video job…");
const opName = await startTextToVideoJob(prompt, { durationSeconds, aspectRatio });

const result = await pollTextToVideo(opName);

// URL result
if (result.videoUrl) {
showT2vButtons(result.videoUrl);
await setVideoSrc(result.videoUrl);
return;
}

// base64 result
if (result.base64) {
const byteChars = atob(result.base64);
const byteNumbers = new Array(byteChars.length);
for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);

const blob = new Blob([new Uint8Array(byteNumbers)], { type: result.mimeType || "video/mp4" });
lastObjectUrl = URL.createObjectURL(blob);

showT2vButtons(lastObjectUrl);
await setVideoSrc(lastObjectUrl);
return;
}

throw new Error("Unknown video response format");
} catch (err) {
console.error(err);
setT2vStatus(`❌ ${err.message || err}`);
hideT2vButtons();
} finally {
t2vBtn.disabled = false;
}
}

t2vBtn.addEventListener("click", () => {
const prompt = (t2vPrompt.value || "").trim();
if (!prompt) return setT2vStatus("Please enter a prompt.");
generateT2v(prompt);
});

if (deleteBtn) deleteBtn.addEventListener("click", clearT2vUI);
}
