// Select required DOM elements
const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

/**
 * Updates both counters and the warning/over classes.
 * - Shows "N / 200 characters" and "N words"
 * - Adds "warning" class when over 180 characters and "over" class when over 200 characters
 */
function updateCounts() {
  const text = noteText.value;
  const charLength = text.length;

  // Update character counter
  charCount.textContent = `${charLength} / 200 characters`;

  // Update word counter
  const trimmed = text.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  wordCount.textContent = `${words} words`;

  // Update warning and over classes on the character counter
  if (charLength > 200) {
    charCount.classList.add("over");
    charCount.classList.remove("warning");
  } else if (charLength > 180) {
    charCount.classList.add("warning");
    charCount.classList.remove("over");
  } else {
    charCount.classList.remove("warning", "over");
  }
}

/**
 * Clears the textarea, resets counters, and removes saved draft from localStorage.
 */
function clearEverything() {
  noteText.value = "";
  localStorage.removeItem("draft");
  updateCounts();
}

// 1. Input event: call updateCounts() and save the draft on every input event
noteText.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem("draft", noteText.value);
});

// 2. Clear button: empties textarea, resets counters, removes draft
clearBtn.addEventListener("click", clearEverything);

// 3. Escape key inside textarea: also clears everything
noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearEverything();
  }
});

// 4. Theme toggle button: toggles dark class on <body>, updates label, remembers choice
themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  localStorage.setItem("theme", isDark ? "dark" : "light");
});

/**
 * On page load, restores any saved draft and theme, then calls updateCounts().
 */
function init() {
  // Restore theme preference
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
    themeToggle.textContent = "Light mode";
  } else {
    document.body.classList.remove("dark");
    themeToggle.textContent = "Dark mode";
  }

  // Restore saved draft
  const savedDraft = localStorage.getItem("draft");
  if (savedDraft !== null) {
    noteText.value = savedDraft;
  }

  // Initial calculation of counts and classes
  updateCounts();
}

// Run restoration immediately (script is loaded with defer)
init();
