// public/create-video.js
// =======================================
// Text → Video (create-video.html) FRONTEND
// Uses your existing HTML IDs:
// - #prompt
// - #generateBtn
// - #previewVideo
// - #previewEmpty (used as status text)
// =======================================

console.log("✅ create-video.js loaded");

document.addEventListener("DOMContentLoaded", () => {
const promptInput = document.getElementById("prompt");
const generateBtn = document.getElementById("generateBtn");
const videoEl = document.getElementById("previewVideo");
const statusEl = document.getElementById("previewEmpty"); // we use this as status box

// If this page doesn’t have the right elements, bail safely
if (!promptInput || !generateBtn || !videoEl || !statusEl) {
console.warn("⚠️ Text-to-Video elements not found", {
promptInput: !!promptInput,
generateBtn: !!generateBtn,
videoEl: !!videoEl,
statusEl: !!statusEl,
});
return;
}

// Small helper: set status text
function setStatus(msg) {
statusEl.textContent = msg;
statusEl.style.display = "block";
}

// Small helper: reset preview
function resetVideo() {
try {
videoEl.pause();
} catch {}
videoEl.removeAttribute("src");
videoEl.load();
videoEl.style.display = "none";
}

generateBtn.addEventListener("click", async () => {
const prompt = String(promptInput.value || "").trim();

if (!prompt) {
setStatus("❌ Please enter a prompt.");
return;
}

// UI reset
generateBtn.disabled = true;
resetVideo();
setStatus("⏳ Starting video generation…");

try {
// =========================
// STEP 1: Start generation
// =========================
const startRes = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt }),
});

const startData = await startRes.json().catch(() => ({}));

if (!startRes.ok || !startData.ok || !startData.operationName) {
throw new Error(startData?.error || "Failed to start video generation");
}

const operationName = startData.operationName;
setStatus("🎬 Generating video… (this can take a minute)");

// =========================
// STEP 2: Poll status
// =========================
let attempts = 0;
const maxAttempts = 60; // 60 * 2s = 120s

while (attempts < maxAttempts) {
await new Promise((r) => setTimeout(r, 2000));
attempts++;

const pollRes = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const pollData = await pollRes.json().catch(() => ({}));

if (!pollRes.ok || !pollData.ok) {
throw new Error(pollData?.error || "Polling failed");
}

if (!pollData.done) {
setStatus(`⏳ Generating video… (${attempts * 2}s)`);
continue;
}

// =========================
// STEP 3: Video ready
// Use proxyUrl first (best for <video> streaming on Render)
// =========================
const videoSrc = pollData.proxyUrl || pollData.videoUrl;

if (!videoSrc) {
throw new Error("Video finished but no URL returned");
}

// Show video
statusEl.style.display = "none";
videoEl.src = videoSrc;
videoEl.style.display = "block";
videoEl.load();

try {
await videoEl.play();
} catch {
// Autoplay might be blocked — user can click play
}

generateBtn.disabled = false;
return;
}

throw new Error("Video generation timed out (took too long).");
} catch (err) {
console.error("❌ Text-to-Video error:", err);
setStatus("❌ Error generating video (check Console + Network tab).");
generateBtn.disabled = false;
}
});
});
