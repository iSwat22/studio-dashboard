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

/* =========================
CREATE-IMAGE.HTML (NEW PAGE)
Wires to: /api/text-to-image
Sends: { prompt, size, count, quality }
Expected backend JSON:
{ ok:true, mimeType:"image/png", base64:"...." }
========================= */
function setupCreateImagePage() {
// This new page does NOT have body data-mode, so detect by required IDs
const promptEl = $("prompt");
const generateBtn = $("generateBtn");
const previewImg = $("previewImg");
const previewEmpty = $("previewEmpty");
const downloadBtn = $("downloadBtn");

// settings dropdowns (exist on create-image.html)
const sizeEl = $("size");
const countEl = $("count");
const qualityEl = $("quality");

// if not on create-image.html, skip
if (!promptEl || !generateBtn || !previewImg || !downloadBtn) return;

console.log("✅ setupCreateImagePage() active");

function showImageUI(dataUrl) {
previewImg.src = dataUrl;
previewImg.style.display = "block";
if (previewEmpty) previewEmpty.style.display = "none";

// Enable download button (it's a <button> on your new page)
downloadBtn.disabled = false;
}

function clearImageUI() {
previewImg.src = "";
previewImg.style.display = "none";
if (previewEmpty) previewEmpty.style.display = "block";

downloadBtn.disabled = true;
localStorage.removeItem("ql_last_image_dataurl");
}

// restore last image on refresh
const saved = localStorage.getItem("ql_last_image_dataurl");
if (saved) showImageUI(saved);

// Download current preview image (button)
downloadBtn.addEventListener("click", () => {
const dataUrl = previewImg.src;
if (!dataUrl) return;

const a = document.createElement("a");
a.href = dataUrl;
a.download = "quannaleap-image.png";
document.body.appendChild(a);
a.click();
a.remove();
});

// If your new page has a Clear button, keep it working (optional)
const clearBtn = $("clearBtn");
if (clearBtn) clearBtn.addEventListener("click", () => (promptEl.value = ""));

// If your new page has a Paste button, keep it working (optional)
const pasteBtn = $("pasteBtn");
if (pasteBtn) {
pasteBtn.addEventListener("click", async () => {
try {
const txt = await navigator.clipboard.readText();
if (txt) promptEl.value = txt;
} catch (e) {
alert("Clipboard paste blocked. Just Ctrl+V into the prompt box.");
}
});
}

generateBtn.addEventListener("click", async () => {
const prompt = (promptEl.value || "").trim();
if (!prompt) {
alert("Please enter a prompt first.");
return;
}

// Read settings (safe defaults)
const size = sizeEl ? sizeEl.value : "1024x1024";
const count = countEl ? Number(countEl.value) : 1;
const quality = qualityEl ? qualityEl.value : "standard";

generateBtn.disabled = true;
const oldText = generateBtn.textContent;
generateBtn.textContent = "Generating...";

try {
const res = await fetch("/api/text-to-image", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt, size, count, quality }),
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
generateBtn.textContent = oldText || "Generate";
}
});

// Optional: if you later add a delete button on create-image.html
const deleteBtn = $("deleteBtn");
if (deleteBtn) deleteBtn.addEventListener("click", clearImageUI);
}

/* =========================
Text → Image page (OLD PAGE)
(Leaving it here, but you said you're deleting it soon)
========================= */
function setupTextToImagePage() {
const mode = document.body.dataset.mode;
if (mode !== "text-to-image") return;

const promptEl = $("prompt");
const generateBtn = $("generateBtn");

const resultImg = $("resultImg");
const emptyState = $("emptyState");

const downloadBtn = $("downloadBtn");
const deleteBtn = $("deleteBtn");
const makeVideoBtn = $("makeVideoBtn");

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

const saved = localStorage.getItem("ql_last_image_dataurl");
if (saved) showImageUI(saved);

generateBtn.addEventListener("click", async () => {
const prompt = (promptEl.value || "").trim();
if (!prompt) return alert("Please enter a prompt first.");

generateBtn.disabled = true;
generateBtn.textContent = "Generating...";

try {
const res = await fetch("/api/text-to-image", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) throw new Error(data.error || `API error: ${res.status}`);
if (!data.base64) throw new Error("No base64 image returned from API.");

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

if (deleteBtn) deleteBtn.addEventListener("click", clearImageUI);

if (makeVideoBtn) {
makeVideoBtn.addEventListener("click", () => {
const dataUrl = resultImg.src;
if (!dataUrl) return;

localStorage.setItem("ql_image_for_video", dataUrl);
window.location.href = "./image-to-video.html";
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
Text → Video page (adds duration support)
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

const durationEl = $("t2vDuration");

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
setupCreateImagePage(); // ✅ NEW PAGE WIRED
setupTextToImagePage(); // old page (safe to keep)
setupImageToVideoPage();
setupTextToVideoPage();
setupTextToVoicePage();
});
