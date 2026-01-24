/* ======================================================
QuanneLeap.AI — create-video.js (Single Source of Truth)
- Uses ONLY create-video.html IDs
- Calls /api/text-to-video then polls /api/text-to-video/status
- Sets previewVideo src to proxyUrl || videoUrl
====================================================== */

const USER = { name: "KC", role: "Admin", plan: "Platinum", stars: "∞", isAdmin: true };

function applyUserUI() {
const planPill = document.getElementById("planPill");
const starsPill = document.getElementById("starsPill");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");
const avatarCircle = document.getElementById("avatarCircle");

if (planPill) planPill.textContent = USER.plan;
if (starsPill) starsPill.textContent = USER.isAdmin ? "★ ∞" : `★ ${USER.stars}`;
if (profileName) profileName.textContent = USER.name;
if (profileRole) profileRole.textContent = USER.role;
if (avatarCircle) avatarCircle.textContent = (USER.name || "U").trim().charAt(0).toUpperCase();
}

function $(id) {
return document.getElementById(id);
}

function setStatus(msg) {
const empty = $("previewEmpty");
if (empty) empty.textContent = msg;
console.log("[T2V]", msg);
}

function showVideo(url) {
const video = $("previewVideo");
const empty = $("previewEmpty");
const download = $("downloadBtn");

if (!video) return;

// show video area
if (empty) empty.style.display = "none";
video.style.display = "block";

// IMPORTANT: force reload each time
video.pause?.();
video.removeAttribute("src");
video.load();

// cache-bust to avoid 304 weirdness during testing
const finalUrl = url + (url.includes("?") ? "&" : "?") + "cb=" + Date.now();

video.src = finalUrl;
video.setAttribute("playsinline", "");
video.muted = false;
video.load();

// optional download button
if (download) {
download.href = finalUrl;
download.download = "quannaleap-text-video.mp4";
download.style.display = "inline-flex";
}

// Try autoplay (may be blocked)
video.play().catch(() => {
// it's fine if autoplay is blocked — user can press play
});
}

async function startTextToVideoJob({ prompt, durationSeconds, aspectRatio }) {
const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt, durationSeconds, aspectRatio }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) throw new Error(data.error || "Failed to start video job");
if (!data.operationName) throw new Error("Server did not return operationName");
return data.operationName;
}

async function pollTextToVideo(operationName) {
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxAttempts = 100;

for (let i = 1; i <= maxAttempts; i++) {
setStatus(`Generating video… (${i}/${maxAttempts})`);
await sleep(2500);

const res = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) throw new Error(data.error || "Status check failed");

if (data.done) {
// prefer proxyUrl (range-safe), else videoUrl
const finalUrl = data.proxyUrl || data.videoUrl;
if (!finalUrl) throw new Error("Video finished, but no URL returned");
return finalUrl;
}
}

throw new Error("Timed out waiting for the video");
}

async function onGenerateClick() {
const promptEl = $("prompt"); // from create-video.html
const generateBtn = $("generateBtn");
const durationEl = $("duration");
const aspectEl = $("aspect");

const video = $("previewVideo");
const empty = $("previewEmpty");
const download = $("downloadBtn");

const prompt = (promptEl?.value || "").trim();
if (!prompt) return setStatus("Please enter a prompt.");

// Reset UI
if (video) {
video.pause?.();
video.removeAttribute("src");
video.load();
video.style.display = "none";
}
if (empty) empty.style.display = "block";
if (download) download.style.display = "none";

const durationSeconds = Number(durationEl?.value || 8);

// Map your UI aspect values to backend aspect ratios
// If your backend expects "16:9 / 9:16 / 1:1" change these here.
const aspectUi = String(aspectEl?.value || "landscape");
const aspectRatio =
aspectUi === "portrait" ? "9:16" :
aspectUi === "square" ? "1:1" :
"16:9";

try {
if (generateBtn) generateBtn.disabled = true;

setStatus("Starting video job…");
const opName = await startTextToVideoJob({ prompt, durationSeconds, aspectRatio });

const url = await pollTextToVideo(opName);

setStatus("✅ Video ready");
showVideo(url);
} catch (err) {
console.error(err);
setStatus(`❌ ${err?.message || err}`);
} finally {
if (generateBtn) generateBtn.disabled = false;
}
}

function initButtons() {
const clearBtn = $("clearBtn");
const pasteBtn = $("pasteBtn");
const generateBtn = $("generateBtn");

if (clearBtn) {
clearBtn.addEventListener("click", () => {
const p = $("prompt");
if (p) p.value = "";
setStatus("Cleared.");
});
}

if (pasteBtn) {
pasteBtn.addEventListener("click", async () => {
try {
const txt = await navigator.clipboard.readText();
const p = $("prompt");
if (p) p.value = (p.value ? p.value + "\n" : "") + txt;
setStatus("Pasted from clipboard.");
} catch {
setStatus("Clipboard paste blocked. (Browser permissions)");
}
});
}

if (generateBtn) {
generateBtn.addEventListener("click", onGenerateClick);
}
}

/* ---------- BOOT ---------- */
document.addEventListener("DOMContentLoaded", () => {
applyUserUI();
initButtons();
setStatus("Your generated video will appear here.");
});
