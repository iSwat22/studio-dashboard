/* create-video.js */
console.log("create-video.js loaded");

/**
* This file ONLY handles the Text→Video page.
* Goal: fix 404 by trying multiple possible API routes, without guessing your backend.
* Once we confirm the correct endpoint, we can lock it to one route.
*/

const $ = (id) => document.getElementById(id);

const promptEl = $("prompt");
const clearBtn = $("clearBtn");
const pasteBtn = $("pasteBtn");

const aspectEl = $("aspect");
const durationEl = $("duration");
const qualityEl = $("quality");

const generateBtn = $("generateBtn");
const downloadBtn = $("downloadBtn");

const previewVideo = $("previewVideo");
const previewEmpty = $("previewEmpty");

// Optional UI parts (if present)
const nextBtn = $("nextBtn");
const clipsStrip = $("clipsStrip");

// ---- Helpers
function showStatus(msg) {
if (previewEmpty) {
previewEmpty.style.display = "block";
previewEmpty.textContent = msg;
}
if (previewVideo) previewVideo.style.display = "none";
if (downloadBtn) downloadBtn.style.display = "none";
}

function showVideo(url) {
if (!previewVideo) return;

previewVideo.src = url;
previewVideo.style.display = "block";
if (previewEmpty) previewEmpty.style.display = "none";

if (downloadBtn) {
downloadBtn.href = url;
downloadBtn.style.display = "inline-flex";
}
}

async function safeJSON(res) {
const text = await res.text();
try {
return JSON.parse(text);
} catch {
return { raw: text };
}
}

/**
* Some backends return:
* - { videoUrl: "..." }
* - { url: "..." }
* - { output: "..." }
* - { data: { videoUrl: "..." } }
* - { result: { uri: "..." } }
* - or even plain text url
*/
function extractVideoUrl(data) {
if (!data) return null;

// If backend returned plain text in JSON wrapper
if (typeof data === "string") return data;

const candidates = [
data.videoUrl,
data.url,
data.output,
data.uri,
data?.data?.videoUrl,
data?.data?.url,
data?.result?.videoUrl,
data?.result?.url,
data?.result?.uri,
data?.video?.url,
data?.video?.uri,
];

for (const c of candidates) {
if (typeof c === "string" && c.trim()) return c.trim();
}

// If backend returned { raw: "https://..." }
if (typeof data.raw === "string" && data.raw.includes("http")) {
return data.raw.trim();
}

return null;
}

/**
* Convert UI aspect selection to what your backend might expect.
* - your UI: portrait / landscape / square
* - backend might expect: "9:16", "16:9", "1:1"
*/
function mapAspect(value) {
if (value === "portrait") return "9:16";
if (value === "landscape") return "16:9";
if (value === "square") return "1:1";
return value; // fallback
}

/**
* IMPORTANT:
* Your console proves /api/text-to-video is 404.
* So we try a shortlist of common routes and use the first that works.
*/
const ENDPOINTS_TO_TRY = [
"/api/text-to-video",
"/api/text2video",
"/api/t2v",
"/api/veo",
"/api/video",
"/api/generate-video",
"/api/generateVideo",
];

async function postJSON(url, body) {
const res = await fetch(url, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(body),
});

// If route doesn't exist, res.status will often be 404
const data = await safeJSON(res);
return { res, data };
}

async function generateVideo() {
const prompt = (promptEl?.value || "").trim();
if (!prompt) {
alert("Enter a prompt first.");
return;
}

const aspect = mapAspect(aspectEl?.value || "9:16");
const duration = Number(durationEl?.value || 8);
const quality = (qualityEl?.value || "high").toLowerCase();

// Payload: include multiple field names so your backend can match one
const payload = {
prompt,
text: prompt,
aspect,
aspectRatio: aspect,
format: aspect,
duration,
seconds: duration,
length: duration,
quality,
};

generateBtn.disabled = true;
showStatus("Generating video…");

let lastErr = null;

for (const endpoint of ENDPOINTS_TO_TRY) {
try {
console.log("Trying endpoint:", endpoint, payload);

const { res, data } = await postJSON(endpoint, payload);

// If 404, try next endpoint
if (res.status === 404) {
console.warn("404 on", endpoint);
continue;
}

// If not OK, show message + stop (this means route exists but error inside)
if (!res.ok) {
console.error("API error on", endpoint, res.status, data);
lastErr = { endpoint, status: res.status, data };
break;
}

// Route worked. Extract video URL.
const url = extractVideoUrl(data);

if (!url) {
console.error("No video URL returned from", endpoint, data);
lastErr = { endpoint, status: res.status, data };
break;
}

console.log("Video generated from:", endpoint, url);
showVideo(url);

// Optional: populate a clip slot in the UI (doesn't change layout)
if (clipsStrip) {
const firstClip = clipsStrip.querySelector(".clip-card");
if (firstClip) firstClip.classList.add("is-selected");
}

generateBtn.disabled = false;
return;
} catch (e) {
console.error("Request failed on", endpoint, e);
lastErr = { endpoint, error: String(e) };
}
}

generateBtn.disabled = false;

// If we reach here, nothing worked.
console.error("All endpoints failed.", lastErr);
alert("Generate video failed. Check Render logs / Console.");
showStatus("Generate video failed. Check Render logs / Console.");
}

// ---- Wire buttons
if (clearBtn) {
clearBtn.addEventListener("click", () => {
if (promptEl) promptEl.value = "";
});
}

if (pasteBtn) {
pasteBtn.addEventListener("click", async () => {
try {
const text = await navigator.clipboard.readText();
if (promptEl) promptEl.value = text || "";
} catch {
alert("Clipboard paste blocked. Use Ctrl+V in the prompt box.");
}
});
}

if (generateBtn) generateBtn.addEventListener("click", generateVideo);

// Optional: keep Next button UI-only for now
if (nextBtn) {
nextBtn.addEventListener("click", () => {
// UI-only. We'll wire animation flow later.
console.log("Next clicked (UI only for now).");
});
}

