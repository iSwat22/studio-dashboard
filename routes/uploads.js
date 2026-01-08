console.log("✅ uploads.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("i2vFiles");
  const btn = document.getElementById("i2vGenerateBtn");
  const status = document.getElementById("i2vStatus");
  const video = document.getElementById("i2vVideo");

  if (!fileInput || !btn || !status || !video) return;

  btn.addEventListener("click", async () => {
    const files = fileInput.files;

    if (!files || files.length === 0) {
      status.innerHTML = `<span class="bad">✖ Please choose at least 1 image.</span>`;
      return;
    }

    status.textContent = "Uploading images…";
    btn.disabled = true;
    video.style.display = "none";
    video.removeAttribute("src");

    try {
      const form = new FormData();

      // ✅ Field name MUST be "images"
      // If your backend uses upload.array("images"), this will match.
      for (const f of files) {
        form.append("images", f);
      }

      const res = await fetch("/api/image-to-video", {
        method: "POST",
        body: form
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || "Backend error");
      }

      // Try common keys the backend might return
      const url =
        data.videoUrl ||
        data.url ||
        data.path ||
        data.outputUrl ||
        null;

      if (url) {
        video.src = url;
        video.style.display = "block";
        status.innerHTML = `<span class="ok">✔ Video generated</span>`;
      } else {
        status.innerHTML = `<span class="ok">✔ Request sent</span> (No video URL returned yet)`;
      }
    } catch (err) {
      console.error(err);
      status.innerHTML = `<span class="bad">✖ Backend error: ${err.message}</span>`;
    } finally {
      btn.disabled = false;
    }
  });
});
