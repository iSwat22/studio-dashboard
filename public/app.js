document.addEventListener("DOMContentLoaded", () => {
  const promptBox = document.querySelector("#t2iPrompt");
  const genBtn = document.querySelector("#t2iGenerate");
  const out = document.querySelector("#t2iOutput");
  const status = document.querySelector("#t2iStatus");

  if (!promptBox || !genBtn || !out) return;

  genBtn.addEventListener("click", async () => {
    const prompt = (promptBox.value || "").trim();

    if (!prompt) {
      alert("Type a prompt first.");
      return;
    }

    genBtn.disabled = true;
    if (status) status.textContent = "Generating...";

    out.innerHTML = "";

    try {
      const r = await fetch("/api/text-to-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await r.json();

      if (!data.ok) {
        console.error(data);
        alert(data.error || "Failed to generate image.");
        return;
      }

      // show first image
      const img = document.createElement("img");
      img.src = data.images[0];
      img.style.maxWidth = "100%";
      img.style.borderRadius = "12px";
      img.style.marginTop = "10px";
      out.appendChild(img);

      if (status) status.textContent = "Done ✅";
    } catch (e) {
      console.error(e);
      alert("Error calling the server. Check Render logs.");
    } finally {
      genBtn.disabled = false;
    }
  });
});

