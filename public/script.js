function initTextToVideo() {
// ======================================================
// TEXT -> VIDEO (your existing logic)
// IMPORTANT: no early return that breaks other pages
// ======================================================
const pickFirst = (...ids) => ids.map((id) => document.getElementById(id)).find(Boolean);

const t2vPrompt = pickFirst("t2vPrompt", "prompt");
const t2vBtn = pickFirst("t2vBtn", "generateBtn");
const t2vStatus = pickFirst("t2vStatus", "status", "statusText", "outputStatus");
const t2vVideo = pickFirst("t2vVideo", "resultVideo", "video");

// Optional buttons (only used if present on page)
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

if (!res.ok || !data.ok) throw new Error(data.error || "Status check failed");

if (data.done) {
if (data.videoUrl) return { videoUrl: data.videoUrl };
if (data.base64) return { base64: data.base64, mimeType: data.mimeType || "video/mp4" };
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
t2vVideo.pause?.();
t2vVideo.removeAttribute("src");
t2vVideo.load();
t2vVideo.style.display = "none";
hideT2vButtons();
setT2vStatus("Your generated video will appear here.");
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

if (result.videoUrl) {
t2vVideo.src = result.videoUrl;
t2vVideo.style.display = "block";
setT2vStatus("✅ Video ready");
showT2vButtons(result.videoUrl);
return;
}

if (result.base64) {
const byteChars = atob(result.base64);
const byteNumbers = new Array(byteChars.length);
for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
const blob = new Blob([new Uint8Array(byteNumbers)], { type: result.mimeType || "video/mp4" });
lastObjectUrl = URL.createObjectURL(blob);

t2vVideo.src = lastObjectUrl;
t2vVideo.style.display = "block";
setT2vStatus("✅ Video ready");
showT2vButtons(lastObjectUrl);
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

if (deleteBtn) deleteBtn.addEventListener("click", clearT2vUI);
}
}


