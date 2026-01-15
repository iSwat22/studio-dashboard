/* =========================
Quanna Leap — script.js (FIXED)
- Modes route to their own create pages
- Themes & Styles ALWAYS route to create.html
- No cross-pollination of IDs
========================= */

/* ===== USER (TEMP) ===== */
const USER = {
name: "KC",
role: "Admin",
plan: "Platinum",
stars: "∞",
};

/* ===== APPLY USER UI ===== */
function applyUserUI() {
const planPill = document.getElementById("planPill");
const starsPill = document.getElementById("starsPill");
const profileName = document.getElementById("profileName");
const profileRole = document.getElementById("profileRole");
const avatarCircle = document.getElementById("avatarCircle");

if (planPill) planPill.textContent = USER.plan;
if (starsPill) starsPill.textContent = `★ ${USER.stars}`;
if (profileName) profileName.textContent = USER.name;
if (profileRole) profileRole.textContent = USER.role;
if (avatarCircle) avatarCircle.textContent = USER.name.charAt(0);
}

/* =====================================================
MODES (THE ONLY THING THAT CONTROLS PAGE ROUTING)
===================================================== */
const MODES = [
{ id: "text-image", label: "Text → Image", page: "create-image.html" },
{ id: "text-video", label: "Text → Video", page: "create-video.html" },
{ id: "image-video", label: "Image → Video", page: "create-image-video.html" },
{ id: "text-voice", label: "Text → Voice", page: "create-voice.html" },
];

/* =====================================================
THEMES — ALWAYS GO TO create.html
===================================================== */
const THEMES = [
{
id: "kids_story",
title: "Kids Story",
image: "Kids_Story.jpeg",
promptSeed: "Create a kid-friendly story with warmth and hope.",
page: "create.html",
},
{
id: "biblical_epic",
title: "Biblical Epic",
image: "Biblical_Epic.jpeg",
promptSeed: "Create a respectful biblical-style epic.",
page: "create.html",
},
{
id: "neon_city",
title: "Neon City Heist",
image: "Neon_City_Heist.jpeg",
promptSeed: "Create a futuristic neon city heist story.",
page: "create.html",
},
];

/* =====================================================
STYLES — ALWAYS GO TO create.html
===================================================== */
const STYLES = [
{
id: "pixar",
title: "Pixar Style",
image: "Pixar_Style.jpeg",
styleSeed: "High-quality 3D animated family-film style.",
page: "create.html",
},
{
id: "disney",
title: "Disney Style",
image: "Disney_Style.jpeg",
styleSeed: "Bright, magical, classic animated style.",
page: "create.html",
},
{
id: "anime",
title: "Anime Fantasy",
image: "Anime_Fantasy.jpeg",
styleSeed: "Anime-inspired cinematic style.",
page: "create.html",
},
];

/* ===== STATE ===== */
let selectedTheme = null;
let selectedStyle = null;

/* ===== HELPERS ===== */
function el(tag, cls) {
const e = document.createElement(tag);
if (cls) e.className = cls;
return e;
}

/* =====================================================
BUILD MODE BUBBLES (ROUTING HAPPENS HERE ONLY)
===================================================== */
function initModes() {
const rail = document.getElementById("modeRail");
if (!rail) return;

MODES.forEach(mode => {
const pill = el("div", "modeCard");
pill.textContent = mode.label;

pill.onclick = () => {
window.location.href = mode.page;
};

rail.appendChild(pill);
});
}

/* =====================================================
BUILD THEME / STYLE CARDS
===================================================== */
function buildCard(item, type) {
const card = el("div", "card");
const img = el("img", "cardImg");
img.src = item.image;

const body = el("div", "cardBody");
const title = el("div", "cardTitle");
title.textContent = item.title;

body.appendChild(title);
card.appendChild(img);
card.appendChild(body);

card.onclick = () => {
if (type === "theme") selectedTheme = item;
if (type === "style") selectedStyle = item;

saveSelection();
window.location.href = "create.html";
};

return card;
}

/* ===== SAVE SELECTION ===== */
function saveSelection() {
localStorage.setItem(
"ql_selection",
JSON.stringify({
theme: selectedTheme,
style: selectedStyle,
})
);
}

/* =====================================================
HOME INIT
===================================================== */
function initHome() {
const themeRail = document.getElementById("themeRail");
const styleRail = document.getElementById("styleRail");

THEMES.forEach(t => themeRail.appendChild(buildCard(t, "theme")));
STYLES.forEach(s => styleRail.appendChild(buildCard(s, "style")));

initModes();
applyUserUI();
}

/* =====================================================
CREATE PAGE INIT
===================================================== */
function initCreate() {
applyUserUI();

const data = JSON.parse(localStorage.getItem("ql_selection") || "{}");
const promptBox = document.getElementById("promptBox");
const line = document.getElementById("selectionLine");

if (line && data.theme && data.style) {
line.textContent = `${data.theme.title} • ${data.style.title}`;
}

if (promptBox && data.theme && data.style) {
promptBox.value = `
${data.theme.promptSeed}

${data.style.styleSeed}

Rules:
- Clear scenes
- Strong visuals
- Ready for image/video generation
`.trim();
}
}

/* ===== BOOT ===== */
document.addEventListener("DOMContentLoaded", () => {
if (document.getElementById("themeRail")) initHome();
if (document.getElementById("promptBox")) initCreate();
});





