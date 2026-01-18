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

function downloadDataUrl(dataUrl, filename) {
const a = document.createElement("a");
a.href = dataUrl;
a.download = filename || "quannaleap-image.png";
document.body.appendChild(a);
a.click();
a.remove();
}

/* =========================
Text → Image page (supports OLD + NEW create-image.html)
Expected backend JSON:
{ ok:true, mimeType:"image/png", base64:"...." }
========================= */
function setupTextToImagePage() {
// Required on both pages
const promptEl = $("prompt");
const generateBtn = $("generateBtn");

// OLD page ids:
const oldImg = $("resultImg");
const oldEmpty = $("emptyState");

// NEW create-image.html ids:
const newImg = $("previewImg");
const newEmpty = $("previewEmpty");
const creationStrip = $("creationStrip"); // optional but your new page has it
const downloadBtn = $("downloadBtn"); // could be <a> (old) or <button> (new)

// If not the text-to-image page, skip
if (!promptEl || !generateBtn || (!oldImg && !newImg)) return;

// Prevent double-wiring if scripts reload
if (window.__ql_text_to_image_wired) return;
window.__ql_text_to_image_wired = true;

const resultImg = newImg || oldImg;
const emptyState = newEmpty || oldEmpty;

let currentDataUrl = "";

function showImageUI(dataUrl) {
currentDataUrl = dataUrl;

resultImg.src = dataUrl;
show(resultImg);
if (emptyState) hide(emptyState);

// Enable & wire download
if (downloadBtn) {
// NEW: button
if (downloadBtn.tagName === "BUTTON") {
downloadBtn.disabled = false;
}
// OLD: anchor
if (downloadBtn.tagName === "A") {
downloadBtn.href = dataUrl;
downloadBtn.download = "quannaleap-image.png";
downloadBtn.style.display = "inline-flex";
}
}
}

function clearImageUI() {
currentDataUrl = "";
resultImg.src = "";
hide(resultImg);
if (emptyState) show(emptyState);

if (downloadBtn) {
if (downloadBtn.tagName === "BUTTON") {
downloadBtn.disabled = true;
}
if (downloadBtn.tagName === "A") {
downloadBtn.href = "#";
downloadBtn.style.display = "none";
}
}

localStorage.removeItem("ql_last_image_dataurl");
}

// If NEW page: add a thumb to the strip when we generate
function addThumbToStrip(dataUrl) {
if (!creationStrip) return;

const box = document.createElement("div");
box.className = "thumb";
box.setAttribute("data-src", dataUrl);

const img = document.createElement("img");
img.src = dataUrl;
img.alt = "Creation";

const x = document.createElement("div");
x.className = "xBtn";
x.textContent = "×";

box.addEventListener("click", () => {
showImageUI(dataUrl);
});

x.addEventListener("click", (e) => {
e.stopPropagation();
box.remove();

// If this was the current preview, show the next one or empty state
if (currentDataUrl === dataUrl) {
const next = creationStrip.querySelector(".thumb");
if (next) {
showImageUI(next.getAttribute("data-src"));
} else {
clearImageUI();
}
}
});

box.appendChild(img);
box.appendChild(x);
creationStrip.prepend(box);
}

// Restore last image on refresh
const saved = localStorage.getItem("ql_last_image_dataurl");
if (saved) {
showImageUI(saved);
// If new page has strip, optionally restore one thumb
if (creationStrip && !creationStrip.querySelector(".thumb")) {
addThumbToStrip(saved);
}
} else {
// Ensure correct initial state on new page
if (newImg) hide(newImg);
}

// Download handler:
if (downloadBtn) {
if (downloadBtn.tagName === "BUTTON") {
downloadBtn.addEventListener("click", () => {
if (!currentDataUrl) return;
downloadDataUrl(currentDataUrl, "quannaleap-image.png");
});
}
// Anchor version already handled by href/download in showImageUI
}

generateBtn.addEventListener("click", async () => {
const prompt = (promptEl.value || "").trim();
if (!prompt) {
alert("Please enter a prompt first.");
return;
}

generateBtn.disabled = true;
const originalText = generateBtn.textContent;
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

// NEW page: drop into strip too
addThumbToStrip(dataUrl);
} catch (err) {
console.error(err);
alert("Generate failed. Check Render logs / Console.");
} finally {
generateBtn.disabled = false;
generateBtn.textContent = originalText || "Generate";
}
});

// Optional: if your new page has Clear button wired in HTML inline, leave it.
// If you also want app.js to support it without breaking anything:
const clearBtn = $("clearBtn");
if (clearBtn) {
clearBtn.addEventListener("click", () => {
promptEl.value = "";
});
}
}

/* =========================
Image → Video page
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
resultVideo.src = "";
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
if (resultVideo) {
resultVideo.src = "";
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
if (!res.ok || !data.ok) throw new Error(data.error || `API error: ${res.status}`);

if (data.videoUrl && resultVideo) {
resultVideo.src = data.videoUrl;
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

if (data.base64 && resultVideo) {
const vUrl = `data:${data.mimeType || "video/mp4"};base64,${data.base64}`;
resultVideo.src = vUrl;
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

if (deleteBtn) deleteBtn.addEventListener("click", resetUI);

const savedVideo = localStorage.getItem("ql_last_video_url");
if (savedVideo && resultVideo) {
resultVideo.src = savedVideo;
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

const durationEl = $("t2vDuration"); // optional

if (!promptEl || !generateBtn || !resultVideo) return;

function clearUI() {
resultVideo.src = "";
hide(resultVideo);
if (emptyState) show(emptyState);

if (downloadBtn) downloadBtn.style.display = "none";
if (deleteBtn) deleteBtn.style.display = "none";

localStorage.removeItem("ql_last_t2v");
}

const saved = localStorage.getItem("ql_last_t2v");
if (saved) {
resultVideo.src = saved;
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

const durationSeconds = durationEl ? Number(durationEl.value) : undefined;

generateBtn.disabled = true;
generateBtn.textContent = "Generating...";

try {
const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
prompt,
...(Number.isFinite(durationSeconds) ? { durationSeconds } : {}),
}),
});

const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) throw new Error(data.error || `API error: ${res.status}`);

const videoUrl = data.videoUrl || "";
if (!videoUrl && !data.base64) throw new Error("No video returned.");

const finalUrl = videoUrl
? videoUrl
: `data:${data.mimeType || "video/mp4"};base64,${data.base64}`;

resultVideo.src = finalUrl;
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
BOOT (single DOMContentLoaded)
========================= */
document.addEventListener("DOMContentLoaded", () => {
tryLoadHoverVideos();
setupTextToImagePage();
setupImageToVideoPage();
setupTextToVideoPage();
setupTextToVoicePage();
});
