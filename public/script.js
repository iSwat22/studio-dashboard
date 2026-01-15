/* =========================
Quanna Leap v1 Home/Create/Result
- Mode + Theme + Style (Home)
- Create page uses selections
- Result page placeholder
========================= */

// ====== USER / PLAN (temporary placeholders) ======
const USER = {
name: "KC",
role: "Admin",
plan: "Platinum", // TEXT
stars: 999999,
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

// ====== MODES (one or more) ======
const MODES = [
{ id: "text_image", title: "Text → Image" },
{ id: "text_video", title: "Text → Video" },
{ id: "image_video", title: "Image → Video" },
{ id: "text_voice", title: "Text → Voice" }
];

// ====== CARD DATA (JPEG FILES) ======
// IMPORTANT: these filenames MUST match exactly what is inside your /public folder.
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

{ id: "Disney_Style", title: "Disney Style", sub: "magical, bright, classic", image: "Disney_Style.jpeg",
styleSeed: `Style: magical, bright, family-friendly animated feel, charming environments, uplifting tone.` },

{ id: "Anime_Fantasy", title: "Anime Fantasy", sub: "dramatic + stylized", image: "Anime_Fantasy.jpeg",
styleSeed: `Style: anime-inspired cinematic look, dynamic camera moves, expressive eyes, dramatic lighting and atmosphere.` },

{ id: "Realistic_Cinema", title: "Realistic Cinema", sub: "live-action vibe", image: "Realistic_Cinema.jpeg",
styleSeed: `Style: realistic cinematic live-action look, natural textures, film lighting, shallow depth of field.` }
];

// ====== SELECTION STATE ======
let selectedTheme = null;
let selectedStyle = null;
let selectedModes = new Set(); // one OR more

// ====== HELPERS ======
function el(tag, className, attrs = {}) {
const e = document.createElement(tag);
if (className) e.className = className;
Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
return e;
}

function buildCard(item, type) {
const card = el("div", "card", { "data-id": item.id, "data-type": type });

// If images are in the same folder as index.html (public), filename alone is correct.
// If not, change to: `src: "public/" + item.image` or `src: "/" + item.image`
const img = el("img", "cardImg", { alt: item.title, src: item.image });

const body = el("div", "cardBody");
const title = el("div", "cardTitle"); title.textContent = item.title;
const sub = el("div", "cardSub"); sub.textContent = item.sub || "";

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

const ok = (selectedModes.size > 0) && !!selectedTheme && !!selectedStyle;

if (line) {
if (!ok) {
line.textContent = "Choose 1 or more Mode + 1 Theme + 1 Style, then go create.";
} else {
const modeNames = [...selectedModes].map(id => MODES.find(m => m.id === id)?.title).filter(Boolean).join(", ");
line.textContent = `Selected: ${modeNames} + ${selectedTheme.title} + ${selectedStyle.title}`;
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
- Strong dialogue and clear scene progression
- Provide scene-by-scene beats (or one continuous script if requested)
- Include camera + movement suggestions (especially for video)

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
themeTitle: selectedTheme?.title,
styleTitle: selectedStyle?.title,
prompt: buildFinalPrompt()
};
localStorage.setItem("ql_selection", JSON.stringify(payload));
window.location.href = "create.html";
}

// ====== MODE UI ======
function buildModeButtons() {
const bar = document.getElementById("modeBar");
if (!bar) return;

MODES.forEach(m => {
const b = el("button", "modeBtn", { type: "button", "data-mode": m.id });
b.textContent = m.title;

b.addEventListener("click", () => {
if (selectedModes.has(m.id)) selectedModes.delete(m.id);
else selectedModes.add(m.id);

b.classList.toggle("selected", selectedModes.has(m.id));
updateReady();
});

bar.appendChild(b);
});
}

function clearModes() {
selectedModes.clear();
document.querySelectorAll(".modeBtn").forEach(b => b.classList.remove("selected"));
updateReady();
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
function fillDurationOptions(selectEl, modeList) {
if (!selectEl) return;
selectEl.innerHTML = "";

const hasVideo = modeList.includes("text_video") || modeList.includes("image_video");
const hasVoice = modeList.includes("text_voice");
const hasImage = modeList.includes("text_image");

// Video: 8s -> 30min (your requirement)
if (hasVideo) {
const opts = [
["8s","8 sec"], ["10s","10 sec"], ["15s","15 sec"], ["30s","30 sec"],
["1m","1 min"], ["3m","3 min"], ["5m","5 min"], ["10m","10 min"],
["15m","15 min"], ["25m","25 min"], ["30m","30 min"]
];
opts.forEach(([v, t]) => {
const o = document.createElement("option");
o.value = v; o.textContent = t;
selectEl.appendChild(o);
});
return;
}

// Voice: audio length options
if (hasVoice && !hasVideo) {
const opts = [
["10s","10 sec"], ["20s","20 sec"], ["30s","30 sec"],
["1m","1 min"], ["2m","2 min"], ["3m","3 min"], ["5m","5 min"]
];
opts.forEach(([v, t]) => {
const o = document.createElement("option");
o.value = v; o.textContent = t;
selectEl.appendChild(o);
});
return;
}

// Image only: duration not relevant (we’ll hide the field)
if (hasImage && !hasVideo && !hasVoice) {
// no options needed
return;
}
}

function initCreate() {
applyUserUI();

const selectionLine = document.getElementById("selectionLine");
const promptBox = document.getElementById("promptBox");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");

const ratioField = document.getElementById("ratioField");
const durationField = document.getElementById("durationField");
const durationLabel = document.getElementById("durationLabel");
const durationSelect = document.getElementById("durationSelect");
const generateBtn = document.getElementById("generateBtn");

const raw = localStorage.getItem("ql_selection");
if (!raw) {
if (selectionLine) selectionLine.textContent = "No selection found. Go back to Home.";
return;
}

const data = JSON.parse(raw);
const modeNames = (data.modes || []).map(id => MODES.find(m => m.id === id)?.title).filter(Boolean).join(", ");

if (selectionLine) {
selectionLine.textContent = `Mode: ${modeNames || "—"} • Theme: ${data.themeTitle || "—"} • Style: ${data.styleTitle || "—"}`;
}
if (promptBox) promptBox.value = data.prompt || "";

// Adjust fields by mode
const modes = data.modes || [];
const hasVideo = modes.includes("text_video") || modes.includes("image_video");
const hasVoice = modes.includes("text_voice");
const hasImageOnly = modes.includes("text_image") && !hasVideo && !hasVoice;

if (ratioField) ratioField.style.display = hasVideo ? "block" : "none";

if (durationField) {
if (hasImageOnly) {
durationField.style.display = "none";
} else {
durationField.style.display = "block";
if (durationLabel) durationLabel.textContent = hasVoice && !hasVideo ? "Audio Length" : "Duration";
fillDurationOptions(durationSelect, modes);
}
}

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

if (generateBtn) {
generateBtn.addEventListener("click", () => {
const req = {
...data,
ratio: document.getElementById("ratioSelect")?.value || null,
duration: document.getElementById("durationSelect")?.value || null,
language: document.getElementById("langSelect")?.value || "English",
prompt: promptBox?.value || ""
};
localStorage.setItem("ql_last_request", JSON.stringify(req));
window.location.href = "result.html";
});
}
}

// ====== RESULT INIT ======
function initResult() {
applyUserUI();

const resultLine = document.getElementById("resultLine");
const promptPreview = document.getElementById("promptPreview");

const raw = localStorage.getItem("ql_last_request");
if (!raw) {
if (resultLine) resultLine.textContent = "No request found. Go back and generate again.";
return;
}

const data = JSON.parse(raw);
const modeNames = (data.modes || []).map(id => MODES.find(m => m.id === id)?.title).filter(Boolean).join(", ");

if (resultLine) {
resultLine.textContent =
`Mode: ${modeNames || "—"} • Theme: ${data.themeTitle || "—"} • Style: ${data.styleTitle || "—"}`
+ (data.duration ? ` • Duration: ${data.duration}` : "")
+ (data.ratio ? ` • Ratio: ${data.ratio}` : "")
+ (data.language ? ` • Language: ${data.language}` : "");
}

if (promptPreview) promptPreview.textContent = data.prompt || "";
}

// ====== BOOT ======
document.addEventListener("DOMContentLoaded", () => {
const isHome = document.getElementById("themeRail") && document.getElementById("styleRail");
const isCreate = document.getElementById("promptBox");
const isResult = document.getElementById("resultBox");

if (isHome) initHome();
if (isCreate) initCreate();
if (isResult) initResult();
});





