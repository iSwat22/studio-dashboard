/* =========================
Quanna Leap v1 Home/Create
- Mode bubbles choose which CREATE page to go to
- Cards enable Go to Create (choose one or more)
========================= */

// ====== USER / PLAN (temporary placeholders) ======
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
if (starsPill) starsPill.textContent = "★ ∞";
if (profileName) profileName.textContent = USER.name;
if (profileRole) profileRole.textContent = USER.role;
if (avatarCircle) avatarCircle.textContent = (USER.name || "U").trim().charAt(0).toUpperCase();
}

// ====== IMPORTANT: IMAGE PATH ======
const IMAGE_BASE = "quannaleap_cards/";

// ====== CARD DATA (JPEG FILES) ======
const THEMES = [
{ id: "Kids_Story", title: "Kids Story", sub: "Kid-friendly adventure", image: "Kids_Story.jpeg",
promptSeed: `Create a kid-friendly story with warm, hopeful tone. Simple dialogue, clear action, and a meaningful lesson.` },
{ id: "Biblical_Epic", title: "Biblical Epic", sub: "Faith + cinematic scale", image: "Biblical_Epic.jpeg",
promptSeed: `Create a respectful biblical-inspired epic with emotional moments, dramatic stakes, and uplifting resolution.` },
{ id: "Neon_City_Heist", title: "Neon City Heist", sub: "Neon crime story (original)", image: "Neon_City_Heist.jpeg",
promptSeed: `Create a neon cyber-city heist story: fast pacing, clever plan, twists, and a stylish futuristic setting.` },
{ id: "Future_Ops", title: "Future Ops", sub: "Tactical sci-fi action", image: "Future_Ops.jpeg",
promptSeed: `Create a futuristic special-ops mission story: tactical planning, high-tech gear, intense action, and team dialogue.` }
];

const STYLES = [
{ id: "Pixar_Style", title: "Pixar Style", sub: "3D, emotional, cinematic", image: "Pixar_Style.jpeg",
styleSeed: `Style: high-quality 3D animated family film look, expressive characters, soft cinematic lighting, emotional beats.` },
{ id: "Disney_Style", title: "Disney Style", sub: "Magical, bright, classic", image: "Disney_Style.jpeg",
styleSeed: `Style: magical, bright, family-friendly animated feel, charming environments, uplifting tone.` },
{ id: "Anime_Fantasy", title: "Anime Fantasy", sub: "Dramatic + stylized", image: "Anime_Fantasy.jpeg",
styleSeed: `Style: anime-inspired cinematic look, dynamic camera moves, expressive eyes, dramatic lighting and atmosphere.` },
{ id: "Biblical_Style", title: "Biblical Style", sub: "Faithful + respectful", image: "Biblical_Style.jpeg",
styleSeed: `Style: respectful biblical tone, cinematic lighting, warm hope-filled mood, historically inspired environments.` }
];

// ====== MODE (top bubbles) ======
const MODE_TO_PAGE = {
"text-to-image": "create-image.html",
"image-to-video": "create-image-video.html",
"text-to-video": "create-video.html",
"text-to-voice": "create-voice.html"
};

let selectedMode = null;
let selectedThemes = new Set();
let selectedStyles = new Set();

// ====== HELPERS ======
function el(tag, className, attrs = {}) {
const e = document.createElement(tag);
if (className) e.className = className;
Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
return e;
}

function buildCard(item, type) {
const card = el("div", "card", { "data-id": item.id, "data-type": type });

const img = el("img", "cardImg", { alt: item.title, src: IMAGE_BASE + item.image });
img.addEventListener("error", () => {
console.warn(`❌ Missing image: ${IMAGE_BASE + item.image}`);
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

// ✅ MULTI-SELECT support (choose one or more)
card.addEventListener("click", () => {
const id = item.id;

if (type === "theme") {
if (selectedThemes.has(id)) selectedThemes.delete(id);
else selectedThemes.add(id);
} else {
if (selectedStyles.has(id)) selectedStyles.delete(id);
else selectedStyles.add(id);
}

markSelected(type);
updateReady();
});

return card;
}

function markSelected(type) {
const railId = type === "theme" ? "themeRail" : "styleRail";
const rail = document.getElementById(railId);
if (!rail) return;

const selectedSet = type === "theme" ? selectedThemes : selectedStyles;

[...rail.querySelectorAll(".card")].forEach(c => {
const cid = c.getAttribute("data-id");
c.classList.toggle("selected", selectedSet.has(cid));
});
}

function setMode(modeId) {
selectedMode = modeId;

// highlight bubbles
document.querySelectorAll(".modeCard").forEach(btn => {
btn.classList.toggle("selected", btn.getAttribute("data-mode") === modeId);
});

updateReady();
}

function updateReady() {
const btn = document.getElementById("goCreateBtn");
const line = document.getElementById("readySub");

// ✅ At least ONE card must be selected (theme OR style)
const ok = (selectedThemes.size + selectedStyles.size) >= 1;

if (line) {
const tCount = selectedThemes.size;
const sCount = selectedStyles.size;
const modeText = selectedMode ? `Mode selected` : `Pick a Mode`;

if (!ok) line.textContent = `${modeText}. Choose 1 or more cards to continue.`;
else line.textContent = `${modeText}. Selected: ${tCount} theme(s), ${sCount} style(s).`;
}

if (btn) btn.disabled = !ok;
}

// Build prompt from what was selected
function buildPrompt() {
const themeText = THEMES
.filter(t => selectedThemes.has(t.id))
.map(t => t.promptSeed)
.join("\n\n");

const styleText = STYLES
.filter(s => selectedStyles.has(s.id))
.map(s => s.styleSeed)
.join("\n\n");

return `
${themeText}

${styleText}

Rules:
- Use the selected theme/style as the main direction
- Keep it consistent
- Output a clean prompt ready to paste
`.trim();
}

function goToCreate() {
// If no mode chosen, default to video create page (safe)
const page = MODE_TO_PAGE[selectedMode] || "create.html";

const payload = {
mode: selectedMode || null,
themes: [...selectedThemes],
styles: [...selectedStyles],
prompt: buildPrompt()
};

localStorage.setItem("ql_selection", JSON.stringify(payload));
window.location.href = page;
}

// ====== HOME INIT ======
function initHome() {
const themeRail = document.getElementById("themeRail");
const styleRail = document.getElementById("styleRail");
const goBtn = document.getElementById("goCreateBtn");

if (themeRail) THEMES.forEach(t => themeRail.appendChild(buildCard(t, "theme")));
if (styleRail) STYLES.forEach(s => styleRail.appendChild(buildCard(s, "style")));

// Mode bubble buttons (must exist in index HTML with class="modeCard" data-mode="text-to-image" etc.)
document.querySelectorAll(".modeCard").forEach(btn => {
btn.addEventListener("click", () => setMode(btn.getAttribute("data-mode")));
});

if (goBtn) goBtn.addEventListener("click", goToCreate);

applyUserUI();
updateReady();
}

// ====== BOOT ======
document.addEventListener("DOMContentLoaded", () => {
const isHome = document.getElementById("themeRail") && document.getElementById("styleRail");
if (isHome) initHome();
});






