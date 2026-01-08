document.addEventListener("DOMContentLoaded", () => {
  const promptBox = document.getElementById("t2iPrompt");
  const button = document.getElementById("t2iBtn");
  const status = document.getElementById("t2iStatus");
  const img = document.getElementById("t2iImg");

  if (!promptBox || !button) {
    console.error("Text-to-image elements not found");
    return;
  }

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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Generation failed");
      }

      // For now, backend returns placeholder
      // Next step we will return a real image
      status.textContent = data.message || "Request sent successfully.";

      // When real image is returned, this will work automatically
      if (data.base64) {
        img.src = `data:${data.mimeType};base64,${data.base64}`;
        img.style.display = "block";
      }

    } catch (err) {
      console.error(err);
      status.textContent = "Error: " + err.message;
    } finally {
      button.disabled = false;
    }
  });
});

