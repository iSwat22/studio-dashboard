console.log("✅ create-video.js loaded");

function $(id) {
return document.getElementById(id);
}

function show(el) {
if (el) el.style.display = "";
}

function hide(el) {
if (el) el.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
// Only run on the Text→Video page
const mode = document.body.dataset.mode;
if (mode !== "text-to-video") return;

const promptEl = $("prompt");
const generateBtn = $("generateBtn");

const aspectEl = $("aspect");
const durationEl = $("duration");
const qualityEl = $("quality");

const previewVideo = $("previewVideo");
const previewEmpty = $("previewEmpty");

const downloadBtn = $("downloadBtn");
const deleteBtn = $("deleteBtn"); // optional (your page may not have this)

if (!promptEl || !generateBtn || !previewVideo) {
console.warn("⚠️ Missing required elements for create-video.js");
return;
}

// Reset preview UI
function clearPreview() {
previewVideo.pause();
previewVideo.removeAttribute("src");
previewVideo.load();
hide(previewVideo);
if (previewEmpty) show(previewEmpty);

if (downloadBtn) {
downloadBtn.href = "#";
downloadBtn.style.display = "none";
}

// If you add a delete button later, this will work automatically
if (deleteBtn) deleteBtn.style.display = "none";
}

// Show preview UI
function showVideo(url) {
previewVideo.src = url;
show(previewVideo);
previewVideo.play().catch(() => {});
if (previewEmpty) hide(previewEmpty);

if (downloadBtn) {
downloadBtn.href = url;
downloadBtn.download = "quannaleap-video.mp4";
downloadBtn.style.display = "inline-flex";
}

if (deleteBtn) deleteBtn.style.display = "inline-flex";
}

// Start clean
clearPreview();

// Hook up Generate
generateBtn.addEventListener("click", async () => {
const prompt = (promptEl.value || "").trim();
if (!prompt) {
alert("Please enter a prompt first.");
return;
}

const durationSeconds = durationEl ? Number(durationEl.value) : undefined;
const aspect = aspectEl ? aspectEl.value : undefined;
const quality = qualityEl ? qualityEl.value : undefined;

generateBtn.disabled = true;
const originalText = generateBtn.textContent;
generateBtn.textContent = "Generating...";

try {
const payload = {
prompt,
...(Number.isFinite(durationSeconds) ? { durationSeconds } : {}),
...(aspect ? { aspect } : {}),
...(quality ? { quality } : {}),
};

const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) {
throw new Error(data.error || `API error: ${res.status}`);
}

// API can return either a URL or base64
let finalUrl = "";
if (data.videoUrl) {
finalUrl = data.videoUrl;
} else if (data.base64) {
finalUrl = `data:${data.mimeType || "video/mp4"};base64,${data.base64}`;
} else {
throw new Error("No video returned from API.");
}

showVideo(finalUrl);
} catch (err) {
console.error(err);
alert("Generate video failed. Check Render logs / Console.");
} finally {
generateBtn.disabled = false;
generateBtn.textContent = originalText;
}
});

// Optional delete hook if you add it later
if (deleteBtn) {
deleteBtn.addEventListener("click", clearPreview);
}
});
