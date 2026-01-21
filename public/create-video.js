/* create-video.js */
console.log("create-video.js loaded");

const $ = (id) => document.getElementById(id);

// NEW page IDs (create-video.html)
const promptEl = $("prompt");
const generateBtn = $("generateBtn");
const previewVideo = $("previewVideo");
const previewEmpty = $("previewEmpty");
const downloadBtn = $("downloadBtn");

const aspectEl = $("aspect");
const durationEl = $("duration");
const qualityEl = $("quality");

// Optional UI
const nextBtn = $("nextBtn");
const clipsStrip = $("clipsStrip");

let lastObjectUrl = null;

function setStatus(msg) {
if (previewEmpty) {
previewEmpty.style.display = "block";
previewEmpty.textContent = msg;
}
if (previewVideo) previewVideo.style.display = "none";
if (downloadBtn) downloadBtn.style.display = "none";
console.log("[T2V]", msg);
}

function showVideoFromUrl(url) {
if (!previewVideo) return;

// cleanup old blob url if needed
if (lastObjectUrl) {
URL.revokeObjectURL(lastObjectUrl);
lastObjectUrl = null;
}

previewVideo.src = url;
previewVideo.style.display = "block";
if (previewEmpty) previewEmpty.style.display = "none";

if (downloadBtn) {
downloadBtn.href = url;
downloadBtn.style.display = "inline-flex";
}
}

function showVideoFromBase64(base64, mimeType = "video/mp4") {
if (!previewVideo) return;

// cleanup old blob url if needed
if (lastObjectUrl) {
URL.revokeObjectURL(lastObjectUrl);
lastObjectUrl = null;
}

const byteChars = atob(base64);
const byteNumbers = new Array(byteChars.length);
for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);

const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
lastObjectUrl = URL.createObjectURL(blob);

previewVideo.src = lastObjectUrl;
previewVideo.style.display = "block";
if (previewEmpty) previewEmpty.style.display = "none";

if (downloadBtn) {
downloadBtn.href = lastObjectUrl;
downloadBtn.download = "quanneleap-text-video.mp4";
downloadBtn.style.display = "inline-flex";
}
}

function mapAspect(value) {
if (value === "portrait") return "9:16";
if (value === "landscape") return "16:9";
if (value === "square") return "1:1";
return value || "9:16";
}

async function startTextToVideoJob(prompt, options) {
const payload = {
prompt,
aspectRatio: options.aspectRatio,
durationSeconds: options.durationSeconds,
quality: options.quality,
};

const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

const data = await res.json().catch(() => ({}));

// IMPORTANT: log the response so we can see what server returns
console.log("startTextToVideoJob response:", res.status, data);

if (!res.ok || !data.ok) throw new Error(data.error || `Failed to start video job (${res.status})`);
if (!data.operationName) throw new Error("Server did not return operationName");

return data.operationName;
}

async function pollTextToVideo(operationName) {
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxAttempts = 120; // ~6 minutes at 3s

for (let i = 1; i <= maxAttempts; i++) {
setStatus(`Generating video… (${i}/${maxAttempts})`);
await sleep(3000);

const res = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const data = await res.json().catch(() => ({}));

// IMPORTANT: log final response
if (data?.done) console.log("pollTextToVideo DONE:", res.status, data);

if (!res.ok || !data.ok) throw new Error(data.error || `Status check failed (${res.status})`);

if (data.done) {
// Support either URL or base64
if (data.videoUrl) return { videoUrl: data.videoUrl };
if (data.base64) return { base64: data.base64, mimeType: data.mimeType || "video/mp4" };

// Some servers might return different key name:
if (data.url) return { videoUrl: data.url };
if (data.output) return { videoUrl: data.output };

throw new Error("Video finished, but no videoUrl/base64 returned");
}
}

throw new Error("Timed out waiting for the video to finish");
}

async function generateVideo() {
const prompt = (promptEl?.value || "").trim();
if (!prompt) return alert("Enter a prompt first.");

const durationSeconds = Number(durationEl?.value || 8);
const aspectRatio = mapAspect(aspectEl?.value);
const quality = (qualityEl?.value || "high").toLowerCase();

generateBtn.disabled = true;
setStatus("Starting video job…");

try {
const opName = await startTextToVideoJob(prompt, { durationSeconds, aspectRatio, quality });
const result = await pollTextToVideo(opName);

if (result.videoUrl) {
setStatus("✅ Video ready");
showVideoFromUrl(result.videoUrl);
} else if (result.base64) {
setStatus("✅ Video ready");
showVideoFromBase64(result.base64, result.mimeType);
}

// Optional: UI-only selection highlight
if (clipsStrip) {
const firstClip = clipsStrip.querySelector(".clip-card");
if (firstClip) firstClip.classList.add("is-selected");
}
} catch (err) {
console.error(err);
setStatus(`❌ ${err.message || err}`);
alert("Generate video failed. Check DevTools Console + Render logs.");
} finally {
generateBtn.disabled = false;
}
}

// Wire buttons
if (generateBtn) generateBtn.addEventListener("click", generateVideo);

if (nextBtn) {
nextBtn.addEventListener("click", () => {
console.log("Next clicked (UI only for now).");
});
}

