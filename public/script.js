/* =========================
Quanna Leap v1 Home/Create
- Two rows: Themes + Styles
- Cards are generated in JS (not HTML)
- Uses JPEGs in /public
========================= */

// ====== USER / PLAN (temporary placeholders) ======
const USER = {
name: "KC",
role: "Admin",
plan: "Standard",
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
sub: "GTA-ish vibe (original)",
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
let selectedTheme = null;
let selectedStyle = null;

// ====== HELPERS ======
function el(tag, className, attrs = {}) {
const e = document.createElement(tag);
if (className) e.className = className;
Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
return e;
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

function updateReady() {
const btn = document.getElementById("goCreateBtn");
const line = document.getElementById("readySub");
const ok = !!(selectedTheme && selectedStyle);

if (line) {
if (!ok) line.textContent = "Choose 1 Theme + 1 Style, then go create.";
else line.textContent = `Selected: ${selectedTheme.title} + ${selectedStyle.title}`;
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

THEMES.forEach(t => themeRail.appendChild(buildCard(t, "theme")));
STYLES.forEach(s => styleRail.appendChild(buildCard(s, "style")));

if (goBtn) goBtn.addEventListener("click", goToCreate);

applyUserUI();
updateReady();
}

// ====== CREATE INIT ======
function initCreate() {
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
if (selectionLine) selectionLine.textContent = `Theme: ${data.themeTitle || "—"} • Style: ${data.styleTitle || "—"}`;
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

// ====== BOOT ======
document.addEventListener("DOMContentLoaded", () => {
// Detect which page we are on
const isHome = document.getElementById("themeRail") && document.getElementById("styleRail");
const isCreate = document.getElementById("promptBox");

if (isHome) initHome();
if (isCreate) initCreate();
});






