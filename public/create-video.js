<!-- ✅ PAGE CONTENT (KEEP OLD WORKING IDs) -->
<div class="container">
<h1 class="headline">Text → Video</h1>
<p class="subhead">Generate short video clips from prompts. (Using <strong>/api/text-to-video</strong>)</p>

<div class="createGrid">

<!-- LEFT: Prompt -->
<section class="panel">
<div class="panelTitle">Prompt + Theme</div>

<label for="t2vPrompt">Prompt</label>
<textarea
id="t2vPrompt"
class="promptBox"
placeholder='Example: "A Pixar-style futuristic hero team landing on a rooftop at sunset, cinematic lighting, smooth camera move"'
></textarea>

<div class="panelActions">
<!-- optional UI buttons (do NOT affect your video logic) -->
<button type="button" class="pill btn" onclick="document.getElementById('t2vPrompt').value='';">
Clear
</button>
<button type="button" class="pill btn" onclick="navigator.clipboard.readText().then(t=>{document.getElementById('t2vPrompt').value=t || ''});">
Paste
</button>
</div>

<div class="tinyNote">
Tip: Keep it short and clear. You can refine after the first clip.
</div>
</section>

<!-- MIDDLE: Preview -->
<section class="panel">
<div class="panelTitle">Preview</div>

<video
id="t2vVideo"
class="result-preview"
controls
playsinline
style="display:none; width:100%; border-radius:14px;"
></video>

<div id="t2vStatus" class="help-text" style="margin-top:10px;">
Your generated video will appear here.
</div>

<!-- keep these (your script may show them later) -->
<div class="panelActions" style="margin-top:12px;">
<button id="saveToAssetsBtn" type="button" class="pill btn" style="display:none;">
⭐ Save to Assets
</button>

<a id="downloadBtn" class="pill btn" href="#" download style="display:none;">
Download
</a>

<button id="deleteBtn" type="button" class="pill btn" style="display:none;">
Delete
</button>
</div>
</section>

<!-- RIGHT: Settings + Generate -->
<section class="panel">
<div class="panelTitle">Settings</div>

<div class="field">
<label for="t2vAspect">Aspect Ratio</label>
<select id="t2vAspect">
<option value="16:9" selected>YouTube (16:9)</option>
<option value="9:16">YouTube Shorts (9:16)</option>
<option value="1:1">Square (1:1)</option>
</select>
</div>

<div class="field">
<label for="t2vDuration">Clip Length</label>
<select id="t2vDuration">
<option value="8" selected>8 seconds</option>
<option value="10">10 seconds</option>
<option value="15">15 seconds</option>
<option value="30">30 seconds</option>
<option value="60">60 seconds</option>
<option value="120">2 min</option>
<option value="300">5 min</option>
</select>
</div>

<!-- optional UI only (doesn't break anything if your script ignores it) -->
<div class="field">
<label for="t2vQuality">Quality</label>
<select id="t2vQuality" disabled>
<option selected>High</option>
</select>
<div class="tinyNote">Quality is controlled server-side right now.</div>
</div>

<!-- ✅ KEEP THIS ID — your script uses it -->
<button id="t2vBtn" type="button" class="cta" style="width:100%; margin-top:14px;">
Generate
</button>

<!-- optional -->
<button type="button" class="pill btn" style="width:100%; margin-top:10px; opacity:.6;" disabled>
Next
</button>
</section>

</div>
</div>
