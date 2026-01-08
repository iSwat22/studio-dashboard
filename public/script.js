document.addEventListener("DOMContentLoaded", () => {
  const promptBox = document.getElementById("t2iPrompt");
  const button = document.getElementById("t2iBtn");
  const status = document.getElementById("t2iStatus");
  const img = document.getElementById("t2iImg");

  if (!promptBox || !button || !status || !img) {
    console.error("Text-to-image elements not found");
    return;
  }

  // Make sure the image is styled/hidden by default
  img.style.display = "none";
  img.style.maxWidth = "100%";
  img.style.borderRadius = "12px";
  img.style.marginTop = "10px";

  button.addEventListener("click", async () => {
    const prompt = promptBox.value.trim();

    if (!prompt) {
      status.textContent = "Please enter a prompt first.";
      return;
    }

    status.textContent = "Generating image...";
    img.style.display = "none";
    button.disabled = true;

    try {
      const res = await fetch("/api/text-to-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });

      // ✅ SAFER: read raw text first
      const raw = await res.text();

      // ✅ SAFER: parse JSON only if it is JSON
      let data = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch (e) {
        throw new Error("Server did not return JSON. Check Render logs.");
      }

      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }

      // ✅ Support URL response
      if (data.imageUrl) {
        img.src = data.imageUrl;
        img.style.display = "block";
        status.textContent = "Done ✅";
        return;
      }

      // ✅ Support base64 response
      if (data.base64) {
        img.src = `data:${data.mimeType || "image/png"};base64,${data.base64}`;
        img.style.display = "block";
        status.textContent = "Done ✅";
        return;
      }

      // If neither exists, tell you clearly
      throw new Error("No image returned. Backend must return imageUrl or base64.");

    } catch (err) {
      console.error(err);
      status.textContent = "Error: " + err.message;
    } finally {
      button.disabled = false;
    }
  });
});


