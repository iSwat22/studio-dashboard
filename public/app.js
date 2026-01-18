console.log("✅ app.js loaded (create-image wired)");

/* =========================
Helpers
========================= */
function $(id) {
return document.getElementById(id);
}

function show(el) {
if (el) el.style.display = "block";
}

function hide(el) {
if (el) el.style.display = "none";
}

function makeDataUrl(mimeType, base64) {
return `data:${mimeType || "image/png"};base64,${base64}`;
}

/* =========================
CREATE IMAGE (NEW PAGE)
Works ONLY with create-image.html
========================= */
function setupCreateImagePage() {
const promptEl = $("prompt");
const generateBtn = $("generateBtn");

const previewImg = $("previewImg");
const previewEmpty = $("previewEmpty");
const downloadBtn = $("downloadBtn");

// Guard: only run if this page exists
if (!promptEl || !generateBtn || !previewImg) {
console.log("ℹ️ Not create-image page, skipping");
return;
}

console.log("✅ create-image page detected");

function showImage(dataUrl) {
previewImg.src = dataUrl;
previewImg.style.display = "block";
hide(previewEmpty);

downloadBtn.disabled = false;
downloadBtn.onclick = () => {
const a = document.createElement("a");
a.href = dataUrl;
a.download = "quannaleap-image.png";
document.body.appendChild(a);
a.click();
a.remove();
};
}

generateBtn.addEventListener("click", async () => {
const prompt = promptEl.value.trim();
if (!prompt) {
alert("Enter a prompt first.");
return;
}

generateBtn.disabled = true;
generateBtn.textContent = "Generating...";

try {
const res = await fetch("/api/text-to-image", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt })
});

const data = await res.json();

if (!res.ok || !data.ok || !data.base64) {
throw new Error("Image generation failed");
}

const dataUrl = makeDataUrl(data.mimeType, data.base64);
showImage(dataUrl);

} catch (err) {
console.error(err);
alert("Generation failed. Check console / logs.");
} finally {
generateBtn.disabled = false;
generateBtn.textContent = "Generate";
}
});
}

/* =========================
BOOT
========================= */
document.addEventListener("DOMContentLoaded", () => {
setupCreateImagePage();
});
