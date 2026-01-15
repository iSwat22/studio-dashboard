/* =========================
Quanna Leap v2
- Mode + Theme + Style
- Cards generated in JS
- Images are JPEG in /public
- Create adapts based Mode
========================= */

// ====== USER / PLAN (placeholder, later you’ll replace with Google login data) ======
const USER = {
name: "KC",
role: "Admin",
plan: "Platinum", // TEXT should say Platinum
stars: 430,
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

// ====== MODES ======
const MODES = [
{ id: "text_image", label: "Text → Image" },
{ id: "text_video", label: "Text → Video" },
{ id: "image_video", label: "Image → Video" },
{ id: "text_voice", label: "Text → Voice" }
];

// ====== CARD DATA (JPEG FILES IN /public) ======
// IMPORTANT: On Render, /public is usually served as site root,
// so /Kids_Story.jpeg is correct.
const THEMES = [
{
id: "Kids_Story",
title: "Kids Story",
sub: "Kid-friendly adventure",
image: "/Kids_Story.jpeg",
promptSeed: `Create a kid-friendly story with a warm, hopeful tone. Simple dialogue, clear action, and a meaningful lesson.`
},
{
id: "Biblical_Epic",
title: "Biblical Epic",
sub: "Faith + cinematic scale",
image: "/Biblical_Epic.jpeg",
promptSeed: `Create a respectful biblical-inspired epic with emotional moments, dramatic stakes, and uplifting resolution.`
},
{
id: "Neon_City_Heist",
title: "Neon City Heist",
sub: "Neon crime story (original)",
image: "/Neon_City_Heist.jpeg",
promptSeed: `Create a neon cyber-city heist story: fast pacing, clever plan, twists, and a stylish futuristic setting.`
},
{
id: "Future_Ops",
title: "Future Ops",
sub: "Tactical sci-fi action",
image: "/Future_Ops.jpeg",
promptSeed: `Create a futuristic special-ops mission story: tactical planning, high-tech gear, intense action, and team dialogue.`
}
];

const STYLES = [
{
id: "Pixar_Style",
title: "Pixar Style",
sub: "3D, emotional, cinematic",
image: "/Pixar_Style.jpeg",
styleSeed: `Style: high-quality 3D animated family film look, expressive characters, soft cinematic lighting, emotional beats.`
},
{
id: "Disney_Style",
title: "Disney Style",
sub: "magical, bright, classic",
image: "/Disney_Style.jpeg",
styleSeed: `Style: magical, bright, family-friendly animated feel, charming environments, uplifting tone.`
},
{
id: "Anime_Fantasy",
title: "Anime Fantasy",
sub: "dramatic + stylized",
image: "/Anime_Fantasy.jpeg",
styleSeed: `Style: anime-inspired cinematic look, dynamic camera moves, expressive eyes, dramatic lighting and atmosphere.`
},
{
id: "Realistic_Cinema",
title: "Realistic Cinema",
sub: "live-action vibe",
image: "/Realistic_Cinema.jpeg",
styleSeed: `Style: realistic cinematic live-action look, natural textures, film lighting, shallow depth of field.`
}
];

// ====== SELECTION STATE ======
let selectedMode = null;
let selectedTheme = null;
let selectedStyle = null;

// ====== HELPERS ======
function el(tag, className, attrs = {}) {
const e = document.createElement(tag);
if (className) e.className = className;
Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
return e;
}

function buildModeButtons() {
const wrap = document.getElementById("modePills");
if (!wrap) return;

MODES.forEach(m => {
const b = el("button", "modeBtn", { type: "button", "data-id": m.id });
b.textContent = m.label;

b.addEventListener("click", () => {
selectedMode = m;
[...wrap.querySelectorAll(".modeBtn")].forEach(x => x.classList.toggle("selected", x.dataset.id === m.id));
updateReady();
// Optional “fast flow”: if they already picked theme+style, go right to create:
// if (selectedTheme && selectedStyle) goToCreate();
});

wrap.appendChild(b);
});
}

function buildCard(item, type) {
const card = el("div", "card", { "data-id": item.id, "data-type": type });

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

function updateReady() {
const btn = document.getElementById("goCreateBtn");
const line = document.getElementById("readySub");

const ok = !!(selectedMode && selectedTheme && selectedStyle);

if (line) {
if (!ok) line.textContent = "Choose 1 Mode + 1 Theme + 1 Style, then go create.";
else line.textContent = `Selected: ${selectedMode.label} • ${selectedTheme.title} + ${selectedStyle.title}`;
}

if (btn) btn.disabled = !ok;
}

function buildFinalPrompt() {
const theme = selectedTheme ? selectedTheme.promptSeed : "";
const style = selectedStyle ? selectedStyle.styleSeed : "";
const mode = selectedMode ? selectedMode.label : "";

const modeRules = (() => {
if (!selectedMode) return "";
if (selectedMode.id === "text_image") {
return `Output as a single, highly detailed image prompt. Include composition, lighting, lens, mood, and key visual details.`;
}
if (selectedMode.id === "text_voice") {
return `Output as a voice script only. Include tone, pacing, pauses, and emotion cues.`;
}
if (selectedMode.id === "image_video") {
return `Assume a reference image is provided. Output motion/camera instructions to animate that image into a video.`;
}
return `Output as a video prompt. Include scene beats + camera movement suggestions.`;
})();

return `
Mode: ${mode}

${theme}

${style}

Rules:
- No narrator unless requested
- Strong dialogue and clear scene progression (if story/video)
- Include camera + movement suggestions for video modes

Mode Notes:
- ${modeRules}

Output:
- Title
- Short logline
- Full prompt ready to paste
`.trim();
}

function goToCreate() {
const payload = {
modeId: selectedMode?.id,
modeLabel: selectedMode?.label,
themeId: selectedTheme?.id,
styleId: selectedStyle?.id,
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

const clearThemeBtn = document.getElementById("clearThemeBtn");
const clearStyleBtn = document.getElementById("clearStyleBtn");
if (clearThemeBtn) clearThemeBtn.addEventListener("click", clearTheme);
if (clearStyleBtn) clearStyleBtn.addEventListener("click", clearStyle);

if (goBtn) goBtn.addEventListener("click", goToCreate);

applyUserUI();
updateReady();
}

// ====== CREATE INIT ======
function setDurationOptions(modeId) {
const durationSelect = document.getElementById("durationSelect");
const durationField = document.getElementById("durationField");
if (!durationSelect || !durationField) return;

durationSelect.innerHTML = "";

// Text->Image: hide duration
if (modeId === "text_image") {
durationField.style.display = "none";
return;
}

durationField.style.display = "block";

// Video modes get 8s -> 30min
if (modeId === "text_video" || modeId === "image_video") {
const opts = [
["8s", "8 seconds"],
["12s", "12 seconds"],
["15s", "15 seconds"],
["30s", "30 seconds"],
["45s", "45 seconds"],
["1min", "1 min"],
["3min", "3 min"],
["5min", "5 min"],
["10min", "10 min"],
["15min", "15 min"],
["30min", "30 min"],
];
opts.forEach(([val, label]) => {
const o = document.createElement("option");
o.value = val;
o.textContent = label;
durationSelect.appendChild(o);
});
return;
}

// Text->Voice: durations optional (keep simple)
if (modeId === "text_voice") {
const opts = [
["15s", "15 seconds"],
["30s", "30 seconds"],
["1min", "1 min"],
["3min", "3 min"],
["5min", "5 min"],
];
opts.forEach(([val, label]) => {
const o = document.createElement("option");
o.value = val;
o.textContent = label;
durationSelect.appendChild(o);
});
}
}

function initCreate() {
applyUserUI();

const selectionLine = document.getElementById("selectionLine");
const promptBox = document.getElementById("promptBox");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const generateBtn = document.getElementById("generateBtn");

const uploadRow = document.getElementById("uploadRow");
const refInput = document.getElementById("refImageInput");
const refPreview = document.getElementById("refPreview");

const raw = localStorage.getItem("ql_selection");
if (!raw) {
if (selectionLine) selectionLine.textContent = "No selection found. Go back to Home.";
return;
}

const data = JSON.parse(raw);

if (selectionLine) {
selectionLine.textContent =
`Mode: ${data.modeLabel || "—"} • Theme: ${data.themeTitle || "—"} • Style: ${data.styleTitle || "—"}`;
}

if (promptBox) promptBox.value = data.prompt || "";

// Show Image Upload only for Image->Video mode
if (uploadRow) {
uploadRow.style.display = (data.modeId === "image_video") ? "block" : "none";
}

// Preview uploaded image
if (refInput && refPreview) {
refInput.addEventListener("change", () => {
const f = refInput.files?.[0];
if (!f) return;
const url = URL.createObjectURL(f);
refPreview.src = url;
refPreview.style.display = "block";
});
}

// Durations based on mode
setDurationOptions(data.modeId);

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

// Generate -> go to Result page (placeholder)
if (generateBtn) {
generateBtn.addEventListener("click", () => {
// later: send prompt/settings to backend, then show real output
window.location.href = "result.html";
});
}
}

// ====== RESULT INIT (placeholder) ======
function initResult() {
applyUserUI();
}

// ====== BOOT ======
document.addEventListener("DOMContentLoaded", () => {
const isHome = document.getElementById("themeRail") && document.getElementById("styleRail");
const isCreate = document.getElementById("promptBox");
const isResult = document.title.includes("Result");

if (isHome) initHome();
if (isCreate) initCreate();
if (isResult) initResult();
});





