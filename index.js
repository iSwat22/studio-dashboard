import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { spawn } from "child_process";
import multer from "multer";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Path helpers ----
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, "public");
const TMP_DIR = os.tmpdir();

app.use(express.json({ limit: "10mb" }));
app.use(express.static(PUBLIC_DIR));

// ======================================================
// TEXT → IMAGE (Gemini)
// ======================================================
async function generateImage(prompt) {
const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) throw new Error("Missing GOOGLE_API_KEY");

const res = await fetch(
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent",
{
method: "POST",
headers: {
"Content-Type": "application/json",
"x-goog-api-key": API_KEY,
},
body: JSON.stringify({
contents: [{ parts: [{ text: prompt }] }],
}),
}
);

const data = await res.json();
const part = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
if (!part) throw new Error("No image returned");

const buffer = Buffer.from(part.inlineData.data, "base64");
const filePath = path.join(TMP_DIR, `img_${Date.now()}_${Math.random()}.png`);
fs.writeFileSync(filePath, buffer);
return filePath;
}

// ======================================================
// TEXT → VIDEO (REAL FIX – slideshow)
// ======================================================
app.post("/api/text-to-video", async (req, res) => {
try {
const prompt = req.body?.prompt;
if (!prompt) return res.status(400).json({ error: "Missing prompt" });

// 1️⃣ Generate images
const images = [];
for (let i = 0; i < 4; i++) {
images.push(await generateImage(prompt));
}

// 2️⃣ Build FFmpeg slideshow
const outPath = path.join(PUBLIC_DIR, `video_${Date.now()}.mp4`);
const args = ["-y"];

images.forEach(img => {
args.push("-loop", "1", "-t", "1.5", "-i", img);
});

args.push(
"-filter_complex",
`xfade=transition=fade:duration=0.5:offset=1.0`,
"-pix_fmt",
"yuv420p",
"-movflags",
"+faststart",
outPath
);

await new Promise((resolve, reject) => {
const ff = spawn("ffmpeg", args);
ff.on("close", code => (code === 0 ? resolve() : reject()));
});

// 3️⃣ Cleanup temp images
images.forEach(f => fs.unlinkSync(f));

res.json({
ok: true,
videoUrl: `/${path.basename(outPath)}?cb=${Date.now()}`
});
} catch (err) {
console.error(err);
res.status(500).json({ error: "Video generation failed" });
}
});

// ---- SPA fallback ----
app.get("*", (req, res) => {
if (path.extname(req.path)) return res.status(404).send("Not found");
res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.listen(PORT, () => {
console.log(`✅ Server running on port ${PORT}`);
});

