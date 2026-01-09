console.log("✅ app.js loaded");

function tryLoadHoverVideos() {
const videos = document.querySelectorAll("video.card-video");

videos.forEach((v) => {
const src = v.getAttribute("data-src");
if (!src) return;

const card = v.closest(".card");
if (!card) return;

card.addEventListener("mouseenter", () => {
// load video only once, on first hover
if (!v.src) v.src = src;

v.style.opacity = "1";
v.play().catch(() => {});
});

card.addEventListener("mouseleave", () => {
v.style.opacity = "0";
v.pause();
v.currentTime = 0;
});
});
}

document.addEventListener("DOMContentLoaded", tryLoadHoverVideos);
