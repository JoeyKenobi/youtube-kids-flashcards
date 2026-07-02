// Content Script for YouTube Kids Flashcards
// Injected into YouTube Kids pages — pauses video and shows flashcard overlay

let intervalTimer = null;
let firstTriggerTimer = null;
let isShowingFlashcard = false;
let currentVideoSrc = null;
let cachedSettings = null;
let lastVideoTime = 0;
let skipCheckInterval = null;

const SKIP_THRESHOLD_SECONDS = 30;

const FIRST_TRIGGER_SECONDS = 15;

// Check if extension context is still valid
function isExtensionValid() {
  try {
    return !!chrome.runtime?.id;
  } catch (e) {
    return false;
  }
}

// Stop all timers and clean up
function cleanup() {
  clearInterval(intervalTimer);
  clearTimeout(firstTriggerTimer);
  clearInterval(skipCheckInterval);
}

// Start monitoring when the page loads
init();

async function init() {
  console.log("[YKF] Content script loaded on:", window.location.href);
  console.log("[YKF] Is iframe:", window !== window.top);
  cachedSettings = await getSettings();
  console.log("[YKF] Settings:", cachedSettings);
  if (cachedSettings.enabled) {
    monitorVideos();
  } else {
    console.log("[YKF] Extension disabled, not monitoring.");
  }

  // Listen for settings changes from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SETTINGS_UPDATED") {
      cachedSettings = message.settings;
      clearInterval(intervalTimer);
      clearTimeout(firstTriggerTimer);
      if (message.settings.enabled) {
        currentVideoSrc = null; // Reset so next video is detected fresh
        monitorVideos();
      }
      sendResponse({ success: true });
    }
  });
}

// Continuously monitor for new videos (handles SPA navigation)
function monitorVideos() {
  // Poll for video source changes — catches new video selections without page reload
  console.log("[YKF] Monitoring for videos...");
  setInterval(() => {
    const video = document.querySelector("video");
    if (!video) return;

    const newSrc = video.currentSrc || video.src;
    if (newSrc && newSrc !== currentVideoSrc) {
      console.log("[YKF] New video detected:", newSrc.substring(0, 80));
      onNewVideo(video, newSrc);
    }
  }, 1000);
}

// Called every time a new video is detected
function onNewVideo(video, src) {
  currentVideoSrc = src;

  // Clear the previous 15-second timer (new video resets it)
  clearTimeout(firstTriggerTimer);

  // Start skip detection for this video
  startSkipDetection(video);

  // Wait for the video to actually start playing, then set the 15-second timer
  if (!video.paused) {
    scheduleFirstFlashcard(video);
  } else {
    video.addEventListener("playing", () => {
      scheduleFirstFlashcard(video);
    }, { once: true });
  }
}

// Detect forward skips of 30+ seconds
function startSkipDetection(video) {
  if (skipCheckInterval) clearInterval(skipCheckInterval);
  lastVideoTime = video.currentTime;

  skipCheckInterval = setInterval(() => {
    if (video.paused || isShowingFlashcard) {
      lastVideoTime = video.currentTime;
      return;
    }

    const timeDiff = video.currentTime - lastVideoTime;

    // If video jumped forward more than the threshold, trigger flashcards
    // (normal playback at 1x would advance ~0.5s per check)
    if (timeDiff > SKIP_THRESHOLD_SECONDS) {
      triggerFlashcard();
    }

    lastVideoTime = video.currentTime;
  }, 500);
}

// Schedule the 15-second first flashcard for a new video
function scheduleFirstFlashcard(video) {
  clearTimeout(firstTriggerTimer);
  console.log(`[YKF] Video playing — scheduling flashcard in ${FIRST_TRIGGER_SECONDS}s`);
  firstTriggerTimer = setTimeout(() => {
    console.log("[YKF] 15s timer fired — triggering flashcard");
    triggerFlashcard();

    // Reset the 5-minute interval so it counts from the first flashcard
    clearInterval(intervalTimer);
    startTimer(cachedSettings.intervalMinutes);
  }, FIRST_TRIGGER_SECONDS * 1000);
}

function startTimer(intervalMinutes) {
  const intervalMs = intervalMinutes * 60 * 1000;
  intervalTimer = setInterval(() => {
    if (!isShowingFlashcard) {
      triggerFlashcard();
    }
  }, intervalMs);
}

async function getSettings() {
  return new Promise((resolve) => {
    if (!isExtensionValid()) { cleanup(); resolve({ enabled: false }); return; }
    try {
      chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (response) => {
        resolve(response || { enabled: false });
      });
    } catch (e) {
      cleanup();
      resolve({ enabled: false });
    }
  });
}

const CORRECT_NEEDED = 5;

async function triggerFlashcard() {
  // Block concurrent sessions
  if (isShowingFlashcard) return;

  // Find the video element on the page
  const video = document.querySelector("video");
  if (!video || video.paused) return;

  // Pause the video
  video.pause();
  isShowingFlashcard = true;

  // Create overlay container
  const overlay = document.createElement("div");
  overlay.id = "ykf-overlay";
  document.body.appendChild(overlay);

  // Run the flashcard loop — must get 5 correct answers
  await runFlashcardSession(overlay, video);
}

async function runFlashcardSession(overlay, video) {
  let correctCount = 0;
  console.log(`[YKF] Starting flashcard session. Need ${CORRECT_NEEDED} correct answers.`);

  while (correctCount < CORRECT_NEEDED) {
    console.log(`[YKF] Fetching question... (${correctCount}/${CORRECT_NEEDED} correct so far)`);
    const flashcard = await getFlashcardWithRetry(5);

    if (!flashcard) {
      console.log("[YKF] WARNING: Could not get flashcard after 5 retries. Keeping session open, retrying in 2s...");
      await delay(2000);
      continue;
    }

    const result = await showQuestion(flashcard, overlay, correctCount);

    // Log the answer
    if (isExtensionValid()) {
      try {
        chrome.runtime.sendMessage({
          type: "LOG_ANSWER",
          data: {
            question: flashcard.question,
            selectedAnswer: result.selectedAnswer,
            correctAnswer: flashcard.options[flashcard.answer],
            isCorrect: result.isCorrect
          }
        });
      } catch (e) {
        // Extension was reloaded — skip logging
      }
    }

    if (result.isCorrect) {
      correctCount++;
      console.log(`[YKF] Correct! Now ${correctCount}/${CORRECT_NEEDED}`);
    } else {
      console.log(`[YKF] Incorrect. Still ${correctCount}/${CORRECT_NEEDED}`);
    }

    // Brief pause between questions
    await delay(result.isCorrect ? 1200 : 1800);
  }

  // Show completion message
  console.log(`[YKF] Session COMPLETE! Got ${correctCount}/${CORRECT_NEEDED} correct.`);
  overlay.innerHTML = "";
  const doneCard = document.createElement("div");
  doneCard.id = "ykf-card";
  doneCard.innerHTML = `
    <h2 id="ykf-question" class="ykf-done-msg">Awesome! You got ${CORRECT_NEEDED} right! 🎉</h2>
    <p class="ykf-resume-msg">Video resuming...</p>
  `;
  overlay.appendChild(doneCard);

  await delay(1500);
  overlay.remove();
  video.play();
  isShowingFlashcard = false;
  lastVideoTime = video.currentTime;
}

function showQuestion(flashcard, overlay, correctSoFar) {
  return new Promise((resolve) => {
    overlay.innerHTML = "";

    // Create flashcard card
    const card = document.createElement("div");
    card.id = "ykf-card";

    // Progress indicator
    const progress = document.createElement("div");
    progress.id = "ykf-progress";
    progress.innerHTML = `
      <span class="ykf-progress-label">Correct: ${correctSoFar}/${CORRECT_NEEDED}</span>
      <div class="ykf-progress-bar">
        <div class="ykf-progress-fill" style="width: ${(correctSoFar / CORRECT_NEEDED) * 100}%"></div>
      </div>
    `;
    card.appendChild(progress);

    // Question
    const question = document.createElement("h2");
    question.id = "ykf-question";
    question.textContent = flashcard.question;
    card.appendChild(question);

    // Options container
    const optionsContainer = document.createElement("div");
    optionsContainer.id = "ykf-options";

    flashcard.options.forEach((optionText, index) => {
      const button = document.createElement("button");
      button.className = "ykf-option-btn";
      button.textContent = optionText;
      button.addEventListener("click", () => {
        const isCorrect = index === flashcard.answer;
        const buttons = optionsContainer.querySelectorAll(".ykf-option-btn");

        // Disable all buttons
        buttons.forEach((btn, i) => {
          btn.disabled = true;
          if (i === flashcard.answer) {
            btn.classList.add("ykf-correct");
          } else if (i === index && !isCorrect) {
            btn.classList.add("ykf-incorrect");
          }
        });

        // Show feedback
        const feedback = document.getElementById("ykf-feedback");
        feedback.textContent = isCorrect ? "Correct! 🎉" : `Nope — it's "${flashcard.options[flashcard.answer]}" 💪`;
        feedback.className = isCorrect ? "ykf-feedback-correct" : "ykf-feedback-incorrect";
        feedback.style.display = "block";

        resolve({
          isCorrect,
          selectedAnswer: optionText
        });
      });
      optionsContainer.appendChild(button);
    });

    card.appendChild(optionsContainer);

    // Feedback area (hidden initially)
    const feedback = document.createElement("div");
    feedback.id = "ykf-feedback";
    card.appendChild(feedback);

    overlay.appendChild(card);
  });
}

// Get a flashcard from background with retries (service worker may be asleep)
async function getFlashcardWithRetry(maxRetries) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (!isExtensionValid()) {
      console.log("[YKF] Extension context invalid, cannot fetch flashcard.");
      return null;
    }

    const flashcard = await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "GET_FLASHCARD" }, (response) => {
          if (chrome.runtime.lastError) {
            console.log("[YKF] sendMessage error:", chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch (e) {
        console.log("[YKF] sendMessage exception:", e.message);
        resolve(null);
      }
    });

    if (flashcard && flashcard.question) {
      return flashcard;
    }

    console.log(`[YKF] Flashcard request returned empty (attempt ${attempt + 1}/${maxRetries}), retrying in 1s...`);
    await delay(1000);
  }
  return null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
