import express from "express";
import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

const execFileAsync = promisify(execFile);
const app = express();

app.use(express.json({ limit: "50mb" }));

// ✅ CORS (so QuanneLeap UI can call this service)
app.use((req, res, next) => {
res.setHeader("Access-Control-Allow-Origin", "*"); // tighten later
res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
if (req.method === "OPTIONS") return res.sendStatus(204);
next();
});

// ✅ Root route (fixes "Cannot GET /")
app.get("/", (req, res) => {
res.status(200).send("🚀 QuanneLeap Mux Worker is LIVE");
});

// ✅ Health check
app.get("/health", (req, res) => res.json({ ok: true }));

// ✅ Helpful message if someone opens /mux in browser
app.get("/mux", (req, res) => {
res
.status(200)
.send('POST /mux with JSON: {"videoUrl":"...mp4","audioUrl":"...mp3"}');
});

function ensureTmp() {
try {
fs.mkdirSync("/tmp", { recursive: true });
} catch {}
}

function safeUnlink(p) {
try {
fs.unlinkSync(p);
} catch {}
}

async function download(url, outPath) {
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 120000); // 120s

let resp;
try {
resp = await fetch(url, { signal: controller.signal });
} finally {
clearTimeout(timeout);
}

if (!resp.ok) throw new Error(`Download failed ${resp.status}: ${url}`);
if (!resp.body) throw new Error(`No response body for: ${url}`);

// Node fetch returns a Web ReadableStream → convert to Node stream
const nodeStream = Readable.fromWeb(resp.body);
await pipeline(nodeStream, fs.createWriteStream(outPath));
}

app.post("/mux", async (req, res) => {
ensureTmp();

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

// Mux audio into video
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

res.setHeader("Content-Type", "video/mp4");
res.setHeader("Content-Disposition", 'inline; filename="final.mp4"');

const absOut = path.resolve(out);

return res.sendFile(absOut, (err) => {
safeUnlink(video);
safeUnlink(audio);
safeUnlink(out);
if (err) console.error("sendFile error:", err);
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

