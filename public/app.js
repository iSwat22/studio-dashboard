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
Text → Image (CREATE-IMAGE.html wiring)
Works with your new UI ids:
prompt, generateBtn, previewImg, previewEmpty,
downloadBtn, creationStrip, size, count, quality
========================= */
function setupCreateImagePage() {
// Required elements on create-image.html
const promptEl = $("prompt");
const generateBtn = $("generateBtn");
const previewImg = $("previewImg");
const previewEmpty = $("previewEmpty");
const downloadBtn = $("downloadBtn");
const creationStrip = $("creationStrip");

// Settings (optional but present on your page)
const sizeEl = $("size");
const countEl = $("count");
const qualityEl = $("quality");

// If this page doesn't have the create-image ids, skip
if (!promptEl || !generateBtn || !previewImg || !previewEmpty || !downloadBtn) return;

let currentPreviewSrc = "";

function setPreview(src) {
currentPreviewSrc = src || "";

if (!src) {
previewImg.style.display = "none";
previewImg.src = "";
previewEmpty.style.display = "block";
downloadBtn.disabled = true;
return;
}

previewImg.src = src;
previewImg.style.display = "block";
previewEmpty.style.display = "none";
downloadBtn.disabled = false;
}

function addCreationThumb(src) {
if (!creationStrip || !src) return;

const box = document.createElement("div");
box.className = "thumb";
box.setAttribute("data-src", src);

const img = document.createElement("img");
img.src = src;
img.alt = "Creation";

const x = document.createElement("div");
x.className = "xBtn";
x.textContent = "×";

box.addEventListener("click", () => setPreview(src));
x.addEventListener("click", (e) => {
e.stopPropagation();
box.remove();
// If user deletes the currently previewed image, clear preview
if (currentPreviewSrc === src) setPreview(null);
});

box.appendChild(img);
box.appendChild(x);

creationStrip.prepend(box);
}

// Download current preview image
downloadBtn.addEventListener("click", () => {
if (!currentPreviewSrc) return;

const a = document.createElement("a");
a.href = currentPreviewSrc;
a.download = "quanneleap-image.png";
document.body.appendChild(a);
a.click();
a.remove();
});

// Restore last image on refresh (optional)
const saved = localStorage.getItem("ql_last_image_dataurl");
if (saved) {
setPreview(saved);
// Also add a thumb so the strip matches what’s in preview
addCreationThumb(saved);
} else {
setPreview(null);
}

generateBtn.addEventListener("click", async () => {
const prompt = (promptEl.value || "").trim();
if (!prompt) {
alert("Please enter a prompt first.");
return;
}

// Read UI settings (fallbacks if missing)
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
body: JSON.stringify({
prompt,
size,
n: count,
quality,
}),
});

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) {
throw new Error(data.error || `API error: ${res.status}`);
}

// Support either a single image or multiple
// Preferred formats:
// 1) { ok:true, mimeType, base64 }
// 2) { ok:true, images:[{ mimeType, base64 }, ...] }
let images = [];

if (data.base64) {
images = [{ mimeType: data.mimeType, base64: data.base64 }];
} else if (Array.isArray(data.images) && data.images.length) {
images = data.images;
} else {
throw new Error("No image returned from API.");
}

// Show first image in preview, add all to strip
const firstUrl = makeDataUrl(images[0].mimeType, images[0].base64);
setPreview(firstUrl);
localStorage.setItem("ql_last_image_dataurl", firstUrl);

// Add all returned images to strip
images.forEach((imgObj) => {
const url = makeDataUrl(imgObj.mimeType, imgObj.base64);
addCreationThumb(url);
});

} catch (err) {
console.error(err);
alert("Generate failed. Check Render logs / Console.");
} finally {
generateBtn.disabled = false;
generateBtn.textContent = oldText || "Generate";
}
});
}

/* =========================
BOOT
========================= */
document.addEventListener("DOMContentLoaded", () => {
setupCreateImagePage();
});
