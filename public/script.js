// public/script.js ✅ (FRONTEND SCRIPT runs in the browser only)
console.log("✅ Frontend script loaded");

document.addEventListener("DOMContentLoaded", () => {
// ======================================================
// TEXT -> IMAGE (works with your existing HTML IDs)
// ======================================================
const t2iPrompt = document.getElementById("t2iPrompt");
const t2iBtn = document.getElementById("t2iBtn");
const t2iStatus = document.getElementById("t2iStatus");
const t2iImg = document.getElementById("t2iImg");

// If this page doesn’t have the Text→Image card, just skip it.
if (t2iPrompt && t2iBtn && t2iStatus && t2iImg) {
t2iBtn.addEventListener("click", async () => {
const prompt = t2iPrompt.value.trim();

if (!prompt) {
t2iStatus.textContent = "Please enter a prompt.";
return;
}

t2iStatus.textContent = "Generating image…";
t2iBtn.disabled = true;
t2iImg.style.display = "none";

try {
const res = await fetch("/api/text-to-image", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt }),
});

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) {
throw new Error(data.error || "Generation failed");
}

t2iImg.src = `data:${data.mimeType};base64,${data.base64}`;
t2iImg.style.display = "block";
t2iStatus.textContent = "✅ Image generated";
} catch (err) {
console.error(err);
t2iStatus.textContent = `❌ Error generating image: ${err.message || err}`;
} finally {
t2iBtn.disabled = false;
}
});
}

// ======================================================
// TEXT -> VIDEO (needs these HTML IDs to exist)
// t2vPrompt (textarea/input)
// t2vBtn (button)
// t2vStatus (div/span/p)
// t2vVideo (video tag)
// ======================================================
const t2vPrompt = document.getElementById("t2vPrompt");
const t2vBtn = document.getElementById("t2vBtn");
const t2vStatus = document.getElementById("t2vStatus");
const t2vVideo = document.getElementById("t2vVideo");

// If this page doesn’t have the Text→Video card, just skip it.
if (t2vPrompt && t2vBtn && t2vStatus && t2vVideo) {
let lastObjectUrl = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function startTextToVideoJob(prompt) {
const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt }),
});
const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) {
throw new Error(data.error || "Failed to start video job");
}
if (!data.operationName) {
throw new Error("Server did not return operationName");
}
return data.operationName;
}

async function pollTextToVideo(operationName) {
// Poll up to ~3 minutes (60 * 3s)
const maxAttempts = 60;

for (let i = 1; i <= maxAttempts; i++) {
t2vStatus.textContent = `Generating video… (${i}/${maxAttempts})`;
await sleep(3000);

const res = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const data = await res.json().catch(() => ({}));

if (!res.ok || !data.ok) {
throw new Error(data.error || "Status check failed");
}

if (data.done) {
// Prefer playable signed URL (recommended path)
if (data.videoUrl) return { videoUrl: data.videoUrl };

// If your backend ever returns base64 instead, support it too
if (data.base64) return { base64: data.base64, mimeType: data.mimeType || "video/mp4" };

// If done but nothing usable came back:
throw new Error("Video finished, but no videoUrl/base64 returned");
}
}

throw new Error("Timed out waiting for the video to finish");
}

async function generateVideo(prompt) {
t2vBtn.disabled = true;
t2vVideo.style.display = "none";
t2vVideo.removeAttribute("src");
t2vVideo.load();

// cleanup old object url if we created one
if (lastObjectUrl) {
URL.revokeObjectURL(lastObjectUrl);
lastObjectUrl = null;
}

try {
t2vStatus.textContent = "Starting video job…";
const opName = await startTextToVideoJob(prompt);

const result = await pollTextToVideo(opName);

if (result.videoUrl) {
t2vVideo.src = result.videoUrl;
t2vVideo.style.display = "block";
t2vStatus.textContent = "✅ Video ready";
return;
}

// base64 fallback
if (result.base64) {
const byteChars = atob(result.base64);
const byteNumbers = new Array(byteChars.length);
for (let i = 0; i < byteChars.length; i++) {
byteNumbers[i] = byteChars.charCodeAt(i);
}
const blob = new Blob([new Uint8Array(byteNumbers)], { type: result.mimeType || "video/mp4" });
lastObjectUrl = URL.createObjectURL(blob);

t2vVideo.src = lastObjectUrl;
t2vVideo.style.display = "block";
t2vStatus.textContent = "✅ Video ready";
return;
}

throw new Error("Unknown video response format");
} catch (err) {
console.error(err);
t2vStatus.textContent = `❌ ${err.message || err}`;
} finally {
t2vBtn.disabled = false;
}
}

t2vBtn.addEventListener("click", () => {
const prompt = t2vPrompt.value.trim();
if (!prompt) {
t2vStatus.textContent = "Please enter a prompt.";
return;
}
generateVideo(prompt);
});
}
});


