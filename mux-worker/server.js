import express from "express";
import fs from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const execFileAsync = promisify(execFile);
const app = express();

app.use(express.json({ limit: "50mb" })); // you can adjust

// ✅ ROOT ROUTE (fixes "Cannot GET /")
app.get("/", (req, res) => {
res.status(200).send("🚀 QuanneLeap Mux Worker is LIVE");
});

// ✅ health check
app.get("/health", (req, res) => res.json({ ok: true }));

async function download(url, outPath) {
const resp = await fetch(url);
if (!resp.ok) throw new Error(`Download failed ${resp.status}: ${url}`);
if (!resp.body) throw new Error(`No response body for: ${url}`);

// Node fetch gives a Web ReadableStream -> convert to Node stream
const nodeStream = Readable.fromWeb(resp.body);

await pipeline(nodeStream, fs.createWriteStream(outPath));
}

function safeUnlink(filePath) {
try {
fs.unlinkSync(filePath);
} catch (_) {}
}

app.post("/mux", async (req, res) => {
const ts = Date.now();
const video = `/tmp/video_${ts}.mp4`;
const audio = `/tmp/audio_${ts}.mp3`;
const out = `/tmp/final_${ts}.mp4`;

try {
const { videoUrl, audioUrl } = req.body || {};
if (!videoUrl || !audioUrl) {
return res.status(400).json({ error: "videoUrl and audioUrl required" });
}

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
out,
]);

res.setHeader("Content-Type", "video/mp4");

// Send file then cleanup temp files
return res.sendFile(out, (err) => {
safeUnlink(video);
safeUnlink(audio);
safeUnlink(out);

if (err) {
console.error("sendFile error:", err);
}
});
} catch (err) {
console.error("MUX ERROR:", err);
safeUnlink(video);
safeUnlink(audio);
safeUnlink(out);
return res.status(500).json({ error: err?.message || "Mux failed" });
}
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => console.log("✅ listening on", PORT));

