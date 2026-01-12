import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import multer from "multer";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Path helpers (for ES Modules) ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Middleware ----
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---- Multer (uploads for image->video) ----
const TMP_DIR = os.tmpdir();
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, TMP_DIR),
    filename: (req, file, cb) => {
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}_${Math.random().toString(16).slice(2)}_${safe}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB per image
});

// ---- Health check ----
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    status: "healthy",
    keyPresent: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
  });
});

// ---- Text -> Video (temporary mock implementation) ----
app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = (req.body?.prompt || "").trim();
if (!prompt) {
return res.status(400).json({ ok: false, error: "Missing prompt" });
}

// TEMP MOCK VIDEO (short mp4 hosted publicly)
const demoVideoUrl =
"https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

return res.json({
ok: true,
videoUrl: demoVideoUrl
});

} catch (err) {
console.error("Text-to-Video error:", err);
return res.status(500).json({
ok: false,
error: "Text-to-Video failed"
});
}
});


// ---- Text -> Image (Gemini 3 Pro Image) ----
app.post("/api/text-to-image", async (req, res) => {
  try {
    const prompt = (req.body?.prompt || "").trim();
    if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" });

    const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing API key. Set GOOGLE_API_KEY (or GEMINI_API_KEY) in Render Environment.",
      });
    }

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent";

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        imageConfig: { aspectRatio: "1:1", imageSize: "1024" },
      },
    };

    const apiRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await apiRes.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(500).json({
        ok: false,
        error: "Gemini returned non-JSON response",
        raw: text.slice(0, 400),
      });
    }

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({
        ok: false,
        error: data?.error?.message || data?.error || "Gemini request failed",
        details: data,
      });
    }

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData && p.inlineData.data);

    if (!imagePart) {
      return res.status(500).json({
        ok: false,
        error: "No image returned from model",
        details: data,
      });
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const base64 = imagePart.inlineData.data;

    return res.json({ ok: true, message: "Image generated", mimeType, base64 });
  } catch (err) {
    console.error("text-to-image error:", err);
    return res.status(500).json({ ok: false, error: err.message || "Server error" });
  }
});

// ---- Image -> Video (FFmpeg stitch) ----
// NOTE: This route won't succeed until FFmpeg is installed on Render (we'll do that NEXT step).
app.post("/api/image-to-video", upload.array("images", 20), async (req, res) => {
  const uploaded = req.files || [];
  const secondsPerImage = Number(req.body?.secondsPerImage ?? 1.5);

  if (!uploaded.length) {
    return res.status(400).json({ ok: false, error: "No images uploaded" });
  }
  if (!Number.isFinite(secondsPerImage) || secondsPerImage <= 0 || secondsPerImage > 10) {
    return res.status(400).json({ ok: false, error: "secondsPerImage must be between 0 and 10" });
  }

  const outPath = path.join(TMP_DIR, `out_${Date.now()}_${Math.random().toString(16).slice(2)}.mp4`);

  try {
    const args = ["-y"];
    for (const f of uploaded) {
      args.push("-loop", "1", "-t", String(secondsPerImage), "-i", f.path);
    }

    const n = uploaded.length;
    const filter = `concat=n=${n}:v=1:a=0,format=yuv420p`;

    args.push(
      "-filter_complex",
      filter,
      "-r",
      "30",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outPath
    );

    await new Promise((resolve, reject) => {
      const ff = spawn("ffmpeg", args);

      let errBuf = "";
      ff.stderr.on("data", (d) => (errBuf += d.toString()));

      ff.on("close", (code) => {
        if (code === 0) return resolve();
        reject(new Error(`FFmpeg failed (code ${code}). ${errBuf.slice(-800)}`));
      });
    });

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `inline; filename="slideshow.mp4"`);

    const stream = fs.createReadStream(outPath);
    stream.pipe(res);

    stream.on("close", () => {
      try { fs.unlinkSync(outPath); } catch {}
      for (const f of uploaded) {
        try { fs.unlinkSync(f.path); } catch {}
      }
    });
  } catch (err) {
    console.error("image-to-video error:", err);

    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
    for (const f of uploaded) {
      try { fs.unlinkSync(f.path); } catch {}
    }

    return res.status(500).json({ ok: false, error: err.message || "Server error" });
  }
});

// ---- Fallback to index.html ----
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
