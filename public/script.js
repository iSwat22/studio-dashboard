document.addEventListener("DOMContentLoaded", () => {
  // ✅ PROOF the JS file is loading
  console.log("✅ script.js loaded");
  alert("✅ script.js loaded"); // temporary - remove after test

  const promptBox = document.getElementById("t2iPrompt");
  const button = document.getElementById("t2iBtn");
  const status = document.getElementById("t2iStatus");

  console.log("promptBox:", !!promptBox, "button:", !!button, "status:", !!status);

  if (!promptBox || !button || !status) {
    alert("❌ Missing HTML IDs (t2iPrompt / t2iBtn / t2iStatus)");
    return;
  }

  button.addEventListener("click", async () => {
    alert("✅ Button click detected"); // proof click works
    status.textContent = "✅ Click worked. Sending request...";

    try {
      const res = await fetch("/api/text-to-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptBox.value.trim() || "test" })
      });

      const text = await res.text(); // safer than res.json for debugging
      status.textContent = `✅ Server replied (${res.status}): ${text}`;
      console.log("Server reply:", text);
    } catch (err) {
      console.error(err);
      status.textContent = "❌ Fetch error: " + err.message;
    }
  });
});


