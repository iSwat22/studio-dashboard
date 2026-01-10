// ---- Text -> Video (FORCED DEMO TEST) ----
app.post("/api/text-to-video", async (req, res) => {
try {
const videoPath = path.join(__dirname, "public", "demo.mp4");

if (!fs.existsSync(videoPath)) {
return res.status(404).json({
ok: false,
error: "demo.mp4 not found in /public"
});
}

return res.json({
ok: true,
videoUrl: "/demo.mp4"
});
} catch (err) {
console.error("text-to-video error:", err);
return res.status(500).json({
ok: false,
error: "Text-to-video failed"
});
}
});
