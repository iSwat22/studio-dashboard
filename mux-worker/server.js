import express from "express";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const app = express();

app.use(express.json({ limit: "5mb" }));

// health check so we can confirm Railway is running
app.get("/health", (req, res) => res.json({ ok: true }));

async function download(url, outPath) {
const res = await fetch(url);
if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);

const file = fs.createWriteStream(outPath);
await new Promise((resolve, reject) => {
res.body.pipe(file);
res.body.on("error", reject);
file.on("finish", resolve);
file.on("error", reject);
});
}

app.post("/mux", async (req, res) => {
try {
const { videoUrl, audioUrl } = req.body || {};
if (!videoUrl || !audioUrl) {
return res.status(400).json({ error: "videoUrl and audioUrl required" });
}

const ts = Date.now();
const video = `/tmp/video_${ts}.mp4`;
const audio = `/tmp/audio_${ts}.mp3`;
const out = `/tmp/final_${ts}.mp4`;

await download(videoUrl, video);
await download(audioUrl, audio);

// mux audio into video
await execFileAsync("ffmpeg", [
"-y",
"-i", video,
"-i", audio,
"-c:v", "copy",
"-c:a", "aac",
"-b:a", "192k",
"-map", "0:v:0",
"-map", "1:a:0",
"-shortest",
out
]);

// return mp4 bytes to caller
res.setHeader("Content-Type", "video/mp4");
res.sendFile(out);
} catch (err) {
console.error("MUX ERROR:", err);
res.status(500).json({ error: err.message || "Mux failed" });
}
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log("✅ listening on", PORT);
