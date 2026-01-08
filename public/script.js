document.addEventListener("DOMContentLoaded", () => {
  const promptBox = document.getElementById("t2iPrompt");
  const button = document.getElementById("t2iBtn");
  const status = document.getElementById("t2iStatus");
  const img = document.getElementById("t2iImg");

  // Safety checks
  if (!promptBox || !button || !status || !img) {
    console.error("Text-to-image elements missing:", {
      promptBox: !!promptBox,
      button: !!button,
      status: !!status,
      img: !!img
    });
    return;
  }

  // Make sure the image tag is ready to show images
  img.style.display = "none";
  img.style.maxWidth = "100%";
  img.style.marginTop = "10px";
  img.alt = "Generated image";

  button.addEventListener("click", async () => {
    const prompt = promptBox.value.trim();

    if (!prompt) {
      status.textContent = "Please enter a prompt first.";
      return;
    }

    status.textContent = "Generating image...";
    img.style.display = "none";
    img.removeAttribute("src");
    button.disabled = true;

    try {
      const res = await fetch("/api/text-to-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      // Read as text first (prevents JSON parse crash if server returns empty/non-json)
      const raw = await res.text();
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (e) {
        throw new Error("Server did not return valid JSON.");
      }

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      // Accept multiple possible field names (in case backend uses a different one)
      const b64 = data.base64 || data.imageBase64 || data.image || null;
      const mime = data.mimeType || data.mime || "image/jpeg";

      if (!b64) {
        status.textContent = data.message || "No image data returned yet.";
        return;
      }

      // Render the image
      img.src = `data:${mime};base64,${b64}`;
      img.style.display = "block";
      status.textContent = "✅ Image generated.";

    } catch (err) {
      console.error(err);
      status.textContent = "Error: " + err.message;
    } finally {
      button.disabled = false;
    }
  });
});



