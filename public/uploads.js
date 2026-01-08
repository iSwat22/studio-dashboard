// public/uploads.js
console.log("✅ public/uploads.js loaded");

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("i2vGenerate");
  const status = document.getElementById("i2vStatus");
  const fileInput = document.getElementById("i2vFiles");

  if (!btn || !status || !fileInput) {
    console.log("❌ Missing uploads elements");
    return;
  }

  btn.addEventListener("click", async () => {
    const files = fileInput.files;

    if (!files || files.length === 0) {
      status.textContent = "❌ Please choose at least 1 image.";
      return;
    }

    status.textContent = "Uploading…";
    btn.disabled = true;

    try {
      const form = new FormData();
      for (const f of files) form.append("images", f);

      const res = await fetch("/api/image-to-video", {
        method: "POST",
        body: form
      });

      // Read raw text first so we can show real errors even if backend isn't JSON
      const raw = await res.text();

      let data = null;
      try {
        data = JSON.parse(raw);
      } catch {
        // Backend returned HTML/text (not JSON)
        throw new Error(`Backend returned non-JSON:\n${raw.slice(0, 300)}`);
      }

      // If backend didn't include ok:true, show its message
      if (!res.ok || data.ok !== true) {
        const msg =
          data?.error ||
          data?.message ||
          `Backend response missing ok:true. Got: ${raw.slice(0, 200)}`;
        throw new Error(msg);
      }

      // If your backend returns a URL, show it
      if (data.videoUrl) {
        status.innerHTML = `✅ Video ready: <a href="${data.videoUrl}" target="_blank">Open video</a>`;
      } else if (data.id) {
        status.textContent = `✅ Job started (id: ${data.id}). Backend must return videoUrl when done.`;
      } else {
        status.textContent = "✅ Request succeeded, but no videoUrl returned.";
      }

    } catch (e) {
      console.error(e);
      status.textContent = `❌ ${e.message}`;
    } finally {
      btn.disabled = false;
    }
  });
});


 


