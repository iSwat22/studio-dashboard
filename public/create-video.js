/* create-video.js */
console.log("create-video.js loaded");

// ======================================================
// TEXT -> VIDEO (create-video.html)
// - Starts job: POST /api/text-to-video
// - Polls: POST /api/text-to-video/status
// - Uses proxyUrl if returned
// - Verifies the returned URL is REALLY a video (not HTML)
// ======================================================

const pickFirst = (...ids) =>
ids.map((id) => document.getElementById(id)).find(Boolean);

const t2vPrompt = pickFirst("t2vPrompt", "prompt");
const t2vBtn = pickFirst("t2vBtn", "generateBtn");
const t2vStatus = pickFirst(
"t2vStatus",
"status",
"statusText",
"outputStatus",
"previewEmpty"
);
const t2vVideo = pickFirst("t2vVideo", "resultVideo", "video", "previewVideo");

const downloadBtn = pickFirst("downloadBtn");
const deleteBtn = pickFirst("deleteBtn");
const saveToAssetsBtn = pickFirst("saveToAssetsBtn");

const t2vDuration = pickFirst("t2vDuration", "duration");
const t2vAspect = pickFirst("t2vAspect", "aspect");

function setT2vStatus(msg) {
if (t2vStatus) t2vStatus.textContent = msg;
console.log("[T2V]", msg);
}

function hideT2vButtons() {
if (downloadBtn) downloadBtn.style.display = "none";
if (deleteBtn) deleteBtn.style.display = "none";
if (saveToAssetsBtn) saveToAssetsBtn.style.display = "none";
}

function showT2vButtons(finalUrl) {
if (downloadBtn) {
downloadBtn.href = finalUrl;
downloadBtn.download = "quanneleap-text-video.mp4";
downloadBtn.style.display = "inline-flex";
}
if (deleteBtn) deleteBtn.style.display = "inline-flex";
if (saveToAssetsBtn) saveToAssetsBtn.style.display = "inline-flex";
}

async function startTextToVideoJob(prompt, options) {
const payload = {
prompt,
// send both names so backend can match whatever
aspectRatio: options.aspectRatio,
durationSeconds: options.durationSeconds,
};

const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(payload),
});

const data = await res.json().catch(() => ({}));
console.log("startTextToVideoJob response:", res.status, data);

if (!res.ok || !data.ok) throw new Error(data.error || "Failed to start video job");
if (!data.operationName) throw new Error("Server did not return operationName");

return data.operationName;
}

async function pollTextToVideo(operationName) {
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const maxAttempts = 120;

for (let i = 1; i <= maxAttempts; i++) {
setT2vStatus(`Generating video… (${i}/${maxAttempts})`);
await sleep(3000);

const res = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName }),
});

const data = await res.json().catch(() => ({}));
if (i === 1 || i % 5 === 0) console.log("pollTextToVideo tick:", i, res.status, data);

if (!res.ok || !data.ok) throw new Error(data.error || "Status check failed");

if (data.done) {
console.log("pollTextToVideo DONE:", data);

// IMPORTANT: Prefer proxyUrl if the backend provides it
// because proxyUrl is designed to play nicely in <video>.
const finalUrl = (data.proxyUrl || data.videoUrl || data.url || data.uri || "").trim();

if (!finalUrl) throw new Error("Done, but server returned no video URL");
return { url: finalUrl };
}
}

throw new Error("Timed out waiting for the video to finish");
}

// HEAD check to confirm the URL is actually a video file.
// If the server is returning index.html, content-type will be text/html.
async function verifyVideoUrl(url) {
try {
const res = await fetch(url, { method: "HEAD" });
const ct = (res.headers.get("content-type") || "").toLowerCase();
console.log("[T2V] HEAD", url, res.status, ct);

// If your server doesn't support HEAD for the proxy route, this may 405.
// We'll treat 405 as "unknown but try anyway".
if (res.status === 405) return { ok: true, note: "HEAD not allowed; trying video load anyway." };

if (!res.ok) return { ok: false, reason: `URL returned ${res.status}` };

if (ct.includes("text/html")) {
return {
ok: false,
reason:
"URL is returning HTML (your home page), not a video file. This means the mp4 path is wrong or file isn't in /public.",
};
}

// best case: video/*
if (ct.includes("video/")) return { ok: true };

// Some servers return application/octet-stream for mp4; accept that too.
if (ct.includes("application/octet-stream")) return { ok: true };

return { ok: true, note: `Unexpected content-type (${ct}), trying anyway.` };
} catch (e) {
return { ok: true, note: "HEAD check failed; trying video load anyway." };
}
}

if (t2vPrompt && t2vBtn && t2vVideo) {
let lastObjectUrl = null;

function clearT2vUI() {
if (lastObjectUrl) {
URL.revokeObjectURL(lastObjectUrl);
lastObjectUrl = null;
}

try { t2vVideo.pause?.(); } catch {}
t2vVideo.removeAttribute("src");
t2vVideo.load?.();
t2vVideo.style.display = "none";

hideT2vButtons();
setT2vStatus("Your generated video will appear here.");
}

async function setVideoSrc(url) {
// add cache-buster so it reloads
const final = url.includes("?") ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;

t2vVideo.style.display = "block";
t2vVideo.controls = true;
t2vVideo.playsInline = true;

t2vVideo.onerror = () => {
console.error("[T2V] <video> failed to load:", final, t2vVideo.error);
setT2vStatus("❌ Browser could not load the video. Open Network tab and click the video request.");
};

t2vVideo.onloadeddata = () => {
console.log("[T2V] Video loaded OK");
setT2vStatus("✅ Video ready");
};

console.log("[T2V] Setting video src:", final);
t2vVideo.src = final;
t2vVideo.load?.();

// autoplay attempt (might be blocked, that’s fine)
try {
await t2vVideo.play?.();
} catch (e) {
console.warn("[T2V] Autoplay blocked (normal). Click play.", e);
}
}

async function generateT2v(prompt) {
t2vBtn.disabled = true;
clearT2vUI();

// Your UI now uses: duration + aspect (not t2vDuration/t2vAspect)
const durationSeconds = Number(t2vDuration?.value || 8);

// Your dropdown has values: portrait / landscape (etc) — but backend expects "9:16" etc.
// We’ll translate safely:
const aspectValue = String(t2vAspect?.value || "portrait");
const aspectRatio =
aspectValue === "portrait" ? "9:16" :
aspectValue === "landscape" ? "16:9" :
aspectValue === "square" ? "1:1" :
aspectValue; // fallback

try {
setT2vStatus("Starting video job…");
const opName = await startTextToVideoJob(prompt, { durationSeconds, aspectRatio });

const result = await pollTextToVideo(opName);

// Use returned URL
const url = result.url;
showT2vButtons(url);

// VERIFY it’s really a video
const check = await verifyVideoUrl(url);
if (!check.ok) {
console.error("[T2V] verify failed:", check.reason, url);
setT2vStatus(`❌ ${check.reason}`);
return;
} else if (check.note) {
console.log("[T2V] verify note:", check.note);
}

await setVideoSrc(url);
} catch (err) {
console.error(err);
setT2vStatus(`❌ ${err.message || err}`);
hideT2vButtons();
} finally {
t2vBtn.disabled = false;
}
}

t2vBtn.addEventListener("click", () => {
const prompt = (t2vPrompt.value || "").trim();
if (!prompt) return setT2vStatus("Please enter a prompt.");
generateT2v(prompt);
});

if (deleteBtn) deleteBtn.addEventListener("click", clearT2vUI);
} else {
console.log("[T2V] create-video.js: required elements not found on this page.");
}
