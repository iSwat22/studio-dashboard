console.log("✅ uploads.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("i2vGenerate");
  const status = document.getElementById("i2vStatus");
  const fileInput = document.getElementById("i2vFiles");
  const video = document.getElementById("i2vVideo");

  if (!btn || !status || !fileInput) {
    console.error("❌ Missing uploads elements", { btn, status, fileInput });
    return;
  }

  btn.addEventListener("click", async () => {
    console.log("🟦 Generate Video clicked");

    const files = fileInput.files;

    if (!files || files.length === 0) {
      status.textContent = "❌ Please choose at least 1 image.";
      return;
    }

    status.textContent = "Uploading images…";
    btn.disabled = true;
    if (video) video.style.display = "none";

    try {
      const form = new FormData();
      for (const f of files) form.append("images", f); // <-- field name is "images"

      const res = await fetch("/api/image-to-video", {
        method: "POST",
        body: form
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Backend error (${res.status})`);
      }

      // If backend returns a URL for the video:
      if (data.videoUrl && video) {
        video.src = data.videoUrl;
        video.style.display = "block";
      }

      status.textContent = "✅ Video request sent / created";

    } catch (err) {
      console.error("❌ Upload error:", err);
      status.textContent = "❌ " + (err.message || "Backend error");
    } finally {
      btn.disabled = false;
    }
  });
});


