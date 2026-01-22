// public/create-video.js
// =======================================
// Text → Video (Veo) FRONTEND
// Matches backend polling architecture
// =======================================

console.log("✅ create-video.js loaded");

document.addEventListener("DOMContentLoaded", () => {
const promptInput = document.getElementById("t2vPrompt");
const generateBtn = document.getElementById("t2vBtn");
const statusEl = document.getElementById("t2vStatus");
const videoEl = document.getElementById("t2vVideo");

// If this page doesn't have the Text→Video UI, exit safely
if (!promptInput || !generateBtn || !statusEl || !videoEl) {
console.warn("⚠️ Text-to-Video elements not found");
return;
}

generateBtn.addEventListener("click", async () => {
const prompt = promptInput.value.trim();

if (!prompt) {
statusEl.textContent = "❌ Please enter a prompt.";
return;
}

// Reset UI
statusEl.textContent = "⏳ Starting video generation…";
generateBtn.disabled = true;
videoEl.pause();
videoEl.removeAttribute("src");
videoEl.load();
videoEl.style.display = "none";

try {
// =========================
// STEP 1: Start generation
// =========================
const startRes = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt }),
});

const startData = await startRes.json();

if (!startRes.ok || !startData.ok || !startData.operationName) {
throw new Error(startData?.error || "Failed to start video generation");
}

const operationName = startData.operationName;
statusEl.textContent = "🎬 Generating video… (this can take ~1 minute)";

// =========================
// STEP 2: Poll status
// =========================
let attempts = 0;
const maxAttempts = 60; // ~2 minutes

while (attempts < maxAttempts) {
await new Promise((r) => setTimeout(r, 2000));
attempts++;

const pollRes = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const pollData = await pollRes.json();

if (!pollRes.ok || !pollData.ok) {
throw new Error(pollData?.error || "Polling failed");
}

if (!pollData.done) {
statusEl.textContent = `⏳ Generating video… (${attempts * 2}s)`;
continue;
}

// =========================
// STEP 3: Video ready
// =========================
const videoSrc = pollData.proxyUrl || pollData.videoUrl;

if (!videoSrc) {
throw new Error("Video finished but no URL returned");
}

videoEl.src = videoSrc;
videoEl.style.display = "block";
videoEl.load();

try {
await videoEl.play();
} catch {
// Autoplay might be blocked — user can press play
}

statusEl.textContent = "✅ Video ready";
generateBtn.disabled = false;
return;
}

throw new Error("Video generation timed out");

} catch (err) {
console.error("❌ Text-to-Video error:", err);
statusEl.textContent = "❌ Error generating video";
generateBtn.disabled = false;
}
});
});
