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
return value;
}

/**
* IMPORTANT:
* 404 means: route does not exist on THIS server.
* So we try the same names with and without "/api" prefix.
*
* This is the most common mismatch:
* Frontend calls /api/xxx
* Backend is actually /xxx (or vice versa)
*/
const PATHS = [
"text-to-video",
"text2video",
"t2v",
"veo",
"video",
"generate-video",
"generateVideo",
];

// Build endpoints to try (both with and without /api)
const ENDPOINTS_TO_TRY = [
...PATHS.map((p) => `/api/${p}`),
...PATHS.map((p) => `/${p}`),
];

// If you ever host API on a different service, you can hardcode base here:
// const API_ORIGIN = "https://YOUR-API-SERVICE.onrender.com";
const API_ORIGIN = ""; // same-origin (current Render host)

async function postJSON(url, body) {
const res = await fetch(url, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(body),
});

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
const fullUrl = `${API_ORIGIN}${endpoint}`;

try {
console.log("Trying endpoint:", fullUrl, payload);

const { res, data } = await postJSON(fullUrl, payload);

// If 404, try next endpoint
if (res.status === 404) {
console.warn("404 on", fullUrl);
continue;
}

// If not OK, stop (route exists but backend threw an error)
if (!res.ok) {
console.error("API error on", fullUrl, res.status, data);
lastErr = { endpoint: fullUrl, status: res.status, data };
break;
}

// Route worked. Extract video URL.
const url = extractVideoUrl(data);

if (!url) {
console.error("No video URL returned from", fullUrl, data);
lastErr = { endpoint: fullUrl, status: res.status, data };
break;
}

console.log("Video generated from:", fullUrl, url);
showVideo(url);

// Optional: populate a clip slot in the UI (doesn't change layout)
if (clipsStrip) {
const firstClip = clipsStrip.querySelector(".clip-card");
if (firstClip) firstClip.classList.add("is-selected");
}

generateBtn.disabled = false;
return;
} catch (e) {
console.error("Request failed on", fullUrl, e);
lastErr = { endpoint: fullUrl, error: String(e) };
}
}

generateBtn.disabled = false;

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
console.log("Next clicked (UI only for now).");
});
}


