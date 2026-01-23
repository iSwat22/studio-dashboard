/* create-video.js — FULL FILE (drop-in) */

console.log("create-video.js loaded");

document.addEventListener("DOMContentLoaded", () => {
// ===== Grab elements that exist in your create-video.html =====
const promptEl = document.getElementById("prompt");
const generateBtn = document.getElementById("generateBtn");
const clearBtn = document.getElementById("clearBtn");
const pasteBtn = document.getElementById("pasteBtn");

const aspectEl = document.getElementById("aspect");
const durationEl = document.getElementById("duration");
const qualityEl = document.getElementById("quality");

const videoEl = document.getElementById("previewVideo");
const emptyEl = document.getElementById("previewEmpty");
const downloadBtn = document.getElementById("downloadBtn");

if (!promptEl || !generateBtn || !videoEl || !emptyEl) {
console.warn("[T2V] Text-to-Video elements not found", {
promptEl: !!promptEl,
generateBtn: !!generateBtn,
videoEl: !!videoEl,
emptyEl: !!emptyEl,
});
return;
}

// ===== Small status helper (shows on page + logs) =====
const statusLine = document.createElement("div");
statusLine.style.marginTop = "10px";
statusLine.style.fontSize = "14px";
statusLine.style.opacity = "0.95";
statusLine.textContent = "";
emptyEl.parentElement?.appendChild(statusLine);

function setStatus(msg, isError = false) {
statusLine.textContent = msg;
statusLine.style.color = isError ? "#ff8080" : "#b9f6c7";
console.log(msg);
}

function showVideo(url) {
// Reset existing video
try {
videoEl.pause();
} catch {}
videoEl.removeAttribute("src");
videoEl.load();

// Set new source
videoEl.src = url;
videoEl.style.display = "block";
emptyEl.style.display = "none";

// Optional download
if (downloadBtn) {
downloadBtn.href = url;
downloadBtn.style.display = "inline-block";
}

videoEl.load();

// Autoplay may be blocked; user can click play
videoEl.play().catch(() => {
console.warn("[T2V] Autoplay blocked (normal). Click play.");
});
}

async function safeJson(resp) {
const text = await resp.text();
try {
return { ok: true, json: JSON.parse(text), raw: text };
} catch {
return { ok: false, json: null, raw: text };
}
}

async function startJob(payload) {
setStatus("⏳ Starting video job…");

const resp = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

const parsed = await safeJson(resp);

console.log("[T2V] START status:", resp.status);
console.log("[T2V] START raw:", parsed.raw);
console.log("[T2V] START json:", parsed.json);

if (!resp.ok) {
throw new Error(`Start failed (${resp.status}). ${parsed.raw || ""}`.trim());
}
if (!parsed.json || parsed.json.ok !== true) {
throw new Error(parsed.json?.error || "Start failed: bad JSON");
}
if (!parsed.json.operationName) {
throw new Error("Start succeeded but operationName missing");
}

return parsed.json.operationName;
}

async function pollStatus(operationName) {
const resp = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const parsed = await safeJson(resp);

console.log("[T2V] STATUS status:", resp.status);
console.log("[T2V] STATUS raw:", parsed.raw);
console.log("[T2V] STATUS json:", parsed.json);

if (!resp.ok) {
throw new Error(`Status failed (${resp.status}). ${parsed.raw || ""}`.trim());
}
if (!parsed.json || parsed.json.ok !== true) {
throw new Error(parsed.json?.error || "Status failed: bad JSON");
}

return parsed.json;
}

async function generateVideoFlow() {
const prompt = (promptEl.value || "").trim();
if (!prompt) {
setStatus("❌ Please enter a prompt.", true);
return;
}

// Hide preview until we have something
videoEl.style.display = "none";
emptyEl.style.display = "block";
if (downloadBtn) downloadBtn.style.display = "none";

const payload = {
prompt,
aspect: aspectEl?.value || "portrait",
duration: Number(durationEl?.value || 8),
quality: qualityEl?.value || "high",
};

generateBtn.disabled = true;

try {
// 1) Start
const operationName = await startJob(payload);
setStatus(`✅ Job started. operationName=${operationName}`);

// 2) Poll
setStatus("⏳ Generating… waiting for video URL");
const maxMs = 120000; // 2 minutes
const intervalMs = 2000;
const start = Date.now();

while (Date.now() - start < maxMs) {
await new Promise((r) => setTimeout(r, intervalMs));

const status = await pollStatus(operationName);

if (!status.done) {
setStatus("⏳ Still working…");
continue;
}

// 3) Done — need URL
const url = status.proxyUrl || status.videoUrl;

if (!url) {
// THIS is your current issue — we show EXACTLY what came back.
console.error("[T2V] DONE but missing URL. Full status JSON:", status);
setStatus(
"❌ Video finished but no URL returned. Open Console → see STATUS json.",
true
);

// Also show it on-screen (so you can screenshot it)
const pretty = JSON.stringify(status, null, 2);
const pre = document.createElement("pre");
pre.style.marginTop = "10px";
pre.style.whiteSpace = "pre-wrap";
pre.style.fontSize = "12px";
pre.style.opacity = "0.9";
pre.textContent = pretty;
statusLine.parentElement?.appendChild(pre);

return;
}

setStatus(`✅ Video ready. Loading: ${url}`);
showVideo(url);
return;
}

setStatus("❌ Timed out waiting for video.", true);
} catch (err) {
console.error(err);
setStatus(`❌ ${err.message || "Error generating video"}`, true);
} finally {
generateBtn.disabled = false;
}
}

// Buttons
generateBtn.addEventListener("click", generateVideoFlow);

if (clearBtn) {
clearBtn.addEventListener("click", () => {
promptEl.value = "";
setStatus("");
});
}

if (pasteBtn) {
pasteBtn.addEventListener("click", async () => {
try {
const text = await navigator.clipboard.readText();
if (text) promptEl.value = text;
} catch (e) {
console.warn("Paste blocked by browser permissions.");
}
});
}
});
