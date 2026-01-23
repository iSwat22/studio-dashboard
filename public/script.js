/* ======================================================
   Quanne Leap — Unified script.js (2026 Edition)
   - User UI & Authentication
   - Theme/Style Selection (Home)
   - Prompt Management (Create)
   - Text-to-Video API & Polling (Production Ready)
   - Blank Video Rendering Fixes
   ====================================================== */

/* ---------- 1. USER & GLOBAL DATA ---------- */
const USER = {
    name: "KC",
    role: "Admin",
    plan: "Platinum",
    stars: "∞",
    isAdmin: true
};

const IMAGE_BASE = "/";

const THEMES = [
    { id: "Kids_Story", title: "Kids Story", sub: "Kid-friendly adventure", image: "Kids_Story.jpeg", promptSeed: "Create a kid-friendly story with warm, hopeful tone. Simple dialogue, clear action, and a meaningful lesson." },
    { id: "Biblical_Epic", title: "Biblical Epic", sub: "Faith + cinematic scale", image: "Biblical_Epic.jpeg", promptSeed: "Create a respectful biblical-inspired epic with emotional moments, dramatic stakes, and uplifting resolution." },
    { id: "Neon_City_Heist", title: "Neon City Heist", sub: "Neon crime story (original)", image: "Neon_City_Heist.jpeg", promptSeed: "Create a neon cyber-city heist story: fast pacing, clever plan, twists, and a stylish futuristic setting." },
    { id: "Future_Ops", title: "Future Ops", sub: "Tactical sci-fi action", image: "Future_Ops.jpeg", promptSeed: "Create a futuristic special-ops mission story: tactical planning, high-tech gear, intense action, and team dialogue." }
];

const STYLES = [
    { id: "Pixar_Style", title: "Pixar Style", sub: "3D, emotional, cinematic", image: "Pixar_Style.jpeg", styleSeed: "Style: high-quality 3D animated family film look, expressive characters, soft cinematic lighting, emotional beats." },
    { id: "Disney_Style", title: "Disney Style", sub: "Magical, bright, classic", image: "Disney_Style.jpeg", styleSeed: "Style: magical, bright, family-friendly animated feel, charming environments, uplifting tone." },
    { id: "Anime_Fantasy", title: "Anime Fantasy", sub: "Dramatic + stylized", image: "Anime_Fantasy.jpeg", styleSeed: "Style: anime-inspired cinematic look, dynamic camera moves, expressive eyes, dramatic lighting and atmosphere." },
    { id: "Realistic_Cinema", title: "Realistic Cinema", sub: "Live-action vibe", image: "Realistic_Cinema.jpeg", styleSeed: "Style: realistic cinematic live-action look, natural textures, film lighting, shallow depth of field." }
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

/* ---------- 3. HOME PAGE (THEMES/STYLES) ---------- */
let selectedTheme = null;
let selectedStyle = null;

function buildCard(item, type) {
    const card = el("div", "card", { "data-id": item.id, "data-type": type });
    const img = el("img", "cardImg", { alt: item.title, src: IMAGE_BASE + item.image });
    img.addEventListener("error", () => console.warn(`Missing image: ${IMAGE_BASE + item.image}`));

    const body = el("div", "cardBody");
    const title = el("div", "cardTitle"); title.textContent = item.title;
    const sub = el("div", "cardSub"); sub.textContent = item.sub || "";

    body.appendChild(title); body.appendChild(sub);
    card.appendChild(img); card.appendChild(body);

    card.addEventListener("click", () => {
        if (type === "theme") { selectedTheme = item; markSelected("themeRail", item.id); } 
        else { selectedStyle = item; markSelected("styleRail", item.id); }
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
        if (!hasAny) line.textContent = "Choose at least one option to continue.";
        else {
            const parts = [];
            if (selectedTheme) parts.push(`Theme: ${selectedTheme.title}`);
            if (selectedStyle) parts.push(`Style: ${selectedStyle.title}`);
            line.textContent = `Selected • ${parts.join(" + ")}`;
        }
    }
    if (btn) btn.disabled = !hasAny;
}

function goToCreate() {
    const payload = {
        themeId: selectedTheme?.id || null,
        styleId: selectedStyle?.id || null,
        themeTitle: selectedTheme?.title || null,
        styleTitle: selectedStyle?.title || null,
        prompt: `Theme: ${selectedTheme?.promptSeed || ""}\n\nStyle: ${selectedStyle?.styleSeed || ""}\n\nRules:\n- Strong dialogue and clear scene progression\n- Include camera + motion suggestions for video\n\nOutput:\n- Title\n- Short logline\n- Full prompt`.trim()
    };
    localStorage.setItem("ql_selection", JSON.stringify(payload));
    window.location.href = "create.html";
}

/* ---------- 4. TEXT-TO-VIDEO LOGIC ---------- */
const t2vPrompt = pickFirst("t2vPrompt", "prompt");
const t2vBtn = pickFirst("t2vBtn", "generateBtn");
const t2vStatus = pickFirst("t2vStatus", "status", "statusText", "outputStatus");
const t2vVideo = pickFirst("t2vVideo", "resultVideo", "video");

const downloadBtn = document.getElementById("downloadBtn");
const deleteBtn = document.getElementById("deleteBtn");
const saveToAssetsBtn = document.getElementById("saveToAssetsBtn");
const t2vDuration = document.getElementById("t2vDuration");
const t2vAspect = document.getElementById("t2vAspect");

function setT2vStatus(msg) { if (t2vStatus) t2vStatus.textContent = msg; }

async function pollTextToVideo(operationName) {
    const maxAttempts = 100;
    for (let i = 1; i <= maxAttempts; i++) {
        setT2vStatus(`Generating video… (${i}/${maxAttempts})`);
        await new Promise(r => setTimeout(r, 3000));
        const res = await fetch("/api/text-to-video/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ operationName }),
        });
        const data = await res.json();
        if (data.done) return data;
    }
    throw new Error("Generation timed out.");
}

async function generateT2v() {
    const promptValue = t2vPrompt.value.trim();
    if (!promptValue) return setT2vStatus("Please enter a prompt.");
    
    t2vBtn.disabled = true;
    setT2vStatus("Starting video job...");

    try {
        const res = await fetch("/api/text-to-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                prompt: promptValue, 
                aspectRatio: t2vAspect?.value || "16:9", 
                durationSeconds: t2vDuration?.value || 8 
            }),
        });
        const startData = await res.json();
        const result = await pollTextToVideo(startData.operationName);

        // --- Integrated Video Rendering Logic ---
        if (result.videoUrl || result.base64) {
            const finalSrc = result.videoUrl || `data:video/mp4;base64,${result.base64}`;
            
            // Core Fixes for Blank Display
            t2vVideo.muted = true;                      // Browsers block unmuted autoplay
            t2vVideo.setAttribute("playsinline", "");   // Required for mobile/modern renderers
            t2vVideo.controls = true;                   // Ensure user can see the playback bar
            t2vVideo.src = finalSrc;
            
            t2vVideo.style.display = "block";
            setT2vStatus("✅ Video ready");

            // Force playback to trigger frame rendering
            t2vVideo.play().catch(e => {
                console.warn("Autoplay blocked. User must click play.", e);
                setT2vStatus("✅ Video ready (Click Play)");
            });

            if (downloadBtn) { 
                downloadBtn.href = finalSrc; 
                downloadBtn.style.display = "inline-flex"; 
            }
        }
    } catch (err) {
        setT2vStatus(`❌ Error: ${err.message}`);
    } finally {
        t2vBtn.disabled = false;
    }
}

/* ---------- 5. PAGE INITIALIZERS ---------- */
function initHome() {
    const themeRail = document.getElementById("themeRail");
    const styleRail = document.getElementById("styleRail");
    if (!themeRail || !styleRail) return;

    themeRail.innerHTML = "";
    styleRail.innerHTML = "";
    THEMES.forEach(t => themeRail.appendChild(buildCard(t, "theme")));
    STYLES.forEach(s => styleRail.appendChild(buildCard(s, "style")));

    const goBtn = document.getElementById("goCreateBtn");
    if (goBtn) goBtn.addEventListener("click", goToCreate);

    const modeRail = document.getElementById("modeRail");
    if (modeRail) {
        modeRail.querySelectorAll(".modeCard").forEach(bubble => {
            bubble.addEventListener("click", () => {
                const target = bubble.getAttribute("data-target");
                if (target) window.location.href = target;
            });
        });
    }
}

function initCreate() {
    const promptBox = document.getElementById("promptBox");
    if (!promptBox) return;

    const data = JSON.parse(localStorage.getItem("ql_selection") || "{}");
    promptBox.value = data.prompt || "";

    const copyBtn = document.getElementById("copyBtn");
    if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
            await navigator.clipboard.writeText(promptBox.value);
            copyBtn.textContent = "Copied!";
            setTimeout(() => copyBtn.textContent = "Copy", 1000);
        });
    }
}

/* ---------- 6. BOOT ---------- */
document.addEventListener("DOMContentLoaded", () => {
    applyUserUI();
    initHome();
    initCreate();

    if (t2vBtn) {
        t2vBtn.addEventListener("click", generateT2v);
    }

    if (deleteBtn && t2vVideo) {
        deleteBtn.addEventListener("click", () => {
            t2vVideo.pause();
            t2vVideo.src = "";
            t2vVideo.load(); // Forces reset
            t2vVideo.style.display = "none";
            setT2vStatus("Your generated video will appear here.");
            if (downloadBtn) downloadBtn.style.display = "none";
        });
    }
});
