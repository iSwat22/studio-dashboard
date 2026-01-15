// ======================
// STATE
// ======================
let selectedModes = [];
let selectedThemes = [];
let selectedStyles = [];

// ======================
// HELPERS
// ======================
function toggleSelection(arr, value) {
const i = arr.indexOf(value);
if (i === -1) arr.push(value);
else arr.splice(i, 1);
}

function saveAndGo() {
if (
selectedModes.length === 0 &&
selectedThemes.length === 0 &&
selectedStyles.length === 0
) {
alert("Pick at least one option.");
return;
}

localStorage.setItem("ql_modes", JSON.stringify(selectedModes));
localStorage.setItem("ql_themes", JSON.stringify(selectedThemes));
localStorage.setItem("ql_styles", JSON.stringify(selectedStyles));

window.location.href = "create.html";
}

// ======================
// MODE LOGIC
// ======================
document.querySelectorAll(".modeCard").forEach(card => {
card.addEventListener("click", () => {
const mode = card.dataset.mode;
selectedModes = [mode]; // ONE mode only
localStorage.setItem("ql_modes", JSON.stringify(selectedModes));
window.location.href = "create.html";
});
});

// ======================
// GO BUTTON
// ======================
document.getElementById("goCreateBtn").addEventListener("click", saveAndGo);





