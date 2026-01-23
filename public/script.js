/* ======================================================
Quanne Leap — script.js (SAFE)
- Home page: mode bubbles + theme/style cards + Go Create
- Create page: fills promptBox from localStorage
- Text→Video page: works ONLY when those IDs exist
====================================================== */

/* ---------- USER UI (top-right pills) ---------- */
const USER = {
name: "KC",
role: "Admin",
plan: "Platinum",
stars: "∞",
isAdmin: true
};

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

/* ---------- IMAGE PATH ----------
Put card JPGs in: /public/quannaleap_cards/
Then set IMAGE_BASE to "/quannaleap_cards/"
--------------------------------- */
const IMAGE_BASE = "/"; // <-- THIS is why your images disappeared when it was "/"

/* ---------- CARDS DATA ---------- */
const THEMES = [
{ id: "Kids_Story", title: "Kids Story", sub: "Kid-friendly adventure", image: "Kids_Story.jpeg",
promptSeed: `Create a kid-friendly story with warm, hopeful tone. Simple dialogue, clear action, meaningful lesson.` },
{ id: "Biblical_Epic", title: "Biblical Epic", sub: "Faith + cinematic scale", image: "Biblical_Epic.jpeg",
promptSeed: `Create a respectful biblical-inspired epic with emotional moments, dramatic stakes, uplifting resolution.` },
{ id: "Neon_City_Heist", title: "Neon City Heist", sub: "Neon crime story (original)", image: "Neon_City_Heist.jpeg",
promptSeed: `Create a neon cyber-city heist story: fast pacing, clever plan, twists, stylish futuristic setting.` },
{ id: "Future_Ops", title: "Future Ops", sub: "Tactical sci-fi action", image: "Future_Ops.jpeg",
promptSeed: `Create a futuristic special-ops mission story: tactical planning, high-tech gear, intense action, team dialogue.` }
];

const STYLES = [
{ id: "Pixar_Style", title: "Pixar Style", sub: "3D, emotional, cinematic", image: "Pixar_Style.jpeg",
styleSeed: `Style: high-quality 3D animated family film look, expressive characters, soft cinematic lighting, emotional beats.` },
{ id: "Disney_Style", title: "Disney Style", sub: "Magical, bright, classic", image: "Disney_Style.jpeg",
styleSeed: `Style: magical, bright, family-friendly animated feel, charming environments, uplifting tone.` },
{ id: "Anime_Fantasy", title: "Anime Fantasy", sub: "Dramatic + stylized", image: "Anime_Fantasy.jpeg",
styleSeed: `Style: anime-inspired cinematic look, dynamic camera moves, expressive eyes, dramatic lighting and atmosphere.` },
{ id: "Realistic_Cinema", title: "Realistic Cinema", sub: "Live-action vibe", image: "Realistic_Cinema.jpeg",
styleSeed: `Style: realistic cinematic live-action look, natural textures, film lighting, shallow depth of field.` }
];

/* ---------- STATE (cards only) ---------- */
let selectedTheme = null;
let selectedStyle = null;

/* ---------- DOM helper ---------- */
function el(tag, className, attrs = {}) {
const e = document.createElement(tag);
if (className) e.className = className;
for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
return e;
}

/* ---------- Build a card ---------- */
function buildCard(item, type) {
const card = el("div", "card", { "data-id": item.id, "data-type": type });

const img = el("img", "cardImg", {
alt: item.title,
src: IMAGE_BASE + item.image
});

img.addEventListener("error", () => {
console.warn(`Missing image: ${IMAGE_BASE + item.image}`);
});

const body = el("div", "cardBody");
const title = el("div", "cardTitle");
title.textContent = item.title;

const sub = el("div", "cardSub");
sub.textContent = item.sub || "";

body.appendChild(title);
body.appendChild(sub);

card.appendChild(img);
card.appendChild(body);

card.addEventListener("click", () => {
if (type === "theme") {
selectedTheme = item;
markSelected("themeRail", item.id);
} else {
selectedStyle = item;
markSelected("styleRail", item.id);
}
updateReady();
});

return card;
}

function markSelected(railId, selectedId) {
const rail = document.getElementById(railId);
if (!rail) return;
rail.querySelectorAll(".card").forEach(c => {
c.classList.toggle("selected", c.getAttribute("data-id") === selectedId);
});
}

/* ---------- READY BOX LOGIC (cards only) ---------- */
function updateReady() {
const btn = document.getElementById("goCreateBtn");
const line = document.getElementById("readySub");
const hasAny = !!(selectedTheme || selectedStyle);

if (line) {
if (!hasAny) {
line.textContent = "Choose at least one option to continue.";
} else {
const parts = [];
if (selectedTheme) parts.push(`Theme: ${selectedTheme.title}`);
if (selectedStyle) parts.push(`Style: ${selectedStyle.title}`);
line.textContent = `Selected • ${parts.join(" + ")}`;
}
}

if (btn) btn.disabled = !hasAny;
}

function buildFinalPrompt() {
const theme = selectedTheme ? selectedTheme.promptSeed : "";
const style = selectedStyle ? selectedStyle.styleSeed : "";

return `
${theme}

${style}

Rules:
- Strong dialogue and clear scene progression
- Include camera + motion suggestions for video
- Output must be ready to paste

Output:
- Title
- Short logline
- Full prompt
`.trim();
}

function goToCreate() {
const payload = {
themeId: selectedTheme?.id || null,
styleId: selectedStyle?.id || null,
themeTitle: selectedTheme?.title || null,
styleTitle: selectedStyle?.title || null,
prompt: buildFinalPrompt()
};

localStorage.setItem("ql_selection", JSON.stringify(payload));
window.location.href = "create.html";
}

/* ---------- MODE BUBBLES (Home buttons) ---------- */
function initModeBubbles() {
const modeRail = document.getElementById("modeRail");
if (!modeRail) return;

modeRail.querySelectorAll(".modeCard").forEach(bubble => {
bubble.addEventListener("click", () => {
const target = bubble.getAttribute("data-target");
if (!target) return;
window.location.href = target;
});
});
}

/* ---------- HOME INIT ---------- */
function initHome() {
const themeRail = document.getElementById("themeRail");
const styleRail = document.getElementById("styleRail");
const goBtn = document.getElementById("goCreateBtn");

if (!themeRail || !styleRail) return;

themeRail.innerHTML = "";
styleRail.innerHTML = "";

THEMES.forEach(t => themeRail.appendChild(buildCard(t, "theme")));
STYLES.forEach(s => styleRail.appendChild(buildCard(s, "style")));

if (goBtn) goBtn.addEventListener("click", goToCreate);

applyUserUI();
initModeBubbles();
updateReady();
}

/* ---------- CREATE PAGE INIT (fills prompt) ---------- */
function initCreate() {
applyUserUI();

const selectionLine = document.getElementById("selectionLine");
const promptBox = document.getElementById("promptBox");

const raw = localStorage.getItem("ql_selection");
if (!raw) {
if (selectionLine) selectionLine.textContent = "No selection found. Go back to Home.";
return;
}

const data = JSON.parse(raw);

if (selectionLine) {
const parts = [];
if (data.themeTitle) parts.push(`Theme: ${data.themeTitle}`);
if (data.styleTitle) parts.push(`Style: ${data.styleTitle}`);
selectionLine.textContent = parts.length ? parts.join(" • ") : "Selection loaded.";
}

if (promptBox) promptBox.value = data.prompt || "";
}

/* ---------- TEXT → VIDEO (ONLY if IDs exist on this page) ---------- */
(function initTextToVideo() {
const pickFirst = (...ids) => ids.map(id => document.getElementById(id)).find(Boolean);

const t2vPrompt = pickFirst("t2vPrompt", "prompt");
const t2vBtn = pickFirst("t2vBtn", "generateBtn");
const t2vStatus = pickFirst("t2vStatus", "previewEmpty", "statusText");
const t2vVideo = pickFirst("t2vVideo", "previewVideo");

const t2vDuration = document.getElementById("t2vDuration") || document.getElementById("duration");
const t2vAspect = document.getElementById("t2vAspect") || document.getElementById("aspect");

function setStatus(msg) {
if (t2vStatus) t2vStatus.textContent = msg;
console.log("[T2V]", msg);
}

async function startJob(prompt, options) {
const res = await fetch("/api/text-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
prompt,
durationSeconds: options.durationSeconds,
aspectRatio: options.aspectRatio
})
});
const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) throw new Error(data.error || "Failed to start video job");
if (!data.operationName) throw new Error("Server did not return operationName");
return data.operationName;
}

async function poll(operationName) {
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
for (let i = 1; i <= 100; i++) {
setStatus(`Generating video… (${i}/100)`);
await sleep(3000);

const res = await fetch("/api/text-to-video/status", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ operationName })
});
const data = await res.json().catch(() => ({}));
if (!res.ok || !data.ok) throw new Error(data.error || "Status check failed");

if (data.done) {
// Accept videoUrl OR proxyUrl (if your backend returns it)
if (data.proxyUrl) return data.proxyUrl;
if (data.videoUrl) return data.videoUrl;
throw new Error("Video finished, but no URL returned");
}
}
throw new Error("Timed out waiting for the video");
}

async function generate() {
const prompt = (t2vPrompt?.value || "").trim();
if (!prompt) return setStatus("Please enter a prompt.");

const durationSeconds = Number(t2vDuration?.value || 8);
const aspectRatio = String(t2vAspect?.value || "16:9");

if (!t2vBtn || !t2vVideo) return;

t2vBtn.disabled = true;
try {
setStatus("Starting video job…");
const op = await startJob(prompt, { durationSeconds, aspectRatio });
const url = await poll(op);

t2vVideo.src = url;
t2vVideo.style.display = "block";
t2vVideo.load();
t2vVideo.play().catch(() => {});
setStatus("✅ Video ready");
} catch (e) {
console.error(e);
setStatus(`❌ ${e.message || e}`);
} finally {
t2vBtn.disabled = false;
}
}

if (t2vPrompt && t2vBtn && t2vVideo) {
t2vBtn.addEventListener("click", generate);
}
})();

/* ---------- BOOT ---------- */
document.addEventListener("DOMContentLoaded", () => {
const isHome = document.getElementById("themeRail") && document.getElementById("styleRail");
const isCreate = document.getElementById("promptBox");

if (isHome) initHome();
if (isCreate) initCreate();
});

