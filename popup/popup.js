// Popup script for YouTube Kids Flashcards

const enabledToggle = document.getElementById("enabled-toggle");
const intervalInput = document.getElementById("interval-input");
const saveBtn = document.getElementById("save-btn");
const statusMsg = document.getElementById("status-msg");

// Load current settings on popup open
loadSettings();
loadStats();

async function loadSettings() {
  chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (settings) => {
    if (settings) {
      enabledToggle.checked = settings.enabled;
      intervalInput.value = settings.intervalMinutes;
    }
  });
}

// Save settings
saveBtn.addEventListener("click", () => {
  const settings = {
    enabled: enabledToggle.checked,
    intervalMinutes: parseInt(intervalInput.value, 10) || 5,
    subjects: ["mathematics", "language-arts", "science", "social-studies"]
  };

  chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings }, (response) => {
    if (response && response.success) {
      // Notify the content script about updated settings
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: "SETTINGS_UPDATED",
            settings
          }).catch(() => {
            // Tab might not be YouTube Kids — that's fine
          });
        }
      });

      statusMsg.textContent = "Settings saved!";
      setTimeout(() => {
        statusMsg.textContent = "";
      }, 2000);
    }
  });
});

// Load recent answer history
async function loadStats() {
  const data = await chrome.storage.local.get("history");
  const history = data.history || [];
  const statsContent = document.getElementById("stats-content");

  if (history.length === 0) {
    statsContent.innerHTML = "<p>No activity yet.</p>";
    return;
  }

  // Show last 10 answers and overall stats
  const total = history.length;
  const correct = history.filter((h) => h.isCorrect).length;
  const percentage = Math.round((correct / total) * 100);

  const recent = history.slice(-5).reverse();
  let html = `<p><strong>${correct}/${total}</strong> correct (${percentage}%)</p>`;

  recent.forEach((entry) => {
    const icon = entry.isCorrect ? "✅" : "❌";
    const cls = entry.isCorrect ? "stat-correct" : "stat-incorrect";
    html += `<p class="${cls}">${icon} ${entry.question}</p>`;
  });

  statsContent.innerHTML = html;
}
