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
limits: { fileSize: 12 * 1024 * 1024 }, // 12MB
});

// ---- Health check ----
app.get("/api/health", (req, res) => {
res.json({
ok: true,
status: "healthy",
keyPresent: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
});
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

// ✅ Text -> Video (TEMP: return demo.mp4 so UI works now)
app.post("/api/text-to-video", async (req, res) => {
try {
// You can ignore prompt for now. We just prove pipeline works.
const demoPath = path.join(__dirname, "public", "demo.mp4");
if (!fs.existsSync(demoPath)) {
return res.status(404).json({
ok: false,
error: "demo.mp4 not found. Put demo.mp4 inside /public folder.",
});
}

// IMPORTANT: return JSON the frontend expects
return res.json({ ok: true, videoUrl: "/demo.mp4" });
} catch (err) {
console.error("text-to-video error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
});

// ✅ Image -> Video (TEMP: accept both 'image' and 'images', return demo.mp4 for now)
app.post(
"/api/image-to-video",
upload.fields([{ name: "image", maxCount: 1 }, { name: "images", maxCount: 20 }]),
async (req, res) => {
try {
// For now we just return demo.mp4 to prove the UI works
const demoPath = path.join(__dirname, "public", "demo.mp4");
if (!fs.existsSync(demoPath)) {
return res.status(404).json({
ok: false,
error: "demo.mp4 not found. Put demo.mp4 inside /public folder.",
});
}

return res.json({ ok: true, videoUrl: "/demo.mp4" });
} catch (err) {
console.error("image-to-video error:", err);
return res.status(500).json({ ok: false, error: err.message || "Server error" });
}
}
);

// ---- Fallback to index.html ----
app.get("*", (req, res) => {
res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
