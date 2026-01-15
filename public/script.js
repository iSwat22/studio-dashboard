/* =========================================================
Quanna Leap — Home UI Script (FINAL STABLE)
✅ Mode bubbles: click -> go to their create-* page
✅ Theme cards: select/deselect (NO navigation)
✅ Style cards: select/deselect (NO navigation)
✅ Ready box: shows picks, Go to Create enabled if ANY pick
✅ Go to Create -> create.html (+ stores selection in localStorage)
========================================================= */

(function () {
"use strict";

// =========================
// DATA
// =========================
const MODES = [
{ id: "text_image", label: "Text → Image", page: "create-image.html" },
{ id: "text_video", label: "Text → Video", page: "create-video.html" },
{ id: "image_video", label: "Image → Video", page: "create-image-video.html" },
{ id: "text_voice", label: "Text → Voice", page: "create-voice.html" },
];

// NOTE: image filenames must match exactly what you uploaded (JPEGs in /public)
const THEMES = [
{
id: "Kids_Story",
title: "Kids Story",
sub: "Kid-friendly adventure",
image: "Kids_Story.jpeg",
promptSeed:
"Theme: kid-friendly story. Warm, hopeful tone. Simple dialogue, clear action, meaningful lesson.",
},
{
id: "Biblical_Epic",
title: "Biblical Epic",
sub: "Faith + cinematic scale",
image: "Biblical_Epic.jpeg",
promptSeed:
"Theme: respectful biblical-inspired epic. Emotional moments, dramatic stakes, uplifting resolution.",
},
{
id: "Neon_City_Heist",
title: "Neon City Heist",
sub: "Futuristic heist vibe",
image: "Neon_City_Heist.jpeg",
promptSeed:
"Theme: neon cyber-city heist. Fast pacing, clever plan, twists, stylish futuristic setting.",
},
{
id: "Future_Ops",
title: "Future Ops",
sub: "Tactical sci-fi action",
image: "Future_Ops.jpeg",
promptSeed:
"Theme: futuristic special-ops mission. Tactical planning, high-tech gear, intense action, teamwork.",
},
];

const STYLES = [
{
id: "Pixar_Style",
title: "Pixar Style",
sub: "3D, emotional, cinematic",
image: "Pixar_Style.jpeg",
styleSeed:
"Style: high-quality 3D animated family-film look. Expressive characters, soft cinematic lighting, emotional beats.",
},
{
id: "Disney_Style",
title: "Disney Style",
sub: "Magical, bright, classic",
image: "Disney_Style.jpeg",
styleSeed:
"Style: magical, bright, family-friendly animated feel. Charming environments, uplifting tone.",
},
{
id: "Anime_Fantasy",
title: "Anime Fantasy",
sub: "Dramatic + stylized",
image: "Anime_Fantasy.jpeg",
styleSeed:
"Style: anime-inspired cinematic look. Dynamic camera moves, expressive eyes, dramatic lighting, atmospheric scenes.",
},
{
id: "Realistic_Cinema",
title: "Realistic Cinema",
sub: "Live-action vibe",
image: "Realistic_Cinema.jpeg",
styleSeed:
"Style: realistic cinematic live-action look. Natural textures, film lighting, shallow depth of field.",
},
];

// =========================
// STATE
// =========================
let selectedTheme = null; // object from THEMES or null
let selectedStyle = null; // object from STYLES or null

// =========================
// HELPERS
// =========================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function safeId(s) {
return String(s || "").replace(/[^\w\-]/g, "_");
}

function setLocalSelection() {
const payload = {
theme: selectedTheme ? selectedTheme.id : null,
style: selectedStyle ? selectedStyle.id : null,
themeTitle: selectedTheme ? selectedTheme.title : null,
styleTitle: selectedStyle ? selectedStyle.title : null,
themeSeed: selectedTheme ? selectedTheme.promptSeed : "",
styleSeed: selectedStyle ? selectedStyle.styleSeed : "",
ts: Date.now(),
};
localStorage.setItem("ql_selection", JSON.stringify(payload));
return payload;
}

function updateReadyUI() {
const readyTitle = $("#readyTitle") || $(".readyTitle");
const readySub = $("#readySub") || $(".readySub");
const goBtn = $("#goCreateBtn") || $(".cta");

// Build ready text
const parts = [];
if (selectedTheme) parts.push(`Theme: ${selectedTheme.title}`);
if (selectedStyle) parts.push(`Style: ${selectedStyle.title}`);

if (readyTitle) readyTitle.textContent = "Ready?";
if (readySub) {
readySub.textContent =
parts.length > 0
? parts.join(" • ")
: "Choose at least one option to continue.";
}

// Enable only if at least one selection (Theme OR Style)
if (goBtn) {
goBtn.disabled = !(selectedTheme || selectedStyle);
}
}

function buildCard(item, type) {
// type = "theme" | "style"
const card = document.createElement("div");
card.className = "card";
card.dataset.type = type;
card.dataset.id = item.id;

const img = document.createElement("img");
img.className = "cardImg";
img.alt = item.title;
img.src = item.image;

const body = document.createElement("div");
body.className = "cardBody";

const title = document.createElement("div");
title.className = "cardTitle";
title.textContent = item.title;

const sub = document.createElement("div");
sub.className = "cardSub";
sub.textContent = item.sub;

body.appendChild(title);
body.appendChild(sub);

card.appendChild(img);
card.appendChild(body);

// Click = select/deselect ONLY (no navigation)
card.addEventListener("click", () => {
if (type === "theme") {
// Toggle: same card -> unselect
if (selectedTheme && selectedTheme.id === item.id) {
selectedTheme = null;
} else {
selectedTheme = item;
}
// Update visuals: only 1 theme selected
$$(`.card[data-type="theme"]`).forEach((c) =>
c.classList.toggle("selected", c.dataset.id === (selectedTheme ? selectedTheme.id : ""))
);
} else {
// style
if (selectedStyle && selectedStyle.id === item.id) {
selectedStyle = null;
} else {
selectedStyle = item;
}
$$(`.card[data-type="style"]`).forEach((c) =>
c.classList.toggle("selected", c.dataset.id === (selectedStyle ? selectedStyle.id : ""))
);
}

updateReadyUI();
});

return card;
}

// =========================
// MODE BUBBLES (DIRECT LINKS)
// =========================
function wireModeBubbles() {
// Supports:
// - #modeRail with children having .modeCard
// - .modeRail with children having .modePill
// We match by text if needed, but prefer data-mode/id.

const rail = $("#modeRail") || $(".modeRail");
if (!rail) return;

const buttons = rail.querySelectorAll(".modeCard, .modePill, button, a, div");
if (!buttons.length) return;

const labelToMode = new Map(MODES.map((m) => [m.label.replace(/\s+/g, " ").trim(), m]));

buttons.forEach((btn) => {
// If already wired, skip
if (btn.dataset.wired === "1") return;

btn.dataset.wired = "1";

btn.addEventListener("click", (e) => {
e.preventDefault();

// Find mode by data-mode or data-id or text
const key =
btn.dataset.mode ||
btn.dataset.id ||
(btn.textContent || "").replace(/\s+/g, " ").trim();

let mode =
MODES.find((m) => m.id === key) ||
MODES.find((m) => m.label === key) ||
labelToMode.get(key);

if (!mode) return;

// GO DIRECTLY to that mode page (your requirement)
window.location.href = mode.page;
});
});
}

// =========================
// RENDER THEME + STYLE RAILS
// =========================
function renderRails() {
// Theme rail: try #themeRail first, else first ".rail" after "Pick Theme"
const themeRail =
$("#themeRail") ||
$("#themesRail") ||
$('[data-rail="themes"]') ||
$(".rail.themeRail") ||
null;

// Style rail:
const styleRail =
$("#styleRail") ||
$("#stylesRail") ||
$('[data-rail="styles"]') ||
$(".rail.styleRail") ||
null;

// If IDs not present, fall back to: first two rails on the page
const railsFallback = $$(".rail");
const themeTarget = themeRail || railsFallback[0];
const styleTarget = styleRail || railsFallback[1];

if (themeTarget) {
themeTarget.innerHTML = "";
THEMES.forEach((t) => themeTarget.appendChild(buildCard(t, "theme")));
}

if (styleTarget) {
styleTarget.innerHTML = "";
STYLES.forEach((s) => styleTarget.appendChild(buildCard(s, "style")));
}
}

// =========================
// GO TO CREATE (create.html)
// =========================
function wireGoToCreate() {
const goBtn = $("#goCreateBtn") || $(".cta");
if (!goBtn) return;

goBtn.addEventListener("click", () => {
// Must have at least one selection (Theme OR Style)
if (!(selectedTheme || selectedStyle)) return;

// store selection for create.html
const payload = setLocalSelection();

// also pass short params (optional)
const params = new URLSearchParams();
if (payload.theme) params.set("theme", payload.theme);
if (payload.style) params.set("style", payload.style);

window.location.href = `create.html?${params.toString()}`;
});
}

// =========================
// INIT
// =========================
function init() {
// DO NOT touch layout; only wiring behavior
wireModeBubbles();
renderRails();
wireGoToCreate();
updateReadyUI();
}

// Run when DOM is ready
if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", init);
} else {
init();
}
})();





