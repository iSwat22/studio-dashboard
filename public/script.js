/* =========================
Quanna Leap v1
HOME:
- Mode bubbles (Text→Image, Text→Video, Image→Video, Text→Voice)
- Theme cards + Style cards (optional)
- Clicking a MODE goes straight to its create page
- Saves selections in localStorage

CREATE PAGES:
- Loads saved selection + auto-fills promptBox (if present)
========================= */

// =========================
// USER / PLAN (placeholders)
// =========================
const USER = {
name: "KC",
role: "Admin",
plan: "Platinum",
stars: Infinity,
isAdmin: true,
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

// =========================
// DATA (images must be in /public)
// =========================
const MODES = [
{ id: "text_image", label: "Text → Image", page: "create-image.html" },
{ id: "text_video", label: "Text → Video", page: "create-video.html" },
{ id: "image_video", label: "Image → Video", page: "create-image-video.html" },
{ id: "text_voice", label: "Text → Voice", page: "create-voice.html" },
];

// NOTE: image filenames here must match exactly what you uploaded (JPEGs in /public)
const THEMES = [
{ id: "Kids_Story", title: "Kids Story", sub: "Kid-friendly adventure", image: "Kids_Story.jpeg",
promptSeed: "Create a kid-friendly story with warm, hopeful tone. Simple dialogue, clear action, meaningful lesson." },
{ id: "Biblical_Epic", title: "Biblical Epic", sub: "Faith + cinematic scale", image: "Biblical_Epic.jpeg",
promptSeed: "Create a respectful biblical-inspired epic with emotional moments, dramatic stakes, uplifting resolution." },
{ id: "Neon_City_Heist", title: "Neon City Heist", sub: "Futuristic heist vibe", image: "Neon_City_Heist.jpeg",
promptSeed: "Create a neon cyber-city heist: fast pacing, clever plan, twists, stylish futuristic setting." },
{ id: "Future_Ops", title: "Future Ops", sub: "Tactical sci-fi action", image: "Future_Ops.jpeg",
promptSeed: "Create a futuristic special-ops mission: tactical planning, high-tech gear, intense action, team dialogue." },
];

const STYLES = [
{ id: "Pixar_Style", title: "Pixar Style", sub: "3D, emotional, cinematic", image: "Pixar_Style.jpeg",
styleSeed: "Style: high-quality 3D animated family-film look, expressive characters, soft cinematic lighting, emotional beats." },
{ id: "Disney_Style", title: "Disney Style", sub: "Magical, bright, classic", image: "Disney_Style.jpeg",
styleSeed: "Style: magical, bright, family-friendly animated feel, charming environments, uplifting tone." },
{ id: "Anime_Fantasy", title: "Anime Fantasy", sub: "Dramatic + stylized", image: "Anime_Fantasy.jpeg",
styleSeed: "Style: anime-inspired cinematic look, dynamic camera moves, expressive eyes, dramatic lighting, atmospheric scenes." },
{ id: "Realistic_Cinema", title: "Realistic Cinema", sub: "Live-action vibe", image: "Realistic_Cinema.jpeg",
styleSeed: "Style: realistic cinematic live-action look, natural textures, film lighting, shallow depth of field." },
];

// =========================
// STATE
// =========================
let selectedMode = null;
let selectedTheme = null;
let selectedStyle = null;

// =========================
// DOM HELPERS
// =========================
function el(tag, className, attrs = {}) {
const e = document.createElement(tag);
if (className) e.className = className;
Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
return e;
}

// =========================
// BUILD UI (HOME)
// =========================
function buildModeBubble(m) {
const b = el("div", "modeCard", { "data-id": m.id });
b.textContent = m.label;

b.addEventListener("click", () => {
// select mode (for highlight)
selectedMode = m;
markSelectedMode(m.id);

// save selections (theme/style optional)
persistSelection();

// go straight to correct create page
window.location.href = m.page;
});

return b;
}

function markSelectedMode(modeId) {
const rail = document.getElementById("modeRail");
if (!rail) return;
[...rail.querySelectorAll(".modeCard")].forEach((node) => {
node.classList.toggle("selected", node.getAttribute("data-id") === modeId);
});
}

function buildCard(item, type) {
const card = el("div", "card", { "data-id": item.id, "data-type": type });

// IMPORTANT: images load from /public because src is just the filename
const img = el("img", "cardImg", { alt: item.title, src: item.image });

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
persistSelection();
updateReady();
});

return card;
}

function markSelected(railId, selectedId) {
const rail = document.getElementById(railId);
if (!rail) return;
[...rail.querySelectorAll(".card")].forEach((c) => {
c.classList.toggle("selected", c.getAttribute("data-id") === selectedId);
});
}

function persistSelection() {
const payload = {
modeId: selectedMode?.id || null,
modeLabel: selectedMode?.label || null,
modePage: selectedMode?.page || null,

themeId: selectedTheme?.id || null,
themeTitle: selectedTheme?.title || null,
themePromptSeed: selectedTheme?.promptSeed || null,

styleId: selectedStyle?.id || null,
styleTitle: selectedStyle?.title || null,
styleSeed: selectedStyle?.styleSeed || null,

prompt: buildFinalPrompt(),
};

localStorage.setItem("ql_selection", JSON.stringify(payload));
}

function updateReady() {
const line = document.getElementById("readySub");
const btn = document.getElementById("goCreateBtn");

// Your rule: “choose 1 or more”
// Since mode is what determines the create page now, we allow:
// - Mode alone ✅
// - Theme alone ❌ (needs a mode to know where to go)
// - Style alone ❌ (needs a mode)
const ok = !!selectedMode;

if (line) {
if (!ok) line.textContent = "Choose 1 Mode (you can also pick a Theme/Style).";
else {
const t = selectedTheme ? selectedTheme.title : "—";
const s = selectedStyle ? selectedStyle.title : "—";
line.textContent = `Mode: ${selectedMode.label} • Theme: ${t} • Style: ${s}`;
}
}
if (btn) btn.disabled = !ok;
}

function buildFinalPrompt() {
const theme = selectedTheme?.promptSeed ? selectedTheme.promptSeed : "";
const style = selectedStyle?.styleSeed ? selectedStyle.styleSeed : "";

return `
${theme}

${style}

Rules:
- Strong dialogue and clear scene progression
- Include camera + movement suggestions (especially for image-to-video)

Output:
- Title
- Short logline
- Full prompt ready to paste
`.trim();
}

function goToCreateFromButton() {
if (!selectedMode) return;
persistSelection();
window.location.href = selectedMode.page;
}

function initHome() {
applyUserUI();

const modeRail = document.getElementById("modeRail");
const themeRail = document.getElementById("themeRail");
const styleRail = document.getElementById("styleRail");
const goBtn = document.getElementById("goCreateBtn");

// build mode bubbles if the rail exists
if (modeRail) {
modeRail.innerHTML = "";
MODES.forEach((m) => modeRail.appendChild(buildModeBubble(m)));
}

if (themeRail) {
themeRail.innerHTML = "";
THEMES.forEach((t) => themeRail.appendChild(buildCard(t, "theme")));
}

if (styleRail) {
styleRail.innerHTML = "";
STYLES.forEach((s) => styleRail.appendChild(buildCard(s, "style")));
}

if (goBtn) goBtn.addEventListener("click", goToCreateFromButton);

updateReady();
}

// =========================
// CREATE PAGES (shared)
// =========================
function initCreateAny() {
applyUserUI();

const selectionLine = document.getElementById("selectionLine");
const promptBox = document.getElementById("promptBox");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");

const raw = localStorage.getItem("ql_selection");
if (!raw) {
if (selectionLine) selectionLine.textContent = "No selection found. Go back to Home.";
return;
}

const data = JSON.parse(raw);

if (selectionLine) {
const mode = data.modeLabel ? data.modeLabel : "—";
const theme = data.themeTitle ? data.themeTitle : "—";
const style = data.styleTitle ? data.styleTitle : "—";
selectionLine.textContent = `Mode: ${mode} • Theme: ${theme} • Style: ${style}`;
}

if (promptBox) promptBox.value = data.prompt || "";

if (copyBtn && promptBox) {
copyBtn.addEventListener("click", async () => {
await navigator.clipboard.writeText(promptBox.value);
copyBtn.textContent = "Copied!";
setTimeout(() => (copyBtn.textContent = "Copy"), 900);
});
}

if (clearBtn && promptBox) {
clearBtn.addEventListener("click", () => (promptBox.value = ""));
}
}

// =========================
// BOOT
// =========================
document.addEventListener("DOMContentLoaded", () => {
const isHome = document.getElementById("modeRail") || document.getElementById("themeRail");
const isCreate = document.getElementById("promptBox");

if (isHome) initHome();
if (isCreate) initCreateAny();
});






