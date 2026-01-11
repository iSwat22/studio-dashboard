console.log("✅ app.js loaded");

/* =========================
Hover videos on dashboard cards (keeps your logic)
========================= */
function tryLoadHoverVideos() {
const videos = document.querySelectorAll("video.card-video");

videos.forEach((v) => {
const src = v.getAttribute("data-src");
if (!src) return;

// Lazy-load video src on first hover
v.addEventListener(
"mouseenter",
() => {
if (!v.src) v.src = src;
},
{ once: true }
);

const card = v.closest(".card");
if (!card) return;

card.addEventListener("mouseenter", () => {
if (v.src) {
v.style.opacity = "1";
v.play().catch(() => {});
}
});

card.addEventListener("mouseleave", () => {
v.style.opacity = "0";
v.pause();
v.currentTime = 0;
});
});
}

/* =========================
Helpers
========================= */
function $(id) {
return document.getElementById(id);
}

function show(el) {
if (el) el.style.display = "";
}

function hide(el) {
if (el) el.style.display = "none";
}

function makeDataUrl(mimeType, base64) {
return `data:${mimeType || "image/png"};base64,${base64}`;
}

/**
* Make video reliably render/play after setting src
*/
function setVideoSrc(videoEl, src) {
if (!videoEl) return;

// Make sure controls exist so you can see/play it
videoEl.controls = true;
videoEl.playsInline = true;

// Some browsers won’t show a frame until metadata loads
videoEl.preload = "metadata";

// Set src + force reload
videoEl.src = src;
videoEl.load();

// Try autoplay (won't always work, but helps)
videoEl.play().catch(() => {});
}

/* =========================
Text → Image page (base64 backend support)
Expected backend JSON:
{ ok:true, mimeType:"image/png", base64:"...." }
========================= */
function setupTextToImagePage() {
const promptEl = $("prompt");
const generateBtn = $("generateBtn");

const resultImg = $("resultImg");
const emptyState = $("emptyState");

const downloadBtn = $("downloadBtn");
const deleteBtn = $("deleteBtn");
const makeVideoBtn = $("makeVideoBtn");

// If this page doesn't have these elements, skip
if (!promptEl || !generateBtn || !resultImg) return;

function showImageUI(dataUrl) {
resultImg.src = dataUrl;
show(resultImg);
if (emptyState) hide(emptyState);

if (downloadBtn) {
downloadBtn.href = dataUrl;
downloadBtn.download = "quannaleap-image.png";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
if (makeVideoBtn) makeVideoBtn.style.display = "inline-flex";
}

function clearImageUI() {
resultImg.src = "";
hide(resultImg);
if (emptyState) show(emptyState);

if (downloadBtn) {
downloadBtn.href = "#";
downloadBtn.style.display = "none";
}
if (deleteBtn) deleteBtn.style.display = "none";
if (makeVideoBtn) makeVideoBtn.style.display = "none";

localStorage.removeItem("ql_last_image_dataurl");
}

// Restore last image on refresh
const saved = localStorage.getItem("ql_last_image_dataurl");
if (saved) showImageUI(saved);

generateBtn.addEventListener("click", async () => {
const prompt = (promptEl.value || "").trim();
if (!prompt) {
alert("Please enter a prompt first.");
return;
}

generateBtn.disabled = true;
generateBtn.textContent = "Generating...";

try {
const res = await fetch("/api/text-to-image", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt }),
});

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) {
throw new Error(data.error || `API error: ${res.status}`);
}

if (!data.base64) {
throw new Error("No base64 image returned from API.");
}

const dataUrl = makeDataUrl(data.mimeType, data.base64);

localStorage.setItem("ql_last_image_dataurl", dataUrl);
showImageUI(dataUrl);
} catch (err) {
console.error(err);
alert("Generate failed. Check Render logs / Console.");
} finally {
generateBtn.disabled = false;
generateBtn.textContent = "Generate";
}
});

if (deleteBtn) {
deleteBtn.addEventListener("click", clearImageUI);
}

if (makeVideoBtn) {
makeVideoBtn.addEventListener("click", () => {
const dataUrl = resultImg.src;
if (!dataUrl) return;

// store image so Image→Video page can pick it up
localStorage.setItem("ql_image_for_video", dataUrl);

// send to Image→Video page
window.location.href = "./image-to-video.html";
});
}
}

/* =========================
Image → Video page
Expected backend:
{ ok:true, videoUrl:"https://..." } OR { ok:true, base64, mimeType:"video/mp4" }
========================= */
function setupImageToVideoPage() {
const mode = document.body.dataset.mode;
if (mode !== "image-to-video") return;

const imageFile = $("imageFile");
const sourceImg = $("sourceImg");
const resultVideo = $("resultVideo");
const emptyState = $("emptyState");

const generateBtn = $("generateBtn");
const downloadBtn = $("downloadBtn");
const deleteBtn = $("deleteBtn");

if (!imageFile || !generateBtn) return;

function resetUI() {
if (sourceImg) {
sourceImg.src = "";
hide(sourceImg);
}
if (resultVideo) {
resultVideo.removeAttribute("src");
resultVideo.load();
hide(resultVideo);
}
if (downloadBtn) {
downloadBtn.href = "#";
downloadBtn.style.display = "none";
}
if (deleteBtn) deleteBtn.style.display = "none";
if (emptyState) show(emptyState);

localStorage.removeItem("ql_last_video_url");
}

// If user came from "Make Video" on Text→Image:
const pushedImage = localStorage.getItem("ql_image_for_video");
if (pushedImage && sourceImg) {
sourceImg.src = pushedImage;
show(sourceImg);
if (emptyState) hide(emptyState);
}

imageFile.addEventListener("change", () => {
const file = imageFile.files && imageFile.files[0];
if (!file) return;

const reader = new FileReader();
reader.onload = () => {
if (sourceImg) {
sourceImg.src = reader.result;
show(sourceImg);
if (emptyState) hide(emptyState);
}
// Clear any old video
if (resultVideo) {
resultVideo.removeAttribute("src");
resultVideo.load();
hide(resultVideo);
}
if (downloadBtn) downloadBtn.style.display = "none";
if (deleteBtn) deleteBtn.style.display = "none";
};
reader.readAsDataURL(file);
});

generateBtn.addEventListener("click", async () => {
const file = imageFile.files && imageFile.files[0];
const pushed = localStorage.getItem("ql_image_for_video");

if (!file && !pushed) {
alert("Please choose an image first.");
return;
}

generateBtn.disabled = true;
generateBtn.textContent = "Generating...";

try {
let res;

if (file) {
const fd = new FormData();
fd.append("image", file);
res = await fetch("/api/image-to-video", { method: "POST", body: fd });
} else {
res = await fetch("/api/image-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ imageDataUrl: pushed }),
});
}

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) {
throw new Error(data.error || `API error: ${res.status}`);
}

// Option A: videoUrl
if (data.videoUrl && resultVideo) {
setVideoSrc(resultVideo, data.videoUrl);

show(resultVideo);
if (emptyState) hide(emptyState);

if (downloadBtn) {
downloadBtn.href = data.videoUrl;
downloadBtn.download = "quannaleap-video.mp4";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
localStorage.setItem("ql_last_video_url", data.videoUrl);
return;
}

// Option B: base64 mp4
if (data.base64 && resultVideo) {
const vUrl = `data:${data.mimeType || "video/mp4"};base64,${data.base64}`;
setVideoSrc(resultVideo, vUrl);

show(resultVideo);
if (emptyState) hide(emptyState);

if (downloadBtn) {
downloadBtn.href = vUrl;
downloadBtn.download = "quannaleap-video.mp4";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
localStorage.setItem("ql_last_video_url", vUrl);
return;
}

throw new Error("No video returned from API.");
} catch (err) {
console.error(err);
alert("Generate video failed. Check Render logs / Console.");
} finally {
generateBtn.disabled = false;
generateBtn.textContent = "Generate Video";
}
});

if (deleteBtn) {
deleteBtn.addEventListener("click", resetUI);
}

// restore last video (if any)
const savedVideo = localStorage.getItem("ql_last_video_url");
if (savedVideo && resultVideo) {
setVideoSrc(resultVideo, savedVideo);
show(resultVideo);
if (emptyState) hide(emptyState);
if (downloadBtn) {
downloadBtn.href = savedVideo;
downloadBtn.download = "quannaleap-video.mp4";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
}
}

/* =========================
Text → Video page
Calls /api/text-to-video
========================= */
function setupTextToVideoPage() {
const mode = document.body.dataset.mode;
if (mode !== "text-to-video") return;

const promptEl = $("prompt");
const generateBtn = $("generateBtn");

const resultVideo = $("resultVideo");
const emptyState = $("emptyState");

const downloadBtn = $("downloadBtn");
const deleteBtn = $("deleteBtn");

if (!promptEl || !generateBtn || !resultVideo) return;

function clearUI() {
resultVideo.removeAttribute("src");
resultVideo.load();
hide(resultVideo);
if (emptyState) show(emptyState);

if (downloadBtn) downloadBtn.style.display = "none";
if (deleteBtn) deleteBtn.style.display = "none";

localStorage.removeItem("ql_last_t2v");
}

const saved = localStorage.getItem("ql_last_t2v");
if (saved) {
setVideoSrc(resultVideo, saved);
show(resultVideo);
if (emptyState) hide(emptyState);
if (downloadBtn) {
downloadBtn.href = saved;
downloadBtn.download = "quannaleap-text-video.mp4";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
}

generateBtn.addEventListener("click", async () => {
const prompt = (promptEl.value || "").trim();
if (!prompt) return alert("Enter a prompt first.");

generateBtn.disabled = true;
generateBtn.textContent = "Generating...";

try {
const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt }),
});

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) throw new Error(data.error || `API error: ${res.status}`);

const videoUrl = data.videoUrl || "";
if (!videoUrl && !data.base64) throw new Error("No video returned.");

const finalUrl = videoUrl
? videoUrl
: `data:${data.mimeType || "video/mp4"};base64,${data.base64}`;

setVideoSrc(resultVideo, finalUrl);
show(resultVideo);
if (emptyState) hide(emptyState);

localStorage.setItem("ql_last_t2v", finalUrl);

if (downloadBtn) {
downloadBtn.href = finalUrl;
downloadBtn.download = "quannaleap-text-video.mp4";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
} catch (err) {
console.error(err);
alert("Text→Video failed. Check Render logs / Console.");
} finally {
generateBtn.disabled = false;
generateBtn.textContent = "Generate Video";
}
});

if (deleteBtn) deleteBtn.addEventListener("click", clearUI);
}

/* =========================
Text → Voice page
Calls /api/text-to-voice
========================= */
function setupTextToVoicePage() {
const mode = document.body.dataset.mode;
if (mode !== "text-to-voice") return;

const promptEl = $("prompt");
const generateBtn = $("generateBtn");

const resultAudio = $("resultAudio");
const emptyState = $("emptyState");

const downloadBtn = $("downloadBtn");
const deleteBtn = $("deleteBtn");

if (!promptEl || !generateBtn || !resultAudio) return;

function clearUI() {
resultAudio.src = "";
hide(resultAudio);
if (emptyState) show(emptyState);

if (downloadBtn) downloadBtn.style.display = "none";
if (deleteBtn) deleteBtn.style.display = "none";

localStorage.removeItem("ql_last_t2a");
}

const saved = localStorage.getItem("ql_last_t2a");
if (saved) {
resultAudio.src = saved;
show(resultAudio);
if (emptyState) hide(emptyState);

if (downloadBtn) {
downloadBtn.href = saved;
downloadBtn.download = "quannaleap-voice.mp3";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
}

generateBtn.addEventListener("click", async () => {
const prompt = (promptEl.value || "").trim();
if (!prompt) return alert("Enter text first.");

generateBtn.disabled = true;
generateBtn.textContent = "Generating...";

try {
const res = await fetch("/api/text-to-voice", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ text: prompt }),
});

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) throw new Error(data.error || `API error: ${res.status}`);

const audioUrl = data.audioUrl || "";
if (!audioUrl && !data.base64) throw new Error("No audio returned.");

const finalUrl = audioUrl
? audioUrl
: `data:${data.mimeType || "audio/mpeg"};base64,${data.base64}`;

resultAudio.src = finalUrl;
show(resultAudio);
if (emptyState) hide(emptyState);

localStorage.setItem("ql_last_t2a", finalUrl);

if (downloadBtn) {
downloadBtn.href = finalUrl;
downloadBtn.download = "quannaleap-voice.mp3";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
} catch (err) {
console.error(err);
alert("Text→Voice failed. Check Render logs / Console.");
} finally {
generateBtn.disabled = false;
generateBtn.textContent = "Generate Voice";
}
});

if (deleteBtn) deleteBtn.addEventListener("click", clearUI);
}

/* =========================
BOOT
========================= */
document.addEventListener("DOMContentLoaded", () => {
tryLoadHoverVideos();
setupTextToImagePage();
setupImageToVideoPage();
setupTextToVideoPage();
setupTextToVoicePage();
});
