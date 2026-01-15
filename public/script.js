/* =========================
Quanna Leap v1 Home/Create/Result
- Home: Mode + Theme + Style
- Cards generated in JS
- Uses JPEGs in /public
========================= */

// ====== USER / PLAN (temporary placeholders) ======
const USER = {
name: "KC",
role: "Admin",
plan: "Platinum", // text should be Platinum
stars: 430,
isAdmin: true
};

// If your images are inside /public and index.html is also served from /public,
// keeping this as "./" is safest.
const IMG_BASE = "./";

// ====== MODES (choose one or more) ======
const MODES = [
{ id: "text_image", label: "Text → Image", kind: "image" },
{ id: "text_video", label: "Text → Video", kind: "video" },
{ id: "image_video", label: "Image → Video", kind: "video" },
{ id: "text_voice", label: "Text → Voice", kind: "audio" }
];

// ====== CARD DATA (JPEG FILES) ======
const THEMES = [
{
id: "Kids_Story",
title: "Kids Story",
sub: "Kid-friendly adventure",
image: "Kids_Story.jpeg",
promptSeed: `Create a kid-friendly story with warm, hopeful tone. Simple dialogue, clear action, and a meaningful lesson.`
},
{
id: "Biblical_Epic",
title: "Biblical Epic",
sub: "Faith + cinematic scale",
image: "Biblical_Epic.jpeg",
promptSeed: `Create a respectful biblical-inspired epic with emotional moments, dramatic stakes, and uplifting resolution.`
},
{
id: "Neon_City_Heist",
title: "Neon City Heist",
sub: "Neon crime story (original)",
image: "Neon_City_Heist.jpeg",
promptSeed: `Create a neon cyber-city heist story: fast pacing, clever plan, twists, and a stylish futuristic setting.`
},
{
id: "Future_Ops",
title: "Future Ops",
sub: "Tactical sci-fi action",
image: "Future_Ops.jpeg",
promptSeed: `Create a futuristic special-ops mission story: tactical planning, high-tech gear, intense action, and team dialogue.`
}
];

const STYLES = [
{
id: "Pixar_Style",
title: "Pixar Style",
sub: "3D, emotional, cinematic",
image: "Pixar_Style.jpeg",
styleSeed: `Style: high-quality 3D animated family film look, expressive characters, soft cinematic lighting, emotional beats.`
},
{
id: "Disney_Style",
title: "Disney Style",
sub: "magical, bright, classic",
image: "Disney_Style.jpeg",
styleSeed: `Style: magical, bright, family-friendly animated feel, charming environments, uplifting tone.`
},
{
id: "Anime_Fantasy",
title: "Anime Fantasy",
sub: "dramatic + stylized",
image: "Anime_Fantasy.jpeg",
styleSeed: `Style: anime-inspired cinematic look, dynamic camera moves, expressive eyes, dramatic lighting and atmosphere.`
},
{
id: "Realistic_Cinema",
title: "Realistic Cinema",
sub: "live-action vibe",
image: "Realistic_Cinema.jpeg",
styleSeed: `Style: realistic cinematic live-action look, natural textures, film lighting, shallow depth of field.`
}
];

// ====== SELECTION STATE ======
let selectedModes = new Set(); // one or more
let selectedTheme = null; // one
let selectedStyle = null; // one

// ====== UI APPLY ======
function applyUserUI() {
const planPill = document.getElementById("planPill");
const starsPill = document.getElementById("starsPill");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");
const avatarCircle = document.getElementById("avatarCircle");

if (planPill) {
planPill.textContent = USER.plan;
planPill.classList.toggle("isPlatinum", USER.plan.toLowerCase() === "platinum");
}
if (starsPill) starsPill.textContent = USER.isAdmin ? "★ ∞" : `★ ${USER.stars}`;
if (profileName) profileName.textContent = USER.name;
if (profileRole) profileRole.textContent = USER.role;
if (avatarCircle) avatarCircle.textContent = (USER.name || "U").trim().charAt(0).toUpperCase();
}

// ====== HELPERS ======
function el(tag, className, attrs = {}) {
const e = document.createElement(tag);
if (className) e.className = className;
Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
return e;
}

// ====== MODE UI ======
function buildModeButtons() {
const bar = document.getElementById("modeBar");
if (!bar) return;

bar.innerHTML = "";
MODES.forEach(m => {
const b = el("button", "modeBtn", { type: "button", "data-id": m.id });
b.textContent = m.label;

b.addEventListener("click", () => {
// toggle multi-select
if (selectedModes.has(m.id)) selectedModes.delete(m.id);
else selectedModes.add(m.id);

// highlight
[...bar.querySelectorAll(".modeBtn")].forEach(x => {
const on = selectedModes.has(x.getAttribute("data-id"));
x.classList.toggle("selected", on);
});

updateReady();

// OPTIONAL: quick jump if you want mode click to jump instantly
// If you want that behavior, uncomment the next 2 lines:
// if (selectedModes.size >= 1) goToCreate();
});

bar.appendChild(b);
});
}

function clearModes() {
selectedModes = new Set();
const bar = document.getElementById("modeBar");
if (bar) [...bar.querySelectorAll(".modeBtn")].forEach(x => x.classList.remove("selected"));
updateReady();
}

// ====== CARD UI ======
function buildCard(item, type) {
const card = el("div", "card", { "data-id": item.id, "data-type": type });

const img = el("img", "cardImg", {
alt: item.title,
src: IMG_BASE + item.image
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
[...rail.querySelectorAll(".card")].forEach(c => {
c.classList.toggle("selected", c.getAttribute("data-id") === selectedId);
});
}

function clearTheme() {
selectedTheme = null;
markSelected("themeRail", "__none__");
updateReady();
}

function clearStyle() {
selectedStyle = null;
markSelected("styleRail", "__none__");
updateReady();
}

// ====== READY STATE ======
function updateReady() {
const btn = document.getElementById("goCreateBtn");
const line = document.getElementById("readySub");

const ok = (selectedModes.size >= 1) && !!(selectedTheme && selectedStyle);

if (line) {
const modeNames = [...selectedModes].map(id => MODES.find(m => m.id === id)?.label).filter(Boolean);
if (!ok) {
line.textContent = "Choose 1 or more Mode + 1 Theme + 1 Style, then go create.";
if (modeNames.length) line.textContent = `Selected Modes: ${modeNames.join(", ")} — now pick 1 Theme + 1 Style.`;
} else {
line.textContent = `Selected: ${modeNames.join(", ")} + ${selectedTheme.title} + ${selectedStyle.title}`;
}
}

if (btn) btn.disabled = !ok;
}

function buildFinalPrompt() {
const theme = selectedTheme ? selectedTheme.promptSeed : "";
const style = selectedStyle ? selectedStyle.styleSeed : "";

return `
${theme}

${style}

Rules:
- No narrator unless requested
- Strong dialogue and clear scene progression
- Provide scene-by-scene beats (or one continuous script if requested)
- Include camera + movement suggestions for image-to-video

Output:
- Title
- Short logline
- Full prompt ready to paste
`.trim();
}

function goToCreate() {
const payload = {
modes: [...selectedModes],
themeId: selectedTheme?.id,
styleId: selectedStyle?.id,
modeLabels: [...selectedModes].map(id => MODES.find(m => m.id === id)?.label).filter(Boolean),
themeTitle: selectedTheme?.title,
styleTitle: selectedStyle?.title,
prompt: buildFinalPrompt()
};
localStorage.setItem("ql_selection", JSON.stringify(payload));
window.location.href = "create.html";
}

// ====== HOME INIT ======
function initHome() {
const themeRail = document.getElementById("themeRail");
const styleRail = document.getElementById("styleRail");
const goBtn = document.getElementById("goCreateBtn");

if (!themeRail || !styleRail) return;

buildModeButtons();

THEMES.forEach(t => themeRail.appendChild(buildCard(t, "theme")));
STYLES.forEach(s => styleRail.appendChild(buildCard(s, "style")));

if (goBtn) goBtn.addEventListener("click", goToCreate);

// Clear buttons
const clearModeBtn = document.getElementById("clearModeBtn");
const clearThemeBtn = document.getElementById("clearThemeBtn");
const clearStyleBtn = document.getElementById("clearStyleBtn");

if (clearModeBtn) clearModeBtn.addEventListener("click", clearModes);
if (clearThemeBtn) clearThemeBtn.addEventListener("click", clearTheme);
if (clearStyleBtn) clearStyleBtn.addEventListener("click", clearStyle);

applyUserUI();
updateReady();
}

// ====== CREATE INIT ======
function setDurationOptionsForModes(modes) {
const durationField = document.getElementById("durationField");
const durationSelect = document.getElementById("durationSelect");
if (!durationField || !durationSelect) return;

const hasVideo = modes.some(id => MODES.find(m => m.id === id)?.kind === "video");
const hasImageOnly = modes.length === 1 && MODES.find(m => m.id === modes[0])?.kind === "image";
const hasAudioOnly = modes.length === 1 && MODES.find(m => m.id === modes[0])?.kind === "audio";

// If purely image or purely audio, duration isn't needed (for now).
if (hasImageOnly || hasAudioOnly) {
durationField.style.display = "none";
return;
}

durationField.style.display = "";

// Video durations: 8s → 30 min
const opts = [
{ v: "8s", t: "8 sec" },
{ v: "12s", t: "12 sec" },
{ v: "20s", t: "20 sec" },
{ v: "30s", t: "30 sec" },
{ v: "1min", t: "1 min" },
{ v: "3min", t: "3 min" },
{ v: "5min", t: "5 min" },
{ v: "10min", t: "10 min" },
{ v: "15min", t: "15 min" },
{ v: "30min", t: "30 min" }
];

durationSelect.innerHTML = "";
opts.forEach(o => {
const op = document.createElement("option");
op.value = o.v;
op.textContent = o.t;
durationSelect.appendChild(op);
});
}

function renderModeChips(modes) {
const wrap = document.getElementById("modeChips");
if (!wrap) return;
wrap.innerHTML = "";

modes.forEach(id => {
const label = MODES.find(m => m.id === id)?.label || id;
const chip = el("span", "chip");
chip.textContent = label;
wrap.appendChild(chip);
});
}

function initCreate() {
applyUserUI();

const selectionLine = document.getElementById("selectionLine");
const promptBox = document.getElementById("promptBox");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const generateBtn = document.getElementById("generateBtn");

const raw = localStorage.getItem("ql_selection");
if (!raw) {
if (selectionLine) selectionLine.textContent = "No selection found. Go back to Home.";
return;
}

const data = JSON.parse(raw);

// Mode chips + selection line
const modes = Array.isArray(data.modes) ? data.modes : [];
renderModeChips(modes);

if (selectionLine) {
const modeText = (data.modeLabels && data.modeLabels.length) ? data.modeLabels.join(", ") : "—";
selectionLine.textContent =
`Mode(s): ${modeText} • Theme: ${data.themeTitle || "—"} • Style: ${data.styleTitle || "—"}`;
}

if (promptBox) promptBox.value = data.prompt || "";

setDurationOptionsForModes(modes);

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

// Generate -> result page
if (generateBtn) {
generateBtn.addEventListener("click", () => {
const ratio = document.getElementById("ratioSelect")?.value || "16:9";
const dur = document.getElementById("durationSelect")?.value || "";
const lang = document.getElementById("langSelect")?.value || "English";

const payload = {
...data,
settings: { ratio, duration: dur, language: lang },
prompt: (promptBox?.value || data.prompt || "").trim()
};

localStorage.setItem("ql_job", JSON.stringify(payload));
window.location.href = "result.html";
});
}
}

// ====== RESULT INIT ======
function initResult() {
applyUserUI();

const raw = localStorage.getItem("ql_job");
const out = document.getElementById("resultJson");
const title = document.getElementById("resultTitle");

if (!raw) {
if (title) title.textContent = "No generation job found.";
return;
}

const data = JSON.parse(raw);
if (title) title.textContent = "Generation (placeholder)";
if (out) out.textContent = JSON.stringify(data, null, 2);
}

// ====== BOOT ======
document.addEventListener("DOMContentLoaded", () => {
const isHome = document.getElementById("themeRail") && document.getElementById("styleRail");
const isCreate = document.getElementById("promptBox");
const isResult = document.getElementById("resultJson");

if (isHome) initHome();
if (isCreate) initCreate();
if (isResult) initResult();
});




