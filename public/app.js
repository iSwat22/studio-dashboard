console.log("✅ app.js loaded");

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
Create Image page wiring (create-image.html)
- Uses your NEW UI IDs:
prompt, generateBtn, previewImg, previewEmpty, downloadBtn, creationStrip
Expected backend JSON:
{ ok:true, mimeType:"image/png", base64:"...." }
========================= */
function setupCreateImagePage() {
// Required elements for the new page
const promptEl = $("prompt");
const generateBtn = $("generateBtn");
const previewImg = $("previewImg");
const previewEmpty = $("previewEmpty");
const downloadBtn = $("downloadBtn");
const creationStrip = $("creationStrip");

// If this page doesn't have these elements, skip
if (!promptEl || !generateBtn || !previewImg) return;

// Track what is currently previewed (dataURL)
let currentDataUrl = "";

function setPreview(dataUrl) {
currentDataUrl = dataUrl || "";

if (!dataUrl) {
previewImg.src = "";
hide(previewImg);
if (previewEmpty) show(previewEmpty);

if (downloadBtn) {
downloadBtn.disabled = true;
}
return;
}

previewImg.src = dataUrl;
show(previewImg);
if (previewEmpty) hide(previewEmpty);

if (downloadBtn) {
downloadBtn.disabled = false;
}
}

// Add a thumbnail to the bottom strip (optional UI)
function addThumb(dataUrl) {
if (!creationStrip) return;

const box = document.createElement("div");
box.className = "thumb";

const img = document.createElement("img");
img.src = dataUrl;
img.alt = "Creation";

const x = document.createElement("div");
x.className = "xBtn";
x.textContent = "×";

box.addEventListener("click", () => setPreview(dataUrl));
x.addEventListener("click", (e) => {
e.stopPropagation();
box.remove();
// If the deleted thumb was the current preview, clear preview
if (currentDataUrl === dataUrl) setPreview("");
});

box.appendChild(img);
box.appendChild(x);

creationStrip.prepend(box);
}

// Download the current preview
if (downloadBtn) {
downloadBtn.addEventListener("click", () => {
if (!currentDataUrl) return;

const a = document.createElement("a");
a.href = currentDataUrl;
a.download = "quanneleap-image.png";
document.body.appendChild(a);
a.click();
a.remove();
});
}

// Generate -> calls backend and shows preview
generateBtn.addEventListener("click", async () => {
const prompt = (promptEl.value || "").trim();
if (!prompt) {
alert("Please enter a prompt first.");
return;
}

const sizeEl = $("size");
const countEl = $("count");
const qualityEl = $("quality");

const size = sizeEl ? sizeEl.value : "1024x1024";
const count = countEl ? Number(countEl.value) : 1;
const quality = qualityEl ? qualityEl.value : "standard";

generateBtn.disabled = true;
const originalText = generateBtn.textContent;
generateBtn.textContent = "Generating...";

try {
const res = await fetch("/api/text-to-image", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
prompt,
size,
count,
quality,
}),
});

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) {
throw new Error(data.error || `API error: ${res.status}`);
}

// Support either: {base64} or {images:[{base64,mimeType}, ...]}
let firstBase64 = data.base64;
let firstMime = data.mimeType;

if (!firstBase64 && Array.isArray(data.images) && data.images.length) {
firstBase64 = data.images[0].base64;
firstMime = data.images[0].mimeType || data.mimeType;
}

if (!firstBase64) {
throw new Error("No base64 image returned from API.");
}

const dataUrl = makeDataUrl(firstMime, firstBase64);

setPreview(dataUrl);
addThumb(dataUrl);

// Save so refresh keeps the last image (optional)
try {
localStorage.setItem("ql_last_image_dataurl", dataUrl);
} catch {}
} catch (err) {
console.error(err);
alert("Generate failed. Open DevTools Console + check Render logs.");
} finally {
generateBtn.disabled = false;
generateBtn.textContent = originalText;
}
});

// Restore last preview on refresh
try {
const saved = localStorage.getItem("ql_last_image_dataurl");
if (saved) setPreview(saved);
} catch {}
}

/* =========================
BOOT
========================= */
document.addEventListener("DOMContentLoaded", () => {
setupCreateImagePage();
});
