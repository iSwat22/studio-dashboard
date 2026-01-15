/* =========================================================
Quanna Leap — Home UI Script (REWRITE — STABLE)
Matches KC flow:

1) Mode bubbles: click -> go to their create-* page immediately
- Text -> Image => create-image.html
- Text -> Video => create-video.html
- Image -> Video => create-image-video.html
- Text -> Voice => create-voice.html

2) Theme + Style cards: select/deselect (NO navigation)
- selections show in Ready box
- Go to Create enabled if ANY selection
- Go to Create -> create.html

3) Stores selection in localStorage for create.html to read
========================================================= */

(function () {
"use strict";

/* =========================
DATA (images must be in /public)
========================= */

const MODES = [
{ id: "text_image", label: "Text → Image", page: "create-image.html" },
{ id: "text_video", label: "Text → Video", page: "create-video.html" },
{ id: "image_video", label: "Image → Video", page: "create-image-video.html" },
{ id: "text_voice", label: "Text → Voice", page: "create-voice.html" },
];

// THEMES (cards)
const THEMES = [
{
id: "Kids_Story",
title: "Kids Story",
sub: "Kid-friendly adventure",
image: "Kids_Story.jpeg",
promptSeed:
"Theme: Kids Story — warm, hopeful tone, simple dialogue, clear action, meaningful lesson.",
},
{
id: "Biblical_Epic",
title: "Biblical Epic",
sub: "Faith + cinematic scale",
image: "Biblical_Epic.jpeg",
promptSeed:
"Theme: Biblical Epic — respectful biblical-inspired epic, emotional moments, uplifting resolution, cinematic scope.",
},
{
id: "Neon_City_Heist",
title: "Neon City Heist",
sub: "Futuristic heist vibe",
image: "Neon_City_Heist.jpeg",
promptSeed:
"Theme: Neon City Heist — neon cyber-city, fast pacing, clever plan, stylish futuristic setting, suspenseful twists.",
},
{
id: "Future_Ops",
title: "Future Ops",
sub: "Tactical sci-fi action",
image: "Future_Ops.jpeg",
promptSeed:
"Theme: Future Ops — futuristic special-ops mission, tactical planning, high-tech gear, intense action, team dialogue.",
},
];

// STYLES (cards)
const STYLES = [
{
id: "Pixar_Style",
title: "Pixar Style",
sub: "3D, emotional, cinematic",
image: "Pixar_Style.jpeg",
styleSeed:
"Style: high-quality 3D animated family-film look, expressive characters, soft cinematic lighting, emotional beats.",
},
{
id: "Disney_Style",
title: "Disney Style",
sub: "Magical, bright, classic",
image: "Disney_Style.jpeg",
styleSeed:
"Style: magical, bright, family-friendly animated feel, charming environments, uplifting tone, classic fairytale glow.",
},
{
id: "Anime_Fantasy",
title: "Anime Fantasy",
sub: "Dramatic + stylized",
image: "Anime_Fantasy.jpeg",
styleSeed:
"Style: anime-inspired cinematic look, dynamic camera moves, expressive eyes, dramatic lighting, atmospheric scenes.",
},
{
id: "Realistic_Cinema",
title: "Realistic Cinema",
sub: "Live-action vibe",
image: "Realistic_Cinema.jpeg",
styleSeed:
"Style: realistic cinematic live-action look, natural textures, film lighting, shallow depth of field, grounded realism.",
},
];

/* =========================
STORAGE KEYS
========================= */
const LS_THEME = "ql_selectedThemes"; // array
const LS_STYLE = "ql_selectedStyles"; // array

/* =========================
DOM HELPERS
========================= */
const $ = (sel) => document.querySelector(sel);

function safeJSONParse(value, fallback) {
try {
return JSON.parse(value);
} catch {
return fallback;
}
}

function loadSelections() {
const themes = safeJSONParse(localStorage.getItem(LS_THEME), []);
const styles = safeJSONParse(localStorage.getItem(LS_STYLE), []);
return {
themes: new Set(Array.isArray(themes) ? themes : []),
styles: new Set(Array.isArray(styles) ? styles : []),
};
}

function saveSelections(sel) {
localStorage.setItem(LS_THEME, JSON.stringify([...sel.themes]));
localStorage.setItem(LS_STYLE, JSON.stringify([...sel.styles]));
}

/* =========================
RENDER: MODE BUBBLES
- If HTML already has them, we just attach click handlers
- If not, we render them into #modeRail
========================= */
function setupModes() {
const modeRail = $("#modeRail") || $(".modeRail");
if (!modeRail) return;

const existing = modeRail.querySelectorAll(".modeCard, .modePill, button");

// If there are already bubbles in HTML, attach handlers by matching text
if (existing.length > 0) {
existing.forEach((el) => {
const label = (el.textContent || "").trim();
const match = MODES.find((m) => m.label === label);
if (!match) return;

el.style.cursor = "pointer";
el.addEventListener("click", () => {
window.location.href = match.page;
});
});
return;
}

// Otherwise render them
modeRail.innerHTML = "";
MODES.forEach((m) => {
const btn = document.createElement("div");
btn.className = "modeCard";
btn.textContent = m.label;
btn.addEventListener("click", () => {
window.location.href = m.page;
});
modeRail.appendChild(btn);
});
}

/* =========================
RENDER: THEME + STYLE CARDS
- Select / Deselect only (NO navigation)
- Updates Ready box
========================= */
function renderCards() {
const themeRail = $("#themeRail") || $("#themesRail") || $(".themeRail") || $("#themeCards");
const styleRail = $("#styleRail") || $("#stylesRail") || $(".styleRail") || $("#styleCards");

// If rails do not exist, don't force anything
if (!themeRail && !styleRail) return;

const sel = loadSelections();

// helper to build a card
function buildCard(item, group) {
const card = document.createElement("div");
card.className = "card hoverGlow";
card.dataset.group = group; // "theme" | "style"
card.dataset.id = item.id;

card.innerHTML = `
<img class="cardImg" src="${item.image}" alt="${item.title}">
<div class="cardBody">
<div class="cardTitle">${item.title}</div>
<div class="cardSub">${item.sub}</div>
</div>
`;

// set selected state
const isSelected =
group === "theme" ? sel.themes.has(item.id) : sel.styles.has(item.id);
if (isSelected) card.classList.add("selected");

// click toggle
card.addEventListener("click", () => {
if (group === "theme") {
if (sel.themes.has(item.id)) sel.themes.delete(item.id);
else sel.themes.add(item.id);
} else {
if (sel.styles.has(item.id)) sel.styles.delete(item.id);
else sel.styles.add(item.id);
}

saveSelections(sel);
card.classList.toggle("selected");
updateReadyBox(sel);
});

return card;
}

// Render themes only if we have a theme rail
if (themeRail) {
themeRail.innerHTML = "";
THEMES.forEach((t) => themeRail.appendChild(buildCard(t, "theme")));
}

// Render styles only if we have a style rail
if (styleRail) {
styleRail.innerHTML = "";
STYLES.forEach((s) => styleRail.appendChild(buildCard(s, "style")));
}

updateReadyBox(sel);
}

/* =========================
READY BOX
- Shows selected Theme(s) + Style(s)
- Enables Go to Create if ANY selection exists
========================= */
function updateReadyBox(sel) {
const readyBox = $("#readyBox");
const goBtn = $("#goCreateBtn") || $("#goToCreateBtn") || $("#goCreate");

if (!readyBox || !goBtn) return;

const themeList = [...sel.themes];
const styleList = [...sel.styles];

// Build display chips
const chips = [];

themeList.forEach((id) => {
const t = THEMES.find((x) => x.id === id);
if (t) chips.push(`<span class="pill" style="margin-right:8px;">${t.title}</span>`);
});

styleList.forEach((id) => {
const s = STYLES.find((x) => x.id === id);
if (s) chips.push(`<span class="pill" style="margin-right:8px;">${s.title}</span>`);
});

// If nothing selected
if (chips.length === 0) {
readyBox.innerHTML = `<div class="hint">Choose at least one option to continue.</div>`;
goBtn.disabled = true;
return;
}

readyBox.innerHTML = `
<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
${chips.join("")}
</div>
`;

goBtn.disabled = false;

// Ensure click goes to create.html
goBtn.onclick = () => {
// Also store the actual prompt seeds for create.html to use
const selectedThemes = themeList.map((id) => THEMES.find((x) => x.id === id)).filter(Boolean);
const selectedStyles = styleList.map((id) => STYLES.find((x) => x.id === id)).filter(Boolean);

localStorage.setItem("ql_themeSeeds", JSON.stringify(selectedThemes.map(t => t.promptSeed)));
localStorage.setItem("ql_styleSeeds", JSON.stringify(selectedStyles.map(s => s.styleSeed)));

window.location.href = "create.html";
};
}

/* =========================
INIT
========================= */
document.addEventListener("DOMContentLoaded", () => {
setupModes();
renderCards();
});
})();






