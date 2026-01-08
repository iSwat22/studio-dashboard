// FRONTEND SCRIPT (browser only)
console.log("✅ Frontend script loaded");

document.addEventListener("DOMContentLoaded", () => {

/* ---------- TEXT → IMAGE ---------- */
const t2iPrompt = document.getElementById("t2iPrompt");
const t2iBtn = document.getElementById("t2iBtn");
const t2iStatus = document.getElementById("t2iStatus");
const t2iImg = document.getElementById("t2iImg");

if (t2iBtn) {
t2iBtn.addEventListener("click", async () => {
const prompt = t2iPrompt.value.trim();

if (!prompt) {
t2iStatus.textContent = "Please enter a prompt.";
return;
}

t2iStatus.textContent = "Generating image…";
t2iBtn.disabled = true;
t2iImg.style.display = "none";

try {
const res = await fetch("/api/text-to-image", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt })
});

const data = await res.json();

if (!res.ok || !data.ok) {
throw new Error(data.error || "Generation failed");
}

t2iImg.src = `data:${data.mimeType};base64,${data.base64}`;
t2iImg.style.display = "block";
t2iStatus.textContent = "✅ Image generated";

} catch (err) {
console.error(err);
t2iStatus.textContent = "❌ Error generating image";
} finally {
t2iBtn.disabled = false;
}
});
}

/* ---------- IMAGE → VIDEO (TEST CLICK) ---------- */
const i2vBtn = document.getElementById("i2vBtn");
const i2vStatus = document.getElementById("i2vStatus");

if (i2vBtn) {
i2vBtn.addEventListener("click", () => {
console.log("🎬 Image → Video button clicked");
i2vStatus.textContent = "✅ Button works. Video logic coming next.";
});
}

});


