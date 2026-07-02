// Background Service Worker for YouTube Kids Flashcards
// Manages timers and communicates with content script

// Import question banks
importScripts(
  "data/mathematics.js",
  "data/language-arts.js",
  "data/science.js",
  "data/social-studies.js"
);

// Build flashcard banks from imported data (convert compact format to full format)
function expandQuestions(compactList) {
  return compactList.map((item) => ({
    question: item.q,
    options: item.o,
    answer: item.a
  }));
}

const FLASHCARD_BANKS = {
  mathematics: expandQuestions(MATH_QUESTIONS),
  "language-arts": expandQuestions(LA_QUESTIONS),
  science: expandQuestions(SCIENCE_QUESTIONS),
  "social-studies": expandQuestions(SS_QUESTIONS)
};

// Default settings
const DEFAULT_SETTINGS = {
  intervalMinutes: 5,       // How often to interrupt (in minutes)
  enabled: true,            // Whether interruptions are active
  subjects: ["mathematics", "language-arts", "science", "social-studies"] // Active subjects
};

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get("settings");
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_FLASHCARD") {
    getRandomFlashcard().then(sendResponse);
    return true; // Keep message channel open for async response
  }

  if (message.type === "GET_SETTINGS") {
    chrome.storage.local.get("settings").then((data) => {
      sendResponse(data.settings || DEFAULT_SETTINGS);
    });
    return true;
  }

  if (message.type === "SAVE_SETTINGS") {
    chrome.storage.local.set({ settings: message.settings }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "LOG_ANSWER") {
    logAnswer(message.data).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Get a random flashcard from the selected subjects
async function getRandomFlashcard() {
  const data = await chrome.storage.local.get("settings");
  const settings = data.settings || DEFAULT_SETTINGS;
  const activeSubjects = settings.subjects || Object.keys(FLASHCARD_BANKS);

  // Combine all questions from active subjects
  let pool = [];
  for (const subject of activeSubjects) {
    if (FLASHCARD_BANKS[subject]) {
      pool = pool.concat(FLASHCARD_BANKS[subject]);
    }
  }

  if (pool.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

// Log answer for tracking progress
async function logAnswer(answerData) {
  const data = await chrome.storage.local.get("history");
  const history = data.history || [];
  history.push({
    ...answerData,
    timestamp: Date.now()
  });
  await chrome.storage.local.set({ history });
}
