/* create-video.js */
console.log("create-video.js loaded");

// ======================================================
// TEXT -> VIDEO (create-video.html)
// - Starts job: POST /api/text-to-video
// - Polls: POST /api/text-to-video/status
// - Loads <video> reliably, probes URL, logs useful errors
// ======================================================

const pickFirst = (...ids) =>
ids.map((id) => document.getElementById(id)).find(Boolean);

// Try multiple possible IDs so this works across your pages
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
if (deleteBtn) deleteBtn.style.display = "none"; // ✅ FIX (was hiding downloadBtn twice)
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

function extractVideoUrl(data) {
if (!data) return null;
if (typeof data === "string") return data;

return (
data.videoUrl ||
data.url ||
data.uri ||
data?.result?.videoUrl ||
data?.result?.url ||
data?.result?.uri ||
data?.data?.videoUrl ||
data?.data?.url ||
null
);
}

function normalizeVideoUrl(url) {
if (!url || typeof url !== "string") return url;

// If backend returns the full same-host URL, keep it.
// If it returns a path like "/assets/test.mp4", keep it.
// If it returns "assets/test.mp4", fix it to "/assets/test.mp4".
if (url.startsWith("assets/")) return "/" + url;

return url;
}

// Probe the URL to catch the common failure:
// the “mp4 url” is actually a 404 page or HTML.
async function probeUrl(url) {
// HEAD is ideal, but some hosts block HEAD.
// So try HEAD then fallback to GET with range.
const tryFetch = async (method, extraHeaders = {}) => {
const res = await fetch(url, {
method,
headers: {
...extraHeaders,
},
// If it’s cross-origin without CORS, this may fail.
// That’s OK—we’ll detect and report it.
});
return res;
};

try {
let res;
try {
res = await tryFetch("HEAD");
} catch {
res = await tryFetch("GET", { Range: "bytes=0-1023" });
}

const ct = res.headers.get("content-type") || "";
return {
ok: res.ok,
status: res.status,
contentType: ct,
};
} catch (e) {
return {
ok: false,
status: 0,
contentType: "",
error: String(e),
};
}
}

async function startTextToVideoJob(prompt, options) {
const payload = {
prompt,
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
console.log("pollTextToVideo DONE:", res.status, data);

const videoUrl = extractVideoUrl(data);
if (videoUrl) return { videoUrl: normalizeVideoUrl(videoUrl) };

// Support base64 fallback
if (data.base64) {
return { base64: data.base64, mimeType: data.mimeType || "video/mp4" };
}

throw new Error("Video finished, but no videoUrl/base64 returned");
}
}

throw new Error("Timed out waiting for the video to finish");
}

// Only wire Text→Video if the page has the elements
if (t2vPrompt && t2vBtn && t2vVideo) {
let lastObjectUrl = null;

function clearT2vUI() {
if (lastObjectUrl) {
URL.revokeObjectURL(lastObjectUrl);
lastObjectUrl = null;
}

try {
t2vVideo.pause?.();
} catch {}

t2vVideo.removeAttribute("src");
t2vVideo.load?.();
t2vVideo.style.display = "none";

hideT2vButtons();
setT2vStatus("Your generated video will appear here.");
}

async function setVideoSrc(url) {
t2vVideo.style.display = "block";
t2vVideo.controls = true;

// Clear first so browser reloads even if URL repeats
t2vVideo.removeAttribute("src");
t2vVideo.load?.();

console.log("[T2V] Final video URL:", url);

// Probe first so we can warn you if it's not an mp4 or it's 404/403
setT2vStatus("Loading video…");
const probe = await probeUrl(url);
console.log("[T2V] Probe result:", probe);

// If probe says 403/404 or not ok, tell you up-front
if (!probe.ok) {
setT2vStatus(
`❌ Video URL not reachable (status ${probe.status || "blocked"}). Open the URL in a new tab or check Network tab.`
);
// still try to set src — sometimes probe fails due to CORS but <video> works
} else {
// If content-type looks wrong (HTML), that usually means it’s not a real mp4
const ct = (probe.contentType || "").toLowerCase();
if (ct && !ct.includes("video") && !ct.includes("mp4") && !ct.includes("octet-stream")) {
setT2vStatus(
`❌ URL responded, but content-type is "${probe.contentType}". That usually means it's not an mp4 (often an error page).`
);
}
}

// Hook video events for real browser feedback
t2vVideo.onerror = () => {
console.error("[T2V] <video> failed to load:", url, t2vVideo.error);
setT2vStatus(
"❌ Browser couldn’t play this video. Check Network tab for 403/404 or wrong content-type."
);
};

t2vVideo.onloadeddata = () => {
console.log("[T2V] Video loaded OK");
setT2vStatus("✅ Video ready (press play if it doesn’t auto-start).");
};

t2vVideo.oncanplay = () => {
console.log("[T2V] canplay fired");
};

// Load it
t2vVideo.src = url;
t2vVideo.load?.();

// Try autoplay (often blocked). Fine.
try {
await t2vVideo.play?.();
} catch (e) {
console.warn("[T2V] Autoplay blocked (normal). Click play:", e);
}

// Fallback: if same-origin/cors allows, fetch as blob and play that
// (This helps when the server requires headers / redirect weirdness.)
// Only try if the video still isn't usable after a moment.
setTimeout(async () => {
// If the browser already loaded metadata, don’t do blob fallback
if (t2vVideo.readyState >= 2) return;

try {
setT2vStatus("Trying fallback load…");
const r = await fetch(url);
if (!r.ok) throw new Error(`fetch failed ${r.status}`);
const blob = await r.blob();
const objUrl = URL.createObjectURL(blob);

if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
lastObjectUrl = objUrl;

console.log("[T2V] Using blob fallback URL");
t2vVideo.src = objUrl;
t2vVideo.load?.();
setT2vStatus("✅ Video ready (fallback).");
showT2vButtons(objUrl);
} catch (e) {
console.warn("[T2V] Fallback failed (likely CORS):", e);
// Keep existing status; user can inspect Network tab
}
}, 1500);
}

async function generateT2v(prompt) {
t2vBtn.disabled = true;
clearT2vUI();

const durationSeconds = Number(t2vDuration?.value || 8);
const aspectRatio = String(t2vAspect?.value || "16:9");

try {
setT2vStatus("Starting video job…");
const opName = await startTextToVideoJob(prompt, { durationSeconds, aspectRatio });

const result = await pollTextToVideo(opName);

if (result.videoUrl) {
showT2vButtons(result.videoUrl);
await setVideoSrc(result.videoUrl);
return;
}

if (result.base64) {
const byteChars = atob(result.base64);
const byteNumbers = new Array(byteChars.length);
for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);

const blob = new Blob([new Uint8Array(byteNumbers)], {
type: result.mimeType || "video/mp4",
});
lastObjectUrl = URL.createObjectURL(blob);

showT2vButtons(lastObjectUrl);
await setVideoSrc(lastObjectUrl);
return;
}

throw new Error("Unknown video response format");
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
console.log("[T2V] Skipped wiring: page missing required elements.");
}
