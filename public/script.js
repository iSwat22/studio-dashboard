/* =========================================================
Quanna Leap – Home UI Script (FINAL / STABLE)
DO NOT EDIT PARTS OF THIS FILE
========================================================= */

(function () {
"use strict";

/* =========================
DATA
========================= */

const MODES = [
{ id: "text_image", label: "Text → Image", page: "create-image.html" },
{ id: "text_video", label: "Text → Video", page: "create-video.html" },
{ id: "image_video", label: "Image → Video", page: "create-image-video.html" },
{ id: "text_voice", label: "Text → Voice", page: "create-voice.html" }
];

const THEMES = [
{
id: "kids_story",
title: "Kids Story",
sub: "Kid-friendly adventure",
image: "Kids_Story.jpeg",
promptSeed: "Create a kid-friendly story with warmth, hope, and simple dialogue."
},
{
id: "biblical_epic",
title: "Biblical Epic",
sub: "Faith + cinematic scale",
image: "Biblical_Epic.jpeg",
promptSeed: "Create a respectful biblical-inspired epic with emotional depth."
},
{
id: "neon_city",
title: "Neon City Heist",
sub: "Futuristic heist vibe",
image: "Neon_City_Heist.jpeg",
promptSeed: "Create a neon cyber-city heist with fast pacing and stylish visuals."
},
{
id: "future_ops",
title: "Future Ops",
sub: "Tactical sci-fi action",
image: "Future_Ops.jpeg",
promptSeed: "Create a futuristic special-ops mission with tactical intensity."
}
];

const STYLES = [
{
id: "pixar",
title: "Pixar Style",
sub: "3D, emotional, cinematic",
image: "Pixar_Style.jpeg",
styleSeed: "High-quality Pixar-style 3D animation with emotional beats."
},
{
id: "disney",
title: "Disney Style",
sub: "Magical, bright, classic",
image: "Disney_Style.jpeg",
styleSeed: "Disney-style animation with charm, warmth, and magic."
},
{
id: "anime",
title: "Anime Fantasy",
sub: "Dramatic + stylized",
image: "Anime_Fantasy.jpeg",
styleSeed: "Anime-inspired cinematic fantasy with dynamic lighting."
},
{
id: "realistic",
title: "Realistic Cinema",
sub: "Live-action vibe",
image: "Realistic_Cinema.jpeg",
styleSeed: "Photorealistic cinematic live-action style."
}
];

/* =========================
STATE
========================= */

const selectedThemes = new Set();
const selectedStyles = new Set();

/* =========================
DOM
========================= */

const modeRail = document.getElementById("modeRail");
const themeRail = document.getElementById("themeRail");
const styleRail = document.getElementById("styleRail");
const readyBox = document.getElementById("readyBox");
const goCreateBtn = document.getElementById("goCreateBtn");

/* =========================
MODE BUBBLES
========================= */

if (modeRail) {
MODES.forEach((m) => {
const btn = document.createElement("div");
btn.className = "modeCard";
btn.textContent = m.label;
btn.onclick = () => (window.location.href = m.page);
modeRail.appendChild(btn);
});
}

/* =========================
CARD FACTORY
========================= */

function createCard(item, selectedSet, onUpdate) {
const card = document.createElement("div");
card.className = "card";
card.innerHTML = `
<img class="cardImg" src="${item.image}">
<div class="cardBody">
<div class="cardTitle">${item.title}</div>
<div class="cardSub">${item.sub}</div>
</div>
`;

card.onclick = () => {
if (selectedSet.has(item.id)) {
selectedSet.delete(item.id);
card.classList.remove("selected");
} else {
selectedSet.add(item.id);
card.classList.add("selected");
}
onUpdate();
};

return card;
}

/* =========================
RENDER
========================= */

function updateReady() {
readyBox.innerHTML = "";

const picks = [];

selectedThemes.forEach((id) => {
const t = THEMES.find((x) => x.id === id);
if (t) picks.push(t.title);
});

selectedStyles.forEach((id) => {
const s = STYLES.find((x) => x.id === id);
if (s) picks.push(s.title);
});

if (picks.length === 0) {
readyBox.textContent = "Choose at least one option to continue.";
goCreateBtn.disabled = true;
return;
}

picks.forEach((p) => {
const chip = document.createElement("span");
chip.className = "pill";
chip.textContent = p;
readyBox.appendChild(chip);
});

goCreateBtn.disabled = false;
}

THEMES.forEach((t) =>
themeRail.appendChild(createCard(t, selectedThemes, updateReady))
);

STYLES.forEach((s) =>
styleRail.appendChild(createCard(s, selectedStyles, updateReady))
);

/* =========================
GO TO CREATE
========================= */

goCreateBtn.onclick = () => {
if (selectedThemes.size === 0 && selectedStyles.size === 0) return;

localStorage.setItem(
"ql_prompt_seeds",
JSON.stringify([
...[...selectedThemes].map(
(id) => THEMES.find((t) => t.id === id)?.promptSeed
),
...[...selectedStyles].map(
(id) => STYLES.find((s) => s.id === id)?.styleSeed
)
].filter(Boolean))
);

window.location.href = "create.html";
};
})();





