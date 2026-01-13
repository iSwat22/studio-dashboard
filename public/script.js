// public/script.js ✅ (FRONTEND SCRIPT runs in the browser only)
console.log("✅ Frontend script loaded");

document.addEventListener("DOMContentLoaded", () => {
// ======================================================
// TEXT -> IMAGE (works with your existing HTML IDs)
// ======================================================
const t2iPrompt = document.getElementById("t2iPrompt");
const t2iBtn = document.getElementById("t2iBtn");
const t2iStatus = document.getElementById("t2iStatus");
const t2iImg = document.getElementById("t2iImg");

// If this page doesn’t have the Text→Image card, just skip it.
if (t2iPrompt && t2iBtn && t2iStatus && t2iImg) {
t2iBtn.addEventListener("click", async () => {
const prompt = t2iPrompt.value.trim();

if (!prompt) {
t2iStatus.textContent = "Please enter a prompt.";
return;
}

t2iStatus.textContent = "Generating image…";
t2iBtn.disabled = true;
t2iImg.style.display = "none";

try {
const res = await fetch("/api/text-to-image", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt }),
});

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) {
throw new Error(data.error || "Generation failed");
}

t2iImg.src = `data:${data.mimeType};base64,${data.base64}`;
t2iImg.style.display = "block";
t2iStatus.textContent = "✅ Image generated";
} catch (err) {
console.error(err);
t2iStatus.textContent = `❌ Error generating image: ${err.message || err}`;
} finally {
t2iBtn.disabled = false;
}
});
}

// ======================================================
// TEXT -> VIDEO
// Uses your page IDs:
// t2vPrompt, t2vBtn, t2vStatus, t2vVideo
// PLUS new controls:
// t2vDuration, t2vAspect, downloadBtn, deleteBtn, saveToAssetsBtn
// ======================================================

const pickFirst = (...ids) =>
ids.map((id) => document.getElementById(id)).find(Boolean);

const t2vPrompt = pickFirst("t2vPrompt", "prompt");
const t2vBtn = pickFirst("t2vBtn", "generateBtn");
const t2vStatus = pickFirst("t2vStatus", "status", "statusText", "outputStatus");
const t2vVideo = pickFirst("t2vVideo", "resultVideo", "video");

// NEW UI controls (from your updated text-to-video.html)
const t2vDuration = document.getElementById("t2vDuration");
const t2vAspect = document.getElementById("t2vAspect");

const downloadBtn = document.getElementById("downloadBtn");
const deleteBtn = document.getElementById("deleteBtn");
const saveToAssetsBtn = document.getElementById("saveToAssetsBtn");

// If missing core UI, don’t crash — just log.
if (!t2vPrompt || !t2vBtn || !t2vVideo) {
console.warn("⚠️ Text→Video UI not found. Missing IDs:", {
promptFound: Boolean(t2vPrompt),
buttonFound: Boolean(t2vBtn),
videoFound: Boolean(t2vVideo),
statusFound: Boolean(t2vStatus),
});
return;
}

let lastObjectUrl = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setStatus(msg) {
if (t2vStatus) t2vStatus.textContent = msg;
console.log("[T2V]", msg);
}

function hideActionButtons() {
if (downloadBtn) downloadBtn.style.display = "none";
if (deleteBtn) deleteBtn.style.display = "none";
if (saveToAssetsBtn) saveToAssetsBtn.style.display = "none";
}

function showActionButtons(finalUrl) {
// Download
if (downloadBtn) {
downloadBtn.href = finalUrl;
downloadBtn.download = "quannaleap-text-video.mp4";
downloadBtn.style.display = "inline-flex";
}
// Delete
if (deleteBtn) {
deleteBtn.style.display = "inline-flex";
}
// Save to Assets
if (saveToAssetsBtn) {
saveToAssetsBtn.style.display = "inline-flex";
}
}

function clearVideoUI() {
// cleanup old object url if we created one
if (lastObjectUrl) {
URL.revokeObjectURL(lastObjectUrl);
lastObjectUrl = null;
}

t2vVideo.pause?.();
t2vVideo.removeAttribute("src");
t2vVideo.load();
t2vVideo.style.display = "none";

hideActionButtons();
setStatus("Your generated video will appear here.");
}

async function startTextToVideoJob(prompt, options) {
const payload = {
prompt,
// backend already supports aspectRatio
aspectRatio: options.aspectRatio,
// backend may NOT support durationSeconds yet (we’ll wire it next),
// but sending it now is safe and keeps everything consistent.
durationSeconds: options.durationSeconds,
};

const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) {
throw new Error(data.error || "Failed to start video job");
}
if (!data.operationName) {
throw new Error("Server did not return operationName");
}
return data.operationName;
}

async function pollTextToVideo(operationName) {
// Poll up to ~5 minutes (100 * 3s)
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

if (!res.ok || !data.ok) {
throw new Error(data.error || "Status check failed");
}

if (data.done) {
if (data.videoUrl) return { videoUrl: data.videoUrl };
if (data.base64) return { base64: data.base64, mimeType: data.mimeType || "video/mp4" };
throw new Error("Video finished, but no videoUrl/base64 returned");
}
}

throw new Error("Timed out waiting for the video to finish");
}

async function generateVideo(prompt) {
t2vBtn.disabled = true;
clearVideoUI();

// Read UI options (safe defaults)
const durationSeconds = Number(t2vDuration?.value || 8);
const aspectRatio = String(t2vAspect?.value || "16:9");

try {
setStatus("Starting video job…");

const opName = await startTextToVideoJob(prompt, {
durationSeconds,
aspectRatio,
});

const result = await pollTextToVideo(opName);

// Option A: videoUrl
if (result.videoUrl) {
t2vVideo.src = result.videoUrl;
t2vVideo.style.display = "block";
setStatus("✅ Video ready");
showActionButtons(result.videoUrl);

// store last result so refresh keeps it
localStorage.setItem("ql_last_t2v_url", result.videoUrl);
localStorage.setItem("ql_last_t2v_meta", JSON.stringify({ prompt, durationSeconds, aspectRatio }));
return;
}

// Option B: base64 fallback
if (result.base64) {
const byteChars = atob(result.base64);
const byteNumbers = new Array(byteChars.length);
for (let i = 0; i < byteChars.length; i++) {
byteNumbers[i] = byteChars.charCodeAt(i);
}
const blob = new Blob([new Uint8Array(byteNumbers)], { type: result.mimeType || "video/mp4" });
lastObjectUrl = URL.createObjectURL(blob);

t2vVideo.src = lastObjectUrl;
t2vVideo.style.display = "block";
setStatus("✅ Video ready");
showActionButtons(lastObjectUrl);

localStorage.setItem("ql_last_t2v_url", lastObjectUrl);
localStorage.setItem("ql_last_t2v_meta", JSON.stringify({ prompt, durationSeconds, aspectRatio }));
return;
}

throw new Error("Unknown video response format");
} catch (err) {
console.error(err);
setStatus(`❌ ${err.message || err}`);
hideActionButtons();
} finally {
t2vBtn.disabled = false;
}
}

// Restore last video on refresh (optional)
const savedUrl = localStorage.getItem("ql_last_t2v_url");
if (savedUrl) {
t2vVideo.src = savedUrl;
t2vVideo.style.display = "block";
setStatus("✅ Video ready");
showActionButtons(savedUrl);
} else {
hideActionButtons();
}

// Attach click
t2vBtn.addEventListener("click", () => {
const prompt = t2vPrompt.value.trim();
if (!prompt) {
setStatus("Please enter a prompt.");
return;
}
generateVideo(prompt);
});

// Delete button
if (deleteBtn) {
deleteBtn.addEventListener("click", () => {
localStorage.removeItem("ql_last_t2v_url");
localStorage.removeItem("ql_last_t2v_meta");
clearVideoUI();
});
}

// Save to Assets button (stores locally)
if (saveToAssetsBtn) {
saveToAssetsBtn.addEventListener("click", () => {
const url = t2vVideo.getAttribute("src");
if (!url) return;

let meta = {};
try {
meta = JSON.parse(localStorage.getItem("ql_last_t2v_meta") || "{}");
} catch {}

const item = {
type: "video",
url,
prompt: meta.prompt || t2vPrompt.value.trim() || "",
durationSeconds: meta.durationSeconds || Number(t2vDuration?.value || 8),
aspectRatio: meta.aspectRatio || String(t2vAspect?.value || "16:9"),
createdAt: new Date().toISOString(),
};

const key = "ql_assets";
let arr = [];
try {
arr = JSON.parse(localStorage.getItem(key) || "[]");
if (!Array.isArray(arr)) arr = [];
} catch {
arr = [];
}

arr.unshift(item);
localStorage.setItem(key, JSON.stringify(arr));

setStatus("⭐ Saved to Assets (local)");
});
}

console.log("✅ Text→Video wired:", {
promptId: t2vPrompt.id,
btnId: t2vBtn.id,
statusId: t2vStatus ? t2vStatus.id : "(none)",
videoId: t2vVideo.id,
durationId: t2vDuration ? t2vDuration.id : "(none)",
aspectId: t2vAspect ? t2vAspect.id : "(none)",
});
});






