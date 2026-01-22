
/* create-video.js — FINAL */

console.log("✅ create-video.js loaded");

document.addEventListener("DOMContentLoaded", () => {
const promptBox = document.getElementById("prompt");
const generateBtn = document.getElementById("generateBtn");
const statusText = document.getElementById("previewEmpty");
const video = document.getElementById("previewVideo");
const downloadBtn = document.getElementById("downloadBtn");

if (!promptBox || !generateBtn || !video) {
console.warn("T2V elements missing — skipping wiring");
return;
}

async function sleep(ms) {
return new Promise(r => setTimeout(r, ms));
}

generateBtn.addEventListener("click", async () => {
const prompt = promptBox.value.trim();
if (!prompt) {
statusText.textContent = "Please enter a prompt.";
return;
}

generateBtn.disabled = true;
statusText.textContent = "Generating video…";
video.style.display = "none";
video.removeAttribute("src");

try {
// STEP 1: Start job
const startRes = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt }),
});

const startData = await startRes.json();
if (!startRes.ok || !startData.ok) {
throw new Error(startData.error || "Failed to start video job");
}

const operationName = startData.operationName;

// STEP 2: Poll status
let videoUrl = null;

for (let i = 0; i < 40; i++) {
await sleep(3000);

const pollRes = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const pollData = await pollRes.json();
if (!pollRes.ok || !pollData.ok) {
throw new Error(pollData.error || "Polling failed");
}

if (pollData.done) {
videoUrl = pollData.videoUrl || pollData.proxyUrl;
break;
}

statusText.textContent = `Generating video… (${i + 1})`;
}

if (!videoUrl) {
throw new Error("Timed out waiting for video");
}

// STEP 3: Show video
video.src = videoUrl;
video.style.display = "block";
video.controls = true;
video.load();

video.play().catch(() => {});
statusText.textContent = "✅ Video ready";

if (downloadBtn) {
downloadBtn.href = videoUrl;
downloadBtn.style.display = "inline-flex";
}

} catch (err) {
console.error(err);
statusText.textContent = "❌ Error generating video";
} finally {
generateBtn.disabled = false;
}
});
});
