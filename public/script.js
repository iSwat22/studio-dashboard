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

/* ---------- IMAGE → VIDEO (CALL BACKEND TEST) ---------- */
const i2vBtn = document.getElementById("i2vBtn");
const i2vStatus = document.getElementById("i2vStatus");

if (i2vBtn) {
i2vBtn.addEventListener("click", async () => {
i2vStatus.textContent = "Testing backend…";
i2vBtn.disabled = true;

try {
const res = await fetch("/api/image-to-video", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ test: true })
});

const data = await res.json().catch(() => ({}));

if (!res.ok) {
throw new Error(data.error || `HTTP ${res.status}`);
}

// Show whatever message the backend returns
i2vStatus.textContent = data.message
? `✅ ${data.message}`
: "✅ Backend responded (no message field)";

} catch (err) {
console.error(err);
i2vStatus.textContent = `❌ Backend error: ${err.message}`;
} finally {
i2vBtn.disabled = false;
}
});
}

});

