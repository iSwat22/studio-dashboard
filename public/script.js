/* =========================
Quanna Leap — public/script.js (FINAL FIX)
- Mode bubbles SELECT only (no navigation)
- Theme/Style cards SELECT only (no navigation)
- Ready box shows selections
- Go to Create navigates + passes prompt seeds
========================= */

(function () {
// ---------- DATA ----------
// IMPORTANT: These MUST include the cards you want to show.

const MODES = [
{ id: "text_image", label: "Text → Image", page: "create-image.html" },
{ id: "text_video", label: "Text → Video", page: "create-video.html" },
{ id: "image_video", label: "Image → Video", page: "create-image-video.html" },
{ id: "text_voice", label: "Text → Voice", page: "create-voice.html" },
];

// THEMES (TOP ROW)
const THEMES = [
{
id: "Kids_Story",
title: "Kids Story",
sub: "Kid-friendly adventure",
image: "Kids_Story.jpeg",
promptSeed:
"Theme: Kids Story. Tone: warm, hopeful, kid-friendly. Simple dialogue, clear action, wholesome lesson.",
},
{
id: "Biblical_Epic",
title: "Biblical Epic",
sub: "Faith + cinematic scale",
image: "Biblical_Epic.jpeg",
promptSeed:
"Theme: Biblical Epic. Tone: respectful, inspiring, cinematic scale. Emotional beats, meaningful moments, uplifting resolution.",
},
{
id: "Neon_City_Heist",
title: "Neon City Heist",
sub: "Futuristic heist vibe",
image: "Neon_City_Heist.jpeg",
promptSeed:
"Theme: Neon City Heist. Tone: stylish cyber-city. Fast pacing, clever plan, twists, neon atmosphere, sleek futuristic tech.",
},
{
id: "Future_Ops",
title: "Future Ops",
sub: "Tactical sci-fi action",
image: "Future_Ops.jpeg",
promptSeed:
"Theme: Future Ops. Tone: tactical sci-fi action. Special-ops mission, planning, high-tech gear, intense action, team dialogue.",
},
];

// STYLES (BOTTOM ROW)
const STYLES = [
{
id: "Pixar_Style",
title: "Pixar Style",
sub: "3D, emotional, cinematic",
image: "Pixar_Style.jpeg",
styleSeed:
"Style: High-quality 3D animated family-film look. Expressive characters, soft cinematic lighting, emotional beats, smooth camera movement.",
},
{
id: "Disney_Style",
title: "Disney Style",
sub: "Magical, bright, classic",
image: "Disney_Style.jpeg",
styleSeed:
"Style: Magical, bright, classic animated feel. Charming environments, uplifting tone, clean silhouettes, warm highlights, storybook color palette.",
},
{
id: "Anime_Fantasy",
title: "Anime Fantasy",
sub: "Dramatic + stylized",
image: "Anime_Fantasy.jpeg",
styleSeed:
"Style: Anime-inspired cinematic fantasy. Dynamic camera moves, expressive eyes, dramatic lighting, atmospheric backgrounds, vibrant effects.",
},
{
id: "Realistic_Cinema",
title: "Realistic Cinema",
sub: "Live-action vibe",
image: "Realistic_Cinema.jpeg",
styleSeed:
"Style: Realistic cinematic live-action look. Natural textures, film lighting, shallow depth of field, grounded color grading, handheld realism (subtle).",
},
];

// ---------- STATE ----------
let selectedMode = null; // MODES item
let selectedTheme = null; // THEMES item
let selectedStyle = null; // STYLES item

// ---------- DOM HOOKS ----------
// These ids/classes should match your HTML (based on your screenshots)
const modeRail = document.getElementById("modeRail");
const themeRail = document.getElementById("themeRail");
const styleRail = document.getElementById("styleRail");

const readyTitle = document.getElementById("readyTitle"); // optional
const readySub = document.getElementById("readySub"); // optional
const goBtn = document.getElementById("goCreateBtn"); // button

// Fallbacks if your HTML uses different names:
const readyBox = document.querySelector(".readyBox");
const fallbackGoBtn =
goBtn || document.querySelector(".cta") || document.querySelector("[data-go-create]");

// ---------- HELPERS ----------
function clearSelected(nodes) {
nodes.forEach((n) => n.classList.remove("selected"));
}

function setReadyText() {
if (!readyBox) return;

const parts = [];
if (selectedMode) parts.push(`Mode: ${selectedMode.label}`);
if (selectedTheme) parts.push(`Theme: ${selectedTheme.title}`);
if (selectedStyle) parts.push(`Style: ${selectedStyle.title}`);

const titleEl = readyTitle || readyBox.querySelector(".readyTitle") || readyBox.querySelector("strong");
const subEl = readySub || readyBox.querySelector(".readySub") || readyBox.querySelector("small");

if (titleEl) titleEl.textContent = "Ready?";
if (subEl) {
subEl.textContent =
parts.length > 0
? parts.join(" | ")
: "Choose at least one option to continue.";
}

if (fallbackGoBtn) {
fallbackGoBtn.disabled = parts.length === 0; // enable when any selection is made
}
}

function cardTemplate(item) {
const card = document.createElement("div");
card.className = "card";
card.tabIndex = 0;

const img = document.createElement("img");
img.className = "cardImg";
img.src = item.image;
img.alt = item.title;

const body = document.createElement("div");
body.className = "cardBody";

const title = document.createElement("div");
title.className = "cardTitle";
title.textContent = item.title;

const sub = document.createElement("div");
sub.className = "cardSub";
sub.textContent = item.sub || "";

body.appendChild(title);
body.appendChild(sub);

card.appendChild(img);
card.appendChild(body);

return card;
}

function pillTemplate(item) {
const pill = document.createElement("div");
pill.className = "modeCard";
pill.textContent = item.label;
pill.tabIndex = 0;
return pill;
}

function buildModeRail() {
if (!modeRail) return;

modeRail.innerHTML = "";
MODES.forEach((m) => {
const pill = pillTemplate(m);

pill.addEventListener("click", () => {
selectedMode = m;
clearSelected(Array.from(modeRail.children));
pill.classList.add("selected");
setReadyText();
});

pill.addEventListener("keydown", (e) => {
if (e.key === "Enter" || e.key === " ") pill.click();
});

modeRail.appendChild(pill);
});
}

function buildThemeRail() {
if (!themeRail) return;

themeRail.innerHTML = "";
THEMES.forEach((t) => {
const card = cardTemplate(t);

card.addEventListener("click", () => {
selectedTheme = t;
clearSelected(Array.from(themeRail.children));
card.classList.add("selected");
setReadyText();
});

card.addEventListener("keydown", (e) => {
if (e.key === "Enter" || e.key === " ") card.click();
});

themeRail.appendChild(card);
});
}

function buildStyleRail() {
if (!styleRail) return;

styleRail.innerHTML = "";
STYLES.forEach((s) => {
const card = cardTemplate(s);

card.addEventListener("click", () => {
selectedStyle = s;
clearSelected(Array.from(styleRail.children));
card.classList.add("selected");
setReadyText();
});

card.addEventListener("keydown", (e) => {
if (e.key === "Enter" || e.key === " ") card.click();
});

styleRail.appendChild(card);
});
}

function goToCreate() {
// Default mode if none selected (optional)
const mode = selectedMode || MODES.find((m) => m.id === "text_video") || MODES[0];

const params = new URLSearchParams();
params.set("mode", mode.id);

if (selectedTheme) {
params.set("theme", selectedTheme.id);
params.set("themeTitle", selectedTheme.title);
params.set("themeSeed", selectedTheme.promptSeed || "");
}
if (selectedStyle) {
params.set("style", selectedStyle.id);
params.set("styleTitle", selectedStyle.title);
params.set("styleSeed", selectedStyle.styleSeed || "");
}

// Navigate ONLY on the button click (not card click)
window.location.href = `${mode.page}?${params.toString()}`;
}

// ---------- INIT ----------
buildModeRail();
buildThemeRail();
buildStyleRail();
setReadyText();

if (fallbackGoBtn) {
fallbackGoBtn.addEventListener("click", (e) => {
e.preventDefault();
goToCreate();
});
}
})()





