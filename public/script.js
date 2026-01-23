/* ======================================================
   Quanne Leap — Unified script.js (2026 Edition)
   - Handles Home (Selection), Create (Prompt), and T2V (Video)
   ====================================================== */

/* ---------- 1. DATA & CONFIG ---------- */
const USER = { name: "KC", role: "Admin", plan: "Platinum", stars: "∞", isAdmin: true };
const IMAGE_BASE = "/"; // Change to "/public/quannaleap_cards/" if images don't appear

const THEMES = [
    { id: "Kids_Story", title: "Kids Story", sub: "Kid-friendly adventure", image: "Kids_Story.jpeg", promptSeed: "Create a kid-friendly story with warm, hopeful tone." },
    { id: "Biblical_Epic", title: "Biblical Epic", sub: "Faith + cinematic scale", image: "Biblical_Epic.jpeg", promptSeed: "Create a respectful biblical-inspired epic." },
    { id: "Neon_City_Heist", title: "Neon City Heist", sub: "Neon crime story", image: "Neon_City_Heist.jpeg", promptSeed: "Create a neon cyber-city heist story." },
    { id: "Future_Ops", title: "Future Ops", sub: "Tactical sci-fi action", image: "Future_Ops.jpeg", promptSeed: "Create a futuristic special-ops mission story." }
];

const STYLES = [
    { id: "Pixar_Style", title: "Pixar Style", sub: "3D, emotional", image: "Pixar_Style.jpeg", styleSeed: "Style: high-quality 3D animated film look." },
    { id: "Disney_Style", title: "Disney Style", sub: "Magical, bright", image: "Disney_Style.jpeg", styleSeed: "Style: magical family-friendly animated feel." },
    { id: "Anime_Fantasy", title: "Anime Fantasy", sub: "Dramatic", image: "Anime_Fantasy.jpeg", styleSeed: "Style: anime-inspired cinematic look." },
    { id: "Realistic_Cinema", title: "Realistic Cinema", sub: "Live-action", image: "Realistic_Cinema.jpeg", styleSeed: "Style: realistic cinematic look." }
];

/* ---------- 2. UTILITY HELPERS ---------- */
const el = (tag, className, attrs = {}) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
};

const pickFirst = (...ids) => ids.map((id) => document.getElementById(id)).find(Boolean);

function applyUserUI() {
    const ids = ["planPill", "starsPill", "profileName", "profileRole", "avatarCircle"];
    const elements = ids.reduce((acc, id) => ({ ...acc, [id]: document.getElementById(id) }), {});

    if (elements.planPill) elements.planPill.textContent = USER.plan;
    if (elements.starsPill) elements.starsPill.textContent = USER.isAdmin ? "★ ∞" : `★ ${USER.stars}`;
    if (elements.profileName) elements.profileName.textContent = USER.name;
    if (elements.profileRole) elements.profileRole.textContent = USER.role;
    if (elements.avatarCircle) elements.avatarCircle.textContent = (USER.name || "U").trim().charAt(0).toUpperCase();
}

/* ---------- 3. HOME PAGE SELECTION ---------- */
let selectedTheme = null;
let selectedStyle = null;

function buildCard(item, type) {
    const card = el("div", "card", { "data-id": item.id, "data-type": type });
    const img = el("img", "cardImg", { alt: item.title, src: IMAGE_BASE + item.image });
    
    img.onerror = () => console.warn("Missing image:", img.src);

    const body = el("div", "cardBody");
    body.innerHTML = `<div class="cardTitle">${item.title}</div><div class="cardSub">${item.sub || ""}</div>`;

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
    rail.querySelectorAll(".card").forEach(c => c.classList.toggle("selected", c.getAttribute("data-id") === selectedId));
}

function updateReady() {
    const btn = document.getElementById("goCreateBtn");
    const line = document.getElementById("readySub");
    const hasAny = !!(selectedTheme || selectedStyle);

    if (line) {
        line.textContent = hasAny ? `Selected • ${[selectedTheme?.title, selectedStyle?.title].filter(Boolean).join(" + ")}` : "Choose an option to continue.";
    }
    if (btn) btn.disabled = !hasAny;
}

function goToCreate() {
    const payload = {
        themeTitle: selectedTheme?.title,
        styleTitle: selectedStyle?.title,
        prompt: `${selectedTheme?.promptSeed || ""} ${selectedStyle?.styleSeed || ""}`.trim()
    };
    localStorage.setItem("ql_selection", JSON.stringify(payload));
    window.location.href = "create.html";
}

/* ---------- 4. TEXT-TO-VIDEO LOGIC (PROD FIX) ---------- */
const t2vPrompt = pickFirst("t2vPrompt", "promptBox"); // Create Page uses promptBox
const t2vBtn = pickFirst("t2vBtn", "generateBtn");
const t2vVideo = pickFirst("t2vVideo", "resultVideo");
const t2vStatus = pickFirst("t2vStatus", "statusText");

async function generateT2v() {
    if (!t2vPrompt || !t2vBtn) return;
    const promptValue = t2vPrompt.value.trim();
    if (!promptValue) return (t2vStatus.textContent = "Please enter a prompt.");

    t2vBtn.disabled = true;
    if (t2vStatus) t2vStatus.textContent = "Generating Video...";

    try {
        const res = await fetch("/api/text-to-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: promptValue })
        });
        const data = await res.json();
        
        // Polling logic would go here. For now, assuming direct return or simulation:
        if (data.videoUrl || data.base64) {
            const src = data.videoUrl || `data:video/mp4;base64,${data.base64}`;
            renderVideo(src);
        }
    } catch (err) {
        if (t2vStatus) t2vStatus.textContent = "❌ Error: " + err.message;
    } finally {
        t2vBtn.disabled = false;
    }
}

function renderVideo(source) {
    if (!t2vVideo) return;
    
    // Blob Conversion Fix for NotSupportedError
    if (source.startsWith("data:")) {
        const byteChars = atob(source.split(",")[1]);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        source = URL.createObjectURL(new Blob([bytes], { type: "video/mp4" }));
    }

    t2vVideo.muted = true;
    t2vVideo.setAttribute("playsinline", "");
    t2vVideo.src = source;
    t2vVideo.style.display = "block";
    t2vVideo.load();
    t2vVideo.play().catch(() => (t2vStatus.textContent = "✅ Ready. Click play."));
}

/* ---------- 5. INITIALIZATION ---------- */
document.addEventListener("DOMContentLoaded", () => {
    applyUserUI();

    // Home Page Initializer
    const themeRail = document.getElementById("themeRail");
    const styleRail = document.getElementById("styleRail");
    if (themeRail && styleRail) {
        themeRail.innerHTML = ""; styleRail.innerHTML = "";
        THEMES.forEach(t => themeRail.appendChild(buildCard(t, "theme")));
        STYLES.forEach(s => styleRail.appendChild(buildCard(s, "style")));
        
        const goBtn = document.getElementById("goCreateBtn");
        if (goBtn) goBtn.addEventListener("click", goToCreate);
    }

    // Create Page Initializer
    const promptBox = document.getElementById("promptBox");
    if (promptBox && !themeRail) {
        const saved = JSON.parse(localStorage.getItem("ql_selection") || "{}");
        promptBox.value = saved.prompt || "";
    }

    // Global Video Trigger
    if (t2vBtn) t2vBtn.addEventListener("click", generateT2v);
});

