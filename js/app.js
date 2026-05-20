const app = {
  biblePath: 'RVR1960-Spanish.json',
  poemsPath: 'data/poems.json',
  poemsStorageKey: 'our-web-poems',
  anniversaryDate: new Date(Date.UTC(2026, 4, 19, 0, 0, 0)),
  countdownIntervalId: null,
  flattenedBibleVerses: null,
  poems: [],
  elements: {}
};

const sectionFiles = [
  'sections/timer.html',
  'sections/versicle.html',
  'sections/playlist.html',
  'sections/directors.html',
  'sections/poems.html'
];

document.addEventListener('DOMContentLoaded', initialisePage);

/**
 * Loads the section files first, then collects elements and connects events.
 * This keeps index.html small while still working on GitHub Pages.
 */
async function initialisePage() {
  await loadSectionPartials();
  cacheElements();
  bindNavigation();
  await loadPoems();
  renderPoems();
  observePoemScrollEnd();
}

/**
 * Fetches every HTML partial from /sections and injects it into the page.
 */
async function loadSectionPartials() {
  const sectionsRoot = document.getElementById('sections-root');
  const sectionMarkup = await Promise.all(
    sectionFiles.map(async (filePath) => {
      const response = await fetch(filePath);
      if (!response.ok) throw new Error(`Could not load ${filePath}`);
      return response.text();
    })
  );

  sectionsRoot.innerHTML = sectionMarkup.join('\n');
}

/**
 * Stores reused DOM elements in one object so functions stay readable.
 */
function cacheElements() {
  app.elements = {
    homeSection: document.getElementById('home-section'),
    menuButton: document.getElementById('menu'),
    countdownTimer: document.getElementById('countdown-timer'),
    versicleBox: document.getElementById('versicle-box'),
    poemsBoard: document.getElementById('poems-board'),
    poemScrollSentinel: document.getElementById('poem-scroll-sentinel'),

    sections: {
      timer: document.getElementById('timer-section'),
      versicle: document.getElementById('versicle-section'),
      playlist: document.getElementById('playlist-section'),
      directors: document.getElementById('directors-section'),
      poems: document.getElementById('poems-section')
    },

    backgrounds: {
      homeImage: document.getElementById('background-pooh'),
      homeGradient: document.getElementById('background-gradient'),
      timer: document.getElementById('anniversary-background'),
      versicle: document.getElementById('background-gradient'),
      playlist: document.getElementById('playlist-background'),
      directors: document.getElementById('board-background'),
      poems: document.getElementById('background-gradient')
    }
  };
}

/**
 * Connects menu buttons through data-section, so adding/removing sections only
 * needs a small HTML change instead of new event-listener code.
 */
function bindNavigation() {
  document.querySelectorAll('[data-section]').forEach((button) => {
    button.addEventListener('click', () => {
      showSection(button.dataset.section);
    });
  });

  app.elements.menuButton.addEventListener('click', showMainMenu);
}

/**
 * Shows one feature section and the matching background.
 */
function showSection(sectionName) {
  if (sectionName !== 'timer') stopLiveCountdown();

  app.elements.homeSection.classList.add('hidden');
  hideAllSections();
  hideAllBackgrounds();

  app.elements.sections[sectionName].classList.remove('hidden');
  app.elements.backgrounds[sectionName].classList.remove('hidden');

  if (sectionName === 'timer') startLiveCountdown();
  if (sectionName === 'versicle') loadDailyVersicle();
}

/**
 * Returns to the welcome screen and restores the home background layers.
 */
function showMainMenu() {
  stopLiveCountdown();
  hideAllSections();
  hideAllBackgrounds();

  app.elements.homeSection.classList.remove('hidden');
  app.elements.backgrounds.homeImage.classList.remove('hidden');
  app.elements.backgrounds.homeGradient.classList.remove('hidden');
}

function hideAllSections() {
  Object.values(app.elements.sections).forEach((section) => {
    section.classList.add('hidden');
  });
}

function hideAllBackgrounds() {
  document.querySelectorAll('.background-layer').forEach((background) => {
    background.classList.add('hidden');
  });
}

/**
 * Starts the anniversary timer and prevents duplicate intervals.
 */
function startLiveCountdown() {
  stopLiveCountdown();
  updateCountdownTimer();
  app.countdownIntervalId = window.setInterval(updateCountdownTimer, 1000);
}

function stopLiveCountdown() {
  if (!app.countdownIntervalId) return;
  window.clearInterval(app.countdownIntervalId);
  app.countdownIntervalId = null;
}

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

function pluralise(word, number) {
  return number === 1 ? word : `${word}s`;
}

/**
 * Loads the Bible, chooses one stable random verse for today, and displays it.
 */
async function loadDailyVersicle() {
  app.elements.versicleBox.textContent = 'Loading today’s verse...';

  try {
    const verses = await getBibleVerses();
    renderVersicle(getDailyRandomVerse(verses));
  } catch (error) {
    console.error('Daily verse could not be loaded:', error);
    app.elements.versicleBox.textContent =
      'The daily verse could not load right now. Please check the Bible JSON file.';
  }
}

/**
 * Reads the large Bible JSON once and caches the flattened result in memory.
 */
async function getBibleVerses() {
  if (app.flattenedBibleVerses) return app.flattenedBibleVerses;

  const response = await fetch(app.biblePath);
  if (!response.ok) throw new Error(`Bible request failed with ${response.status}`);

  app.flattenedBibleVerses = flattenBible(await response.json());
  return app.flattenedBibleVerses;
}

/**
 * Converts Book -> Chapter -> Verse -> Text into an easy-to-render array.
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

  if (!verses.length) throw new Error('The Bible JSON did not contain verses.');
  return verses;
}

/**
 * The date hash makes the verse feel random while staying the same all day.
 */
function getDailyRandomVerse(verses, date = new Date()) {
  return verses[hashStringToIndex(getLocalDateKey(date), verses.length)];
}

function getLocalDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashStringToIndex(value, max) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % max;
}

function renderVersicle(verse) {
  app.elements.versicleBox.replaceChildren();

  const title = document.createElement('h3');
  const content = document.createElement('p');

  title.textContent = verse.reference;
  content.textContent = verse.content;
  app.elements.versicleBox.append(title, content);
}

async function loadPoems() {
  const savedPoems = localStorage.getItem(app.poemsStorageKey);

  if (savedPoems) {
    app.poems = JSON.parse(savedPoems);

    normalisePoems();
    savePoems();

    return;
  }

  const response = await fetch(app.poemsPath);

  if (!response.ok) {
    throw new Error(`Could not load ${app.poemsPath}`);
  }

  app.poems = await response.json();

  normalisePoems();
  savePoems();
}

function normalisePoems() {
  const filledPoems = app.poems.filter(
    (poem) => poem.content.trim()
  );

  const blankPoem =
    app.poems.find((poem) => !poem.content.trim()) ||
    createBlankPoem();

  app.poems = [...filledPoems, blankPoem];
}

function savePoems() {
  localStorage.setItem(
    app.poemsStorageKey,
    JSON.stringify(app.poems)
  );
}

function renderPoems() {
  app.elements.poemsBoard.innerHTML = '';

  app.poems.forEach((poem) => {
    const note = createPoemNotepad(poem);

    app.elements.poemsBoard.appendChild(note);
  });
}

function createPoemNotepad(poem) {
  const article = document.createElement('article');
  const dateInput = document.createElement('input');
  const textArea = document.createElement('textarea');

  article.className = 'poems-notepad';

  dateInput.className = 'poem-date';
  dateInput.type = 'date';
  dateInput.value = poem.date;

  textArea.className = 'poem-text';
  textArea.value = poem.content;

  textArea.rows = 1;

  const resize = () => {
    textArea.style.height = '0px';
    textArea.style.height = textArea.scrollHeight + 'px';
  };

  resize();

  requestAnimationFrame(resize);

  setTimeout(resize, 0);

  textArea.addEventListener('input', () => {
    poem.content = textArea.value;

    resize();

    savePoems();

    const isLast =
      poem === app.poems[app.poems.length - 1];

    if (isLast && poem.content.trim()) {
      addBlankPoem();
    }
  });

  window.addEventListener('resize', resize);

  dateInput.addEventListener('input', () => {
    poem.date = dateInput.value;

    savePoems();
  });

  article.append(dateInput, textArea);

  return article;
}

function addBlankPoem() {
  const lastPoem =
    app.poems[app.poems.length - 1];

  if (
    lastPoem &&
    !lastPoem.content.trim()
  ) {
    return;
  }

  const poem = createBlankPoem();

  app.poems.push(poem);

  savePoems();

  const note = createPoemNotepad(poem);

  app.elements.poemsBoard.appendChild(note);
}

function createBlankPoem() {
  return {
    id: `poem-${Date.now()}`,
    date: getLocalDateKey(new Date()),
    content: ''
  };
}