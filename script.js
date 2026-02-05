// All page elements and settings live in one object so the rest of the code
// can use clear names instead of repeating document.getElementById everywhere.
const app = {
  biblePath: 'RVR1960-Spanish.json',
  anniversaryDate: new Date(Date.UTC(2026, 4, 19, 0, 0, 0)),
  countdownIntervalId: null,
  flattenedBibleVerses: null,
  valentineImageIndex: 0,
  incorrectClickCount: 0,
  valentineImages: [
    'images/valentine1.jpg',
    'images/valentine2.jpg',
    'images/valentine3.jpg'
  ],
  elements: {}
};

document.addEventListener('DOMContentLoaded', initialisePage);

/**
 * Finds every element the JavaScript needs and connects all button actions.
 * Keeping this in one function makes it easier to see how the page starts.
 */
function initialisePage() {
  app.elements = {
    mainButtons: document.getElementById('main-buttons'),
    mainTitle: document.getElementById('main-title'),
    menuButton: document.getElementById('menu'),
    countdownTimer: document.getElementById('countdown-timer'),
    versicleBox: document.getElementById('versicle-box'),

    anniversaryButton: document.getElementById('anniversary-button'),
    versicleButton: document.getElementById('versicle-button'),
    playlistButton: document.getElementById('playlist-button'),
    boardButton: document.getElementById('boardOfDirectors-button'),
    valentineButton: document.getElementById('valentine-button'),
    poemsButton: document.getElementById('poems-button'),
    yesButton: document.getElementById('yes-button'),
    noButton: document.getElementById('no-button'),

    timerSection: document.getElementById('timer-section'),
    versicleSection: document.getElementById('versicle-section'),
    playlistSection: document.getElementById('playlist-section'),
    directorsSection: document.getElementById('directors-section'),
    valentineSection: document.getElementById('valentine-section'),
    poemsSection: document.getElementById('poems-section'),

    poohBackground: document.getElementById('background-pooh'),
    gradientBackground: document.getElementById('background-gradient'),
    anniversaryBackground: document.getElementById('anniversary-background'),
    playlistBackground: document.getElementById('playlist-background'),
    directorsBackground: document.getElementById('boardOfDirectors-background'),
    valentineBackground: document.getElementById('valentine-background'),
    poemsBackground: document.getElementById('poems-background'),

    imageContainer: document.getElementById('image-container'),
    valentineImage: document.getElementById('valentine-image'),
    incorrectMessage: document.getElementById('incorrect-message')
  };

  app.elements.anniversaryButton.addEventListener('click', () => {
    showSection(app.elements.timerSection, app.elements.anniversaryBackground);
    startLiveCountdown();
  });

  app.elements.versicleButton.addEventListener('click', () => {
    showSection(app.elements.versicleSection, app.elements.gradientBackground);
    loadDailyVersicle();
  });

  app.elements.playlistButton.addEventListener('click', () => {
    showSection(app.elements.playlistSection, app.elements.playlistBackground);
  });

  app.elements.boardButton.addEventListener('click', () => {
    showSection(app.elements.directorsSection, app.elements.directorsBackground);
  });

  app.elements.valentineButton.addEventListener('click', () => {
    showSection(app.elements.valentineSection, app.elements.valentineBackground);
  });

  app.elements.poemsButton.addEventListener('click', () => {
    showSection(app.elements.poemsSection, app.elements.poemsBackground);
  });

  app.elements.yesButton.addEventListener('click', showNextValentineImage);
  app.elements.noButton.addEventListener('click', showIncorrectValentineMessage);
  app.elements.menuButton.addEventListener('click', showMainMenu);
}

/**
 * Shows one section and one background, then hides the main menu.
 * This keeps navigation consistent for every feature button.
 */
function showSection(section, background) {
  if (section !== app.elements.timerSection) {
    stopLiveCountdown();
  }

  app.elements.mainButtons.classList.add('hidden');
  app.elements.mainTitle.classList.add('hidden');

  document.querySelectorAll('.section').forEach((pageSection) => {
    pageSection.classList.add('hidden');
  });

  document.querySelectorAll('.background-container div, #poems-background').forEach((pageBackground) => {
    pageBackground.classList.add('hidden');
  });

  section.classList.remove('hidden');
  background.classList.remove('hidden');
}

/**
 * Returns to the first screen, hides every feature section, and restores the
 * original image plus gradient background.
 */
function showMainMenu() {
  stopLiveCountdown();

  app.elements.mainButtons.classList.remove('hidden');
  app.elements.mainTitle.classList.remove('hidden');

  document.querySelectorAll('.section').forEach((pageSection) => {
    pageSection.classList.add('hidden');
  });

  document.querySelectorAll('.background-container div, #poems-background').forEach((pageBackground) => {
    pageBackground.classList.add('hidden');
  });

  app.elements.poohBackground.classList.remove('hidden');
  app.elements.gradientBackground.classList.remove('hidden');
}

/**
 * Starts a live anniversary countdown. If the user opens this section again,
 * the previous timer is stopped first so multiple intervals do not stack up.
 */
function startLiveCountdown() {
  stopLiveCountdown();
  updateCountdownTimer();
  app.countdownIntervalId = window.setInterval(updateCountdownTimer, 1000);
}

/**
 * Stops the countdown interval when the user leaves the anniversary section.
 * This avoids unnecessary work in the background.
 */
function stopLiveCountdown() {
  if (!app.countdownIntervalId) return;

  window.clearInterval(app.countdownIntervalId);
  app.countdownIntervalId = null;
}

/**
 * Calculates the time left until the anniversary and writes it on the page.
 */
function updateCountdownTimer() {
  const millisecondsLeft = app.anniversaryDate - new Date();

  if (millisecondsLeft <= 0) {
    stopLiveCountdown();
    app.elements.countdownTimer.textContent = 'Happy Anniversary! 🎉';
    return;
  }

  const dayMs = 1000 * 60 * 60 * 24;
  const hourMs = 1000 * 60 * 60;
  const minuteMs = 1000 * 60;

  const days = Math.floor(millisecondsLeft / dayMs);
  const hours = Math.floor((millisecondsLeft % dayMs) / hourMs);
  const minutes = Math.floor((millisecondsLeft % hourMs) / minuteMs);
  const seconds = Math.floor((millisecondsLeft % minuteMs) / 1000);

  app.elements.countdownTimer.textContent =
    `${days} ${pluralise('day', days)}, ` +
    `${hours} ${pluralise('hour', hours)}, ` +
    `${minutes} ${pluralise('minute', minutes)}, ` +
    `${seconds} ${pluralise('second', seconds)} left.`;
}

/**
 * Adds an "s" when a number is not 1, so countdown text reads naturally.
 */
function pluralise(word, number) {
  return number === 1 ? word : `${word}s`;
}

/**
 * Loads the Bible JSON, chooses one deterministic "random" verse for the
 * current date, and displays it. The verse changes once per calendar day.
 */
async function loadDailyVersicle() {
  app.elements.versicleBox.textContent = 'Loading today’s verse...';

  try {
    const verses = await getBibleVerses();
    const selectedVerse = getDailyRandomVerse(verses);
    renderVersicle(selectedVerse);
  } catch (error) {
    console.error('Daily verse could not be loaded:', error);
    app.elements.versicleBox.textContent =
      'The daily verse could not load right now. Please check that RVR1960-Spanish.json is beside index.html.';
  }
}

/**
 * Fetches the Bible file once, flattens it into a simple array, and reuses the
 * array on future clicks for better performance.
 */
async function getBibleVerses() {
  if (app.flattenedBibleVerses) return app.flattenedBibleVerses;

  const response = await fetch(app.biblePath);
  if (!response.ok) {
    throw new Error(`Bible request failed with status ${response.status}`);
  }

  const bible = await response.json();
  app.flattenedBibleVerses = flattenBible(bible);
  return app.flattenedBibleVerses;
}

/**
 * Converts the JSON format Book -> Chapter -> Verse -> Text into an array:
 * [{ reference: "Juan 3:16", content: "..." }, ...]
 */
function flattenBible(bible) {
  const verses = [];

  Object.entries(bible).forEach(([bookName, chapters]) => {
    Object.entries(chapters).forEach(([chapterNumber, chapterVerses]) => {
      Object.entries(chapterVerses).forEach(([verseNumber, verseText]) => {
        verses.push({
          reference: `${bookName} ${chapterNumber}:${verseNumber}`,
          content: verseText.trim()
        });
      });
    });
  });

  if (!verses.length) {
    throw new Error('The Bible JSON did not contain any verses.');
  }

  return verses;
}

/**
 * Picks a verse based on today's date. This feels random, but it is stable:
 * refreshing the page on the same day gives the same verse, tomorrow changes.
 */
function getDailyRandomVerse(verses, date = new Date()) {
  const dateKey = getLocalDateKey(date);
  const verseIndex = hashStringToIndex(dateKey, verses.length);
  return verses[verseIndex];
}

/**
 * Formats the date using the visitor's local calendar day instead of UTC.
 */
function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Turns a string into a positive array index. It is fast, deterministic, and
 * good enough for spreading dates across all available verses.
 */
function hashStringToIndex(value, max) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash % max;
}

/**
 * Uses textContent instead of innerHTML so Bible text is inserted safely.
 */
function renderVersicle(verse) {
  app.elements.versicleBox.replaceChildren();

  const title = document.createElement('h3');
  const titleStrong = document.createElement('strong');
  const content = document.createElement('p');

  titleStrong.textContent = verse.reference;
  content.textContent = verse.content;

  title.appendChild(titleStrong);
  app.elements.versicleBox.append(title, content);
}

/**
 * Cycles through the Valentine images every time "Yes" is clicked.
 */
function showNextValentineImage() {
  app.elements.valentineImage.src = app.valentineImages[app.valentineImageIndex];
  app.elements.imageContainer.classList.remove('hidden');
  app.elements.incorrectMessage.classList.add('hidden');
  app.elements.incorrectMessage.classList.remove('incorrect-size');

  app.valentineImageIndex = (app.valentineImageIndex + 1) % app.valentineImages.length;
  app.incorrectClickCount = 0;
}

/**
 * Shows the playful "wrong answer" message and briefly enlarges it.
 */
function showIncorrectValentineMessage() {
  app.elements.incorrectMessage.classList.remove('hidden');
  app.elements.imageContainer.classList.add('hidden');
  app.incorrectClickCount += 1;

  if (app.incorrectClickCount <= 1) {
    app.elements.incorrectMessage.classList.add('incorrect-size');
  }

  window.setTimeout(() => {
    app.elements.incorrectMessage.classList.remove('incorrect-size');
    app.incorrectClickCount = 0;
  }, 300);
}
