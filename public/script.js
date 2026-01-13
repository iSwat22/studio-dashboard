<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Text → Video • QuannaLeap.AI</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="./style.css" />
</head>

<body class="bg-stars" data-mode="text-to-video">
<!-- TOPBAR -->
<header class="topbar">
<div class="topbar-left">
<a class="brand" href="./index.html">
<img class="brand-logo" src="./logo.png?v=2" alt="QuannaLeap.AI logo" />
</a>

<nav class="topnav">
<a href="./index.html">🏠 Home</a>
<a href="./assets.html">📁 Assets</a>
<a href="./characters.html">🧍 Characters</a>
</nav>
</div>

<div class="topbar-right">
<div class="pill"><span class="dot dot-green"></span><span>Standard Plan</span></div>
<div class="pill"><span class="star">★</span><span id="creditCount">Unlimited</span></div>
<button class="icon-btn" type="button">🔔</button>
<button class="profile-btn" type="button">
<img src="./images/brand/profile.jpg" alt="Profile" />
</button>
</div>
</header>

<div class="app">
<main class="main">
<div class="page-wrap">

<section class="hero hero-image">
<h1>Text → Video</h1>
<p>Generate videos from prompts. (Using <strong>/api/text-to-video</strong>)</p>
</section>

<section class="create-panel">

<!-- PREVIEW -->
<div class="preview-shell">
<video
id="t2vVideo"
class="result-preview"
controls
playsinline
style="display:none;"
></video>

<div id="t2vStatus" class="help-text">
Your generated video will appear here.
</div>
</div>

<!-- PROMPT -->
<div class="prompt-shell">
<textarea
id="t2vPrompt"
class="prompt-input"
placeholder='Example: "A cinematic 3D city at sunset"'
></textarea>

<div class="actions-row">
<button id="t2vBtn" type="button" class="primary-btn">Generate Video</button>

<a id="downloadBtn" class="ghost-btn" href="#" download style="display:none;">
Download
</a>

<button id="deleteBtn" class="danger-btn" style="display:none;">
Delete
</button>
</div>

<div class="help-text">
Tip: After generating, you can download or delete the video.
</div>
</div>

</section>
</div>
</main>
</div>

<script src="./script.js"></script>
</body>
</html>





