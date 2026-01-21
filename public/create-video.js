/* create-video.js */
console.log("create-video.js loaded");

/* =========
Helpers
========= */
const $ = (id) => document.getElementById(id);

const promptEl = $("prompt");
const generateBtn = $("generateBtn");

const aspectEl = $("aspect");
const durationEl = $("duration");
const qualityEl = $("quality"); // not used by old API, but kept for future

const previewVideo = $("previewVideo");
const previewEmpty = $("previewEmpty");
const downloadBtn = $("downloadBtn");

// Optional buttons (if present)
const clearBtn = $("clearBtn");
const pasteBtn = $("pasteBtn");
const nextBtn = $("nextBtn");

let lastObjectUrl = null;

function setStatus(msg) {
if (previewEmpty) {
previewEmpty.style.display = "block";
previewEmpty.textContent = msg;
}
console.log("[T2V]", msg);
}

function hideButtons() {
if (downloadBtn) downloadBtn.style.display = "none";
}

function showDownload(finalUrl) {
if (downloadBtn) {
downloadBtn.href = finalUrl;
downloadBtn.download = "quannaleap-text-video.mp4";
downloadBtn.style.display = "inline-flex";
}
}

function clearUI() {
if (lastObjectUrl) {
URL.revokeObjectURL(lastObjectUrl);
lastObjectUrl = null;
}

if (previewVideo) {
previewVideo.pause?.();
previewVideo.removeAttribute("src");
previewVideo.load();
previewVideo.style.display = "none";
}

hideButtons();
setStatus("Your generated video will appear here.");
}

/* =========
Mapping
========= */
// Your UI values: portrait / landscape / square
// Backend expects: 9:16 / 16:9 / 1:1
function mapAspect(uiVal) {
if (uiVal === "portrait") return "9:16";
if (uiVal === "landscape") return "16:9";
if (uiVal === "square") return "1:1";
return "16:9";
}

/* =========
API (old proven flow)
========= */
async function startTextToVideoJob(prompt, options) {
const payload = {
prompt,
aspectRatio: options.aspectRatio,
durationSeconds: options.durationSeconds,
// optional: keep for later if your backend wants it
quality: options.quality,
};

const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

// IMPORTANT: backend must return JSON like { ok:true, operationName:"..." }
const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) throw new Error(data.error || `Failed to start video job (${res.status})`);
if (!data.operationName) throw new Error("Server did not return operationName");

return data.operationName;
}

async function pollTextToVideo(operationName) {
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxAttempts = 100;

for (let i = 1; i <= maxAttempts; i++) {
setStatus(`Generating video… (${i}/${maxAttempts})`);
await sleep(3000);

const res = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) throw new Error(data.error || `Status check failed (${res.status})`);

if (data.done) {
if (data.videoUrl) return { videoUrl: data.videoUrl };
if (data.base64) return { base64: data.base64, mimeType: data.mimeType || "video/mp4" };
throw new Error("Video finished, but no videoUrl/base64 returned");
}
}

throw new Error("Timed out waiting for the video to finish");
}

/* =========
Main action
========= */
async function generateVideo() {
const prompt = (promptEl?.value || "").trim();
if (!prompt) {
setStatus("Please enter a prompt.");
return;
}

const durationSeconds = Number(durationEl?.value || 8); // your dropdown is already seconds
const aspectRatio = mapAspect(aspectEl?.value || "landscape");
const quality = String(qualityEl?.value || "high").toLowerCase();

generateBtn.disabled = true;
clearUI();

try {
setStatus("Starting video job…");
const opName = await startTextToVideoJob(prompt, { durationSeconds, aspectRatio, quality });

const result = await pollTextToVideo(opName);

if (result.videoUrl) {
previewVideo.src = result.videoUrl;
previewVideo.style.display = "block";
if (previewEmpty) previewEmpty.style.display = "none";
setStatus("✅ Video ready");
showDownload(result.videoUrl);
return;
}

if (result.base64) {
const byteChars = atob(result.base64);
const byteNumbers = new Array(byteChars.length);
for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);

const blob = new Blob([new Uint8Array(byteNumbers)], { type: result.mimeType || "video/mp4" });
lastObjectUrl = URL.createObjectURL(blob);

previewVideo.src = lastObjectUrl;
previewVideo.style.display = "block";
if (previewEmpty) previewEmpty.style.display = "none";
setStatus("✅ Video ready");
showDownload(lastObjectUrl);
return;
}

throw new Error("Unknown video response format");
} catch (err) {
console.error(err);
setStatus(`❌ ${err?.message || err}`);
hideButtons();
} finally {
generateBtn.disabled = false;
}
}

/* =========
Wire buttons
========= */
if (generateBtn) generateBtn.addEventListener("click", generateVideo);

if (clearBtn) {
clearBtn.addEventListener("click", () => {
if (promptEl) promptEl.value = "";
});
}

if (pasteBtn) {
pasteBtn.addEventListener("click", async () => {
try {
const text = await navigator.clipboard.readText();
if (promptEl) promptEl.value = text || "";
} catch {
alert("Clipboard paste blocked. Use Ctrl+V in the prompt box.");
}
});
}

// keep Next UI-only for now
if (nextBtn) {
nextBtn.addEventListener("click", () => console.log("Next clicked (UI only for now)."));
}

