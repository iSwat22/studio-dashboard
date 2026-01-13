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
// TEXT -> VIDEO (supports BOTH HTML ID styles)
//
// Style A (your script expected):
// t2vPrompt, t2vBtn, t2vStatus, t2vVideo
//
// Style B (your HTML screenshots show):
// prompt, generateBtn, status, resultVideo
// ======================================================

const pickFirst = (...ids) => ids.map((id) => document.getElementById(id)).find(Boolean);

const t2vPrompt = pickFirst("t2vPrompt", "prompt");
const t2vBtn = pickFirst("t2vBtn", "generateBtn");
const t2vStatus = pickFirst("t2vStatus", "status", "statusText", "outputStatus");
const t2vVideo = pickFirst("t2vVideo", "resultVideo", "video");

// If missing, don’t crash — but tell you exactly what’s wrong.
if (!t2vPrompt || !t2vBtn || !t2vVideo) {
console.warn("⚠️ Text→Video UI not found. Missing IDs:", {
promptFound: Boolean(t2vPrompt),
buttonFound: Boolean(t2vBtn),
videoFound: Boolean(t2vVideo),
statusFound: Boolean(t2vStatus),
});
return;
}

let lastObjectUrl = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function setStatus(msg) {
if (t2vStatus) t2vStatus.textContent = msg;
console.log("[T2V]", msg);
}

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
// Poll up to ~5 minutes (100 * 3s)
const maxAttempts = 100;

for (let i = 1; i <= maxAttempts; i++) {
setStatus(`Generating video… (${i}/${maxAttempts})`);
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
if (data.videoUrl) return { videoUrl: data.videoUrl };
if (data.base64) return { base64: data.base64, mimeType: data.mimeType || "video/mp4" };
throw new Error("Video finished, but no videoUrl/base64 returned");
}
}

throw new Error("Timed out waiting for the video to finish");
}

async function generateVideo(prompt) {
t2vBtn.disabled = true;

// reset video UI
t2vVideo.style.display = "none";
t2vVideo.removeAttribute("src");
t2vVideo.load();

// cleanup old object url if we created one
if (lastObjectUrl) {
URL.revokeObjectURL(lastObjectUrl);
lastObjectUrl = null;
}

try {
setStatus("Starting video job…");
const opName = await startTextToVideoJob(prompt);

const result = await pollTextToVideo(opName);

if (result.videoUrl) {
t2vVideo.src = result.videoUrl;
t2vVideo.style.display = "block";
setStatus("✅ Video ready");
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
setStatus("✅ Video ready");
return;
}

throw new Error("Unknown video response format");
} catch (err) {
console.error(err);
setStatus(`❌ ${err.message || err}`);
} finally {
t2vBtn.disabled = false;
}
}

// Attach click
t2vBtn.addEventListener("click", () => {
const prompt = t2vPrompt.value.trim();
if (!prompt) {
setStatus("Please enter a prompt.");
return;
}
generateVideo(prompt);
});

console.log("✅ Text→Video wired:", {
promptId: t2vPrompt.id,
btnId: t2vBtn.id,
statusId: t2vStatus ? t2vStatus.id : "(none)",
videoId: t2vVideo.id,
});
});




