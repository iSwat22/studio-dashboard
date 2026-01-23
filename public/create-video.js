// create-video.js

console.log("✅ create-video.js loaded");

// ======================================================
// TEXT -> VIDEO
// Works on BOTH:
// - create-video.html (prompt / generateBtn / previewVideo)
// - older pages (t2vPrompt / t2vBtn / t2vVideo)
// ======================================================

const pickFirst = (...ids) =>
ids.map((id) => document.getElementById(id)).find(Boolean);

// Inputs / buttons
const t2vPrompt = pickFirst("prompt", "t2vPrompt");
const t2vBtn = pickFirst("generateBtn", "t2vBtn");

// Status text (your create-video page might not have one; that's OK)
const t2vStatus = pickFirst("status", "t2vStatus", "statusText", "outputStatus");

// ✅ IMPORTANT: your create-video.html uses previewVideo
const t2vVideo = pickFirst("previewVideo", "t2vVideo", "resultVideo", "video");

// Optional controls
const downloadBtn = document.getElementById("downloadBtn");
const deleteBtn = document.getElementById("deleteBtn");
const saveToAssetsBtn = document.getElementById("saveToAssetsBtn");
const t2vDuration = document.getElementById("t2vDuration");
const t2vAspect = document.getElementById("t2vAspect");

function setT2vStatus(msg) {
if (t2vStatus) t2vStatus.textContent = msg;
console.log("[T2V]", msg);
}

function hideT2vButtons() {
if (downloadBtn) downloadBtn.style.display = "none";
if (deleteBtn) deleteBtn.style.display = "none";
if (saveToAssetsBtn) saveToAssetsBtn.style.display = "none";
}

function showT2vButtons(finalUrl) {
if (downloadBtn) {
downloadBtn.href = finalUrl;
downloadBtn.download = "quannaleap-text-video.mp4";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
if (saveToAssetsBtn) saveToAssetsBtn.style.display = "inline-flex";
}

// Debug: if elements aren't found, tell us exactly what is missing.
if (!t2vPrompt || !t2vBtn || !t2vVideo) {
console.warn("[T2V] Text-to-Video elements not found", {
hasPrompt: Boolean(t2vPrompt),
hasButton: Boolean(t2vBtn),
hasVideo: Boolean(t2vVideo),
promptId: t2vPrompt?.id,
buttonId: t2vBtn?.id,
videoId: t2vVideo?.id,
});
} else {
console.log("[T2V] Wired elements:", {
promptId: t2vPrompt.id,
buttonId: t2vBtn.id,
videoId: t2vVideo.id,
});
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

if (!res.ok || !data.ok) throw new Error(data.error || "Failed to start video job");
if (!data.operationName) throw new Error("Server did not return operationName");

return data.operationName;
}

async function pollTextToVideo(operationName) {
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxAttempts = 100;

for (let i = 1; i <= maxAttempts; i++) {
setT2vStatus(`Generating video… (${i}/${maxAttempts})`);
await sleep(3000);

const res = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const data = await res.json().catch(() => ({}));
console.log("[T2V] STATUS json:", data);

if (!res.ok || !data.ok) throw new Error(data.error || "Status check failed");

if (data.done) {
// ✅ Prefer proxyUrl when available (best for browser <video>)
if (data.proxyUrl) return { videoUrl: data.proxyUrl };
if (data.videoUrl) return { videoUrl: data.videoUrl };
if (data.base64) return { base64: data.base64, mimeType: data.mimeType || "video/mp4" };
throw new Error("Video finished, but no proxyUrl/videoUrl/base64 returned");
}
}

throw new Error("Timed out waiting for the video to finish");
}

if (t2vPrompt && t2vBtn && t2vVideo) {
let lastObjectUrl = null;

function clearT2vUI() {
try {
if (lastObjectUrl) {
URL.revokeObjectURL(lastObjectUrl);
lastObjectUrl = null;
}
} catch {}

try {
t2vVideo.pause?.();
t2vVideo.removeAttribute("src");
// Force reload to clear
t2vVideo.load?.();
} catch {}

// Keep it visible if your UI wants it visible; otherwise hide
t2vVideo.style.display = "block";

hideT2vButtons();
setT2vStatus("Your generated video will appear here.");
}

async function attachAndPlay(urlToLoad) {
// Some pages hide controls; ensure playable
try {
t2vVideo.controls = true;
t2vVideo.muted = false;
} catch {}

setT2vStatus(`Video ready. Loading: ${urlToLoad}`);

t2vVideo.src = urlToLoad;
t2vVideo.style.display = "block";
t2vVideo.load?.();

// Autoplay may be blocked; that's fine
try {
await t2vVideo.play();
} catch {
console.warn("[T2V] Autoplay blocked (normal). Click play.");
}

showT2vButtons(urlToLoad);
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

// Case: server returns URL (proxyUrl/videoUrl)
if (result.videoUrl) {
await attachAndPlay(result.videoUrl);
setT2vStatus("✅ Video ready");
return;
}

// Case: server returns base64
if (result.base64) {
const byteChars = atob(result.base64);
const byteNumbers = new Array(byteChars.length);
for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);

const blob = new Blob([new Uint8Array(byteNumbers)], {
type: result.mimeType || "video/mp4",
});

lastObjectUrl = URL.createObjectURL(blob);

await attachAndPlay(lastObjectUrl);
setT2vStatus("✅ Video ready");
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
const prompt = t2vPrompt.value.trim();
if (!prompt) {
setT2vStatus("Please enter a prompt.");
return;
}
generateT2v(prompt);
});

if (deleteBtn) {
deleteBtn.addEventListener("click", clearT2vUI);
}
}
