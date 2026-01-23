/* create-video.js — Text → Video page only */
console.log("✅ create-video.js loaded");

const pick = (...ids) => ids.map((id) => document.getElementById(id)).find(Boolean);

// NEW create-video.html IDs
const promptEl = pick("prompt", "t2vPrompt");
const btnEl = pick("generateBtn", "t2vBtn", "t2vGenerate");
const statusEl = pick("previewEmpty", "t2vStatus", "status", "statusText");
const videoEl = pick("previewVideo", "t2vVideo", "t2vResult", "resultVideo", "video");

const durationEl = pick("duration", "t2vDuration");
const aspectEl = pick("aspect", "t2vAspect");

const downloadBtn = pick("downloadBtn");
const deleteBtn = pick("deleteBtn");

function setStatus(msg) {
if (statusEl) statusEl.textContent = msg;
console.log("[T2V]", msg);
}

function hideButtons() {
if (downloadBtn) downloadBtn.style.display = "none";
if (deleteBtn) deleteBtn.style.display = "none";
}

function showButtons(url) {
if (downloadBtn) {
downloadBtn.href = url;
downloadBtn.download = "quanneleap-text-video.mp4";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
}

function clearUI() {
try { videoEl.pause?.(); } catch {}
videoEl.removeAttribute("src");
videoEl.load?.();
videoEl.style.display = "none";
hideButtons();
setStatus("Your generated video will appear here.");
}

function extractPlayableUrl(data) {
// Accept either:
// { videoUrl: "..." } OR { proxyUrl: "..." } OR base64 video
if (!data) return null;
return data.proxyUrl || data.videoUrl || data.url || data.uri || null;
}

async function startJob(prompt, { durationSeconds, aspectRatio }) {
const payload = { prompt, durationSeconds, aspectRatio };

const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

const data = await res.json().catch(() => ({}));
console.log("[T2V] start:", res.status, data);

if (!res.ok || !data.ok) throw new Error(data.error || "Failed to start video job");
if (!data.operationName) throw new Error("Server did not return operationName");

return data.operationName;
}

async function pollStatus(operationName) {
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxAttempts = 120;

for (let i = 1; i <= maxAttempts; i++) {
setStatus(`Generating video… (${i}/${maxAttempts})`);
await sleep(3000);

const res = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const data = await res.json().catch(() => ({}));
if (i === 1 || i % 5 === 0) console.log("[T2V] poll:", i, res.status, data);

if (!res.ok || !data.ok) throw new Error(data.error || "Status check failed");

if (data.done) {
// 1) playable URL path
const url = extractPlayableUrl(data);
if (url) return { videoUrl: url };

// 2) base64 fallback
if (data.base64) return { base64: data.base64, mimeType: data.mimeType || "video/mp4" };

throw new Error("Video finished, but no videoUrl/proxyUrl/base64 returned");
}
}

throw new Error("Timed out waiting for the video to finish");
}

async function setVideoSource(url) {
console.log("[T2V] loading video:", url);

// Make sure it shows
videoEl.style.display = "block";
videoEl.controls = true;
videoEl.playsInline = true;

// Force reload
videoEl.removeAttribute("src");
videoEl.load?.();

videoEl.onerror = () => {
console.error("[T2V] <video> load error:", videoEl.error, url);
setStatus("❌ Got a URL, but the browser could not load the video. Check Network tab (403/404/CORS).");
};

videoEl.onloadeddata = () => {
setStatus("✅ Video ready");
};

videoEl.src = url;
videoEl.load?.();

// Autoplay may be blocked — fine
try { await videoEl.play?.(); } catch {}
}

async function generate() {
const prompt = (promptEl?.value || "").trim();
if (!prompt) return setStatus("Please enter a prompt.");

btnEl.disabled = true;
clearUI();

// Read from YOUR new dropdowns
const durationSeconds = Number(durationEl?.value || 8);

// Your new dropdown uses words like "portrait/landscape"
// Convert to the old aspectRatio values the backend expects
const aspectRaw = String(aspectEl?.value || "16:9");
const aspectRatio =
aspectRaw === "portrait" ? "9:16" :
aspectRaw === "landscape" ? "16:9" :
aspectRaw === "square" ? "1:1" :
aspectRaw;

try {
setStatus("Starting video job…");
const opName = await startJob(prompt, { durationSeconds, aspectRatio });
const result = await pollStatus(opName);

// URL result
if (result.videoUrl) {
showButtons(result.videoUrl);
await setVideoSource(result.videoUrl);
return;
}

// base64 result
if (result.base64) {
const byteChars = atob(result.base64);
const bytes = new Uint8Array(byteChars.length);
for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);

const blob = new Blob([bytes], { type: result.mimeType || "video/mp4" });
const objUrl = URL.createObjectURL(blob);

showButtons(objUrl);
await setVideoSource(objUrl);
return;
}

throw new Error("Unknown video response format");
} catch (err) {
console.error(err);
setStatus(`❌ ${err.message || err}`);
hideButtons();
} finally {
btnEl.disabled = false;
}
}

// Only wire if elements exist
if (promptEl && btnEl && videoEl) {
btnEl.addEventListener("click", generate);

if (deleteBtn) deleteBtn.addEventListener("click", clearUI);
}
