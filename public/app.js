console.log("✅ app.js loaded");

/* =========================
Hover videos on dashboard cards (your existing logic)
========================= */
function tryLoadHoverVideos() {
const videos = document.querySelectorAll("video.card-video");

videos.forEach((v) => {
const src = v.getAttribute("data-src");
if (!src) return;

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
Text → Image page actions
- Generate (calls /api/text-to-image)
- Download
- Delete
- Make Video (stores image + redirects)
========================= */
async function setupTextToImagePage() {
const promptEl = document.getElementById("prompt");
const generateBtn = document.getElementById("generateBtn");

const resultImg = document.getElementById("resultImg");
const emptyState = document.getElementById("emptyState");

const downloadBtn = document.getElementById("downloadBtn");
const deleteBtn = document.getElementById("deleteBtn");
const makeVideoBtn = document.getElementById("makeVideoBtn");

// If this page doesn't have these elements, skip
if (!promptEl || !generateBtn || !resultImg) return;

function showImageUI(imageUrl) {
resultImg.src = imageUrl;
resultImg.style.display = "block";
if (emptyState) emptyState.style.display = "none";

// download link
if (downloadBtn) {
downloadBtn.href = imageUrl;
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
if (makeVideoBtn) makeVideoBtn.style.display = "inline-flex";
}

function clearImageUI() {
resultImg.src = "";
resultImg.style.display = "none";
if (emptyState) emptyState.style.display = "block";

if (downloadBtn) {
downloadBtn.href = "#";
downloadBtn.style.display = "none";
}
if (deleteBtn) deleteBtn.style.display = "none";
if (makeVideoBtn) makeVideoBtn.style.display = "none";

// clear stored image
localStorage.removeItem("ql_last_image_url");
}

// Restore last image if user refreshes
const saved = localStorage.getItem("ql_last_image_url");
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
// IMPORTANT:
// This expects your backend endpoint returns JSON containing:
// { imageUrl: "https://..." } OR { url: "https://..." }
const res = await fetch("/api/text-to-image", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt })
});

if (!res.ok) {
const t = await res.text().catch(() => "");
throw new Error(`API error: ${res.status} ${t}`);
}

const data = await res.json();
const imageUrl = data.imageUrl || data.url || data.output || "";

if (!imageUrl) {
throw new Error("No image URL returned from API.");
}

localStorage.setItem("ql_last_image_url", imageUrl);
showImageUI(imageUrl);
} catch (err) {
console.error(err);
alert("Generate failed. Check console / server logs.");
} finally {
generateBtn.disabled = false;
generateBtn.textContent = "Generate";
}
});

if (deleteBtn) {
deleteBtn.addEventListener("click", () => {
clearImageUI();
});
}

if (makeVideoBtn) {
makeVideoBtn.addEventListener("click", () => {
const imageUrl = resultImg.src;
if (!imageUrl) return;

// store image so Image→Video page can pick it up
localStorage.setItem("ql_image_for_video", imageUrl);

// send them to your Image→Video create page
// Update this path if your page name is different:
window.location.href = "./create.html?mode=image-to-video";
});
}
}

document.addEventListener("DOMContentLoaded", () => {
tryLoadHoverVideos();
setupTextToImagePage();
});
