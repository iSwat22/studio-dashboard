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

if (deleteBtn) {
deleteBtn.addEventListener("click", clearT2vUI);
}
}

// ======================================================
// IMAGE -> VIDEO (THIS is what you’re working on)
// ======================================================
const imageFile = document.getElementById("imageFile");
const sourceImg = document.getElementById("sourceImg");
const resultVideo = document.getElementById("resultVideo");
const emptyState = document.getElementById("emptyState");

const i2vGenerateBtn = document.getElementById("generateBtn");
const i2vDownloadBtn = document.getElementById("downloadBtn");
const i2vDeleteBtn = document.getElementById("deleteBtn");

// Only wire Image→Video if page has these elements
if (imageFile && i2vGenerateBtn && resultVideo) {
function show(el) { if (el) el.style.display = ""; }
function hide(el) { if (el) el.style.display = "none"; }

function resetI2vUI() {
if (sourceImg) { sourceImg.src = ""; hide(sourceImg); }
resultVideo.pause?.();
resultVideo.src = "";
hide(resultVideo);
if (emptyState) show(emptyState);

if (i2vDownloadBtn) { i2vDownloadBtn.href = "#"; i2vDownloadBtn.style.display = "none"; }
if (i2vDeleteBtn) i2vDeleteBtn.style.display = "none";
}

// show selected image preview
imageFile.addEventListener("change", () => {
resetI2vUI();

const file = imageFile.files && imageFile.files[0];
if (!file) return;

const reader = new FileReader();
reader.onload = () => {
if (sourceImg) {
sourceImg.src = reader.result;
show(sourceImg);
if (emptyState) hide(emptyState);
}
};
reader.readAsDataURL(file);
});

i2vGenerateBtn.addEventListener("click", async () => {
const file = imageFile.files && imageFile.files[0];
if (!file) {
alert("Please choose an image first.");
return;
}

i2vGenerateBtn.disabled = true;
i2vGenerateBtn.textContent = "Generating...";

try {
const fd = new FormData();

// ✅ IMPORTANT: backend expects upload.array("images", 20)
fd.append("images", file);

const res = await fetch("/api/image-to-video", {
method: "POST",
body: fd,
});

// Your backend currently streams MP4 (NOT JSON)
if (!res.ok) {
const text = await res.text().catch(() => "");
throw new Error(`API error: ${res.status} ${text.slice(0, 200)}`);
}

const blob = await res.blob();
const url = URL.createObjectURL(blob);

if (sourceImg) hide(sourceImg);
resultVideo.src = url;
show(resultVideo);
if (emptyState) hide(emptyState);

if (i2vDownloadBtn) {
i2vDownloadBtn.href = url;
i2vDownloadBtn.download = "quannaleap-image-video.mp4";
i2vDownloadBtn.style.display = "inline-flex";
}
if (i2vDeleteBtn) i2vDeleteBtn.style.display = "inline-flex";
} catch (err) {
console.error(err);
alert(`Image→Video failed: ${err.message || err}`);
} finally {
i2vGenerateBtn.disabled = false;
i2vGenerateBtn.textContent = "Generate Video";
}
});

if (i2vDeleteBtn) {
i2vDeleteBtn.addEventListener("click", resetI2vUI);
}
}
});






