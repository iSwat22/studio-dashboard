/* create-video.js */
console.log("create-video.js loaded");

/**
* Text → Video page only (create-video.html)
* Requires backend routes:
* POST /api/text-to-video
* POST /api/text-to-video/status
*/

const $ = (id) => document.getElementById(id);

// NEW UI ids
const promptEl = $("prompt");
const generateBtn = $("generateBtn");
const previewVideo = $("previewVideo");
const previewEmpty = $("previewEmpty");
const downloadBtn = $("downloadBtn");

const aspectEl = $("aspect");
const durationEl = $("duration");
const qualityEl = $("quality");

// Optional buttons
const clearBtn = $("clearBtn");
const pasteBtn = $("pasteBtn");

function setStatus(msg) {
if (previewEmpty) {
previewEmpty.style.display = "block";
previewEmpty.textContent = msg;
}
if (previewVideo) previewVideo.style.display = "none";
if (downloadBtn) downloadBtn.style.display = "none";
console.log("[T2V]", msg);
}

function showVideo(url) {
if (!previewVideo) return;

previewVideo.src = url;
previewVideo.style.display = "block";
if (previewEmpty) previewEmpty.style.display = "none";

if (downloadBtn) {
downloadBtn.href = url;
downloadBtn.download = "quanneleap-text-video.mp4";
downloadBtn.style.display = "inline-flex";
}
}

function mapAspectToRatio(uiValue) {
// UI values: portrait / landscape / square
if (uiValue === "portrait") return "9:16";
if (uiValue === "landscape") return "16:9";
if (uiValue === "square") return "1:1";
return "9:16";
}

async function safeJson(res) {
const txt = await res.text();
try {
return JSON.parse(txt);
} catch {
return { raw: txt };
}
}

// ---- backend calls (same pattern as your old working script)
async function startTextToVideoJob(prompt, options) {
const payload = {
prompt,
aspectRatio: options.aspectRatio, // old backend expected this
durationSeconds: options.durationSeconds, // old backend expected this
quality: options.quality, // optional
};

const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

const data = await safeJson(res);

// If you get 404 here -> backend route is missing. Fix index.js.
if (!res.ok || !data.ok) {
throw new Error(data.error || `Failed to start video job (${res.status})`);
}
if (!data.operationName) {
throw new Error("Server did not return operationName");
}

return data.operationName;
}

async function pollTextToVideo(operationName) {
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxAttempts = 120; // 120 * 3s = 6 minutes

for (let i = 1; i <= maxAttempts; i++) {
setStatus(`Generating video… (${i}/${maxAttempts})`);
await sleep(3000);

const res = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const data = await safeJson(res);

if (!res.ok || !data.ok) {
throw new Error(data.error || `Status check failed (${res.status})`);
}

if (data.done) {
// Prefer URL if present
if (data.videoUrl) return { videoUrl: data.videoUrl };

// Support base64 fallback
if (data.base64) {
return {
base64: data.base64,
mimeType: data.mimeType || "video/mp4",
};
}

throw new Error("Video finished, but no videoUrl/base64 returned");
}
}

throw new Error("Timed out waiting for the video to finish");
}

async function generateVideo() {
const prompt = (promptEl?.value || "").trim();
if (!prompt) {
alert("Enter a prompt first.");
return;
}

const aspectRatio = mapAspectToRatio(aspectEl?.value);
const durationSeconds = Number(durationEl?.value || 8); // your dropdown values are already seconds
const quality = (qualityEl?.value || "high").toLowerCase();

generateBtn.disabled = true;
setStatus("Starting video job…");

let lastObjectUrl = null;

try {
const opName = await startTextToVideoJob(prompt, { durationSeconds, aspectRatio, quality });
const result = await pollTextToVideo(opName);

if (result.videoUrl) {
showVideo(result.videoUrl);
setStatus("✅ Video ready");
return;
}

if (result.base64) {
const byteChars = atob(result.base64);
const byteNumbers = new Array(byteChars.length);
for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);

const blob = new Blob([new Uint8Array(byteNumbers)], { type: result.mimeType || "video/mp4" });
lastObjectUrl = URL.createObjectURL(blob);

showVideo(lastObjectUrl);
setStatus("✅ Video ready");
return;
}

throw new Error("Unknown video response format");
} catch (err) {
console.error(err);
setStatus(`❌ ${err.message || err}`);
alert("Generate video failed. Check Render logs / Console.");
} finally {
generateBtn.disabled = false;
}
}

// ---- buttons
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
