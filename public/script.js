/* =========================
Quanna Leap — Home/Create Script (WORKING)
- Pick ANY ONE (Mode OR Theme OR Style) to enable Go to Create
- Ready box shows what you picked
- Go to Create saves localStorage + routes correctly
- Create pages auto-fill prompt box from localStorage
========================= */

/* ====== USER / PLAN (placeholders) ====== */
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

/* ====== IMAGES PATH ======
Put JPEGs here:
/public/quannaleap_cards/
Example:
/public/quannaleap_cards/Kids_Story.jpeg
*/
const IMAGE_BASE = "quannaleap_cards/";

/* ====== THEMES ====== */
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

/* ====== STYLES ====== */
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

/* ====== MODES ======
These are the bubbles under the rows.
They route to separate create pages.
*/
const MODES = [
{ id: "text-to-image", label: "Text → Image", page: "create-image.html" },
{ id: "text-to-video", label: "Text → Video", page: "create-video.html" },
{ id: "image-to-video", label: "Image → Video", page: "create-image-video.html" },
{ id: "text-to-voice", label: "Text → Voice", page: "create-voice.html" }
];

/* ====== Selection State ====== */
let selectedMode = null; // {id,label,page}
let selectedTheme = null; // theme object
let selectedStyle = null; // style object

/* ====== Helpers ====== */
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
console.warn(`❌ Missing image: ${IMAGE_BASE + item.image}. Check filename + .jpeg + capitalization.`);
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

/* ====== Mode Bubbles Builder ====== */
function buildModeBubbles() {
const modeRail = document.getElementById("modeRail");
if (!modeRail) return;

modeRail.innerHTML = "";

MODES.forEach(m => {
const bubble = el("div", "modeCard", { "data-mode": m.id });
bubble.textContent = m.label;

bubble.addEventListener("click", () => {
selectedMode = m;
markModeSelected(m.id);
updateReady();
});

modeRail.appendChild(bubble);
});
}

function markModeSelected(modeId) {
document.querySelectorAll("#modeRail .modeCard").forEach(b => {
b.classList.toggle("selected", b.getAttribute("data-mode") === modeId);
});
}

/* ====== Ready logic
ANY ONE selection allows create
(mode OR theme OR style)
*/
function hasAnySelection() {
return !!(selectedMode || selectedTheme || selectedStyle);
}

function updateReady() {
const btn = document.getElementById("goCreateBtn");
const line = document.getElementById("readySub");

const ok = hasAnySelection();

const bits = [];
if (selectedMode) bits.push(`Mode: ${selectedMode.label}`);
if (selectedTheme) bits.push(`Theme: ${selectedTheme.title}`);
if (selectedStyle) bits.push(`Style: ${selectedStyle.title}`);

if (line) {
if (!ok) line.textContent = "Choose at least 1 option to continue.";
else line.textContent = bits.join(" • ");
}

if (btn) btn.disabled = !ok;
}

/* ====== Prompt Builder ====== */
function buildFinalPrompt() {
const theme = selectedTheme ? selectedTheme.promptSeed : "";
const style = selectedStyle ? selectedStyle.styleSeed : "";

const modeHint = selectedMode
? `Mode: ${selectedMode.label}`
: `Mode: (not selected)`;

return `
${modeHint}

${theme}

${style}

Rules:
- No narrator unless requested
- Strong dialogue and clear progression
- Include camera + movement notes when needed

Output:
- Title
- Short logline
- Final prompt ready to paste
`.trim();
}

/* ====== Route decision ======
If a mode was selected, go to that mode page
Else default to create.html
*/
function getTargetCreatePage() {
if (selectedMode && selectedMode.page) return selectedMode.page;
return "create.html";
}

/* ====== Go Create ====== */
function goToCreate() {
if (!hasAnySelection()) return;

const payload = {
modeId: selectedMode?.id || null,
modeLabel: selectedMode?.label || null,
themeId: selectedTheme?.id || null,
styleId: selectedStyle?.id || null,
themeTitle: selectedTheme?.title || null,
styleTitle: selectedStyle?.title || null,
prompt: buildFinalPrompt()
};

localStorage.setItem("ql_selection", JSON.stringify(payload));
window.location.href = getTargetCreatePage();
}

/* ====== HOME INIT ====== */
function initHome() {
const themeRail = document.getElementById("themeRail");
const styleRail = document.getElementById("styleRail");
const goBtn = document.getElementById("goCreateBtn");

if (themeRail) THEMES.forEach(t => themeRail.appendChild(buildCard(t, "theme")));
if (styleRail) STYLES.forEach(s => styleRail.appendChild(buildCard(s, "style")));

buildModeBubbles();

if (goBtn) goBtn.addEventListener("click", goToCreate);

applyUserUI();
updateReady();
}

/* ====== CREATE INIT (works on ALL create pages) ====== */
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

if (selectionLine) {
const parts = [];
if (data.modeLabel) parts.push(`Mode: ${data.modeLabel}`);
if (data.themeTitle) parts.push(`Theme: ${data.themeTitle}`);
if (data.styleTitle) parts.push(`Style: ${data.styleTitle}`);
selectionLine.textContent = parts.length ? parts.join(" • ") : "Selection loaded.";
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

/* ====== BOOT ====== */
document.addEventListener("DOMContentLoaded", () => {
const isCreate = !!document.getElementById("promptBox");

// Home if it has theme/style rails OR modeRail
const isHome = !!(document.getElementById("themeRail") || document.getElementById("styleRail") || document.getElementById("modeRail"));

if (isHome && !isCreate) initHome();
if (isCreate) initCreate();
});






