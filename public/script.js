// FRONTEND SCRIPT (runs in the browser only)
console.log("✅ Frontend script loaded");

document.addEventListener("DOMContentLoaded", () => {
const promptBox = document.getElementById("t2iPrompt");
const button = document.getElementById("t2iBtn");
const status = document.getElementById("t2iStatus");
const img = document.getElementById("t2iImg");

if (!promptBox || !button || !status || !img) {
console.error("❌ Missing Text→Image elements");
return;
}

button.addEventListener("click", async () => {
console.log("✅ t2iBtn clicked");

const prompt = promptBox.value.trim();
if (!prompt) {
status.textContent = "Please enter a prompt.";
return;
}

status.textContent = "Generating image…";
button.disabled = true;
img.style.display = "none";

try {
const res = await fetch("/api/text-to-image", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ prompt }),
});

const data = await res.json().catch(() => null);

if (!res.ok || !data?.ok) {
const msg = data?.error || `Request failed (${res.status})`;
throw new Error(msg);
}

img.src = `data:${data.mimeType};base64,${data.base64}`;
img.style.display = "block";
status.textContent = "✅ Image generated";
} catch (err) {
console.error(err);
status.textContent = "❌ " + (err.message || "Error generating image");
} finally {
button.disabled = false;
}
});
});
