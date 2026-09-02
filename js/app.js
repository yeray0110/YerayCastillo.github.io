const app = {
  biblePath: 'RVR1960-Spanish.json',
  poemsPath: 'data/poems.json',
  poemsStorageKey: 'our-web-poems',
  anniversaryDate: getNextAnniversaryDate(),
  countdownIntervalId: null,
  flattenedBibleVerses: null,
  poems: [],
  poemSyncTimers: new Map(),
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
  const now = new Date();
  const millisecondsLeft = app.anniversaryDate - now;

  if (isAnniversaryDay(now)) {
    app.elements.countdownTimer.textContent = 'Happy Anniversary! 🎉';
    return;
  }

  if (millisecondsLeft <= 0) {
    app.anniversaryDate = getNextAnniversaryDate(now);
    updateCountdownTimer();
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
 * Returns the coming 19 November, so the countdown renews automatically
 * every year instead of remaining on an expired date.
 */
function getNextAnniversaryDate(now = new Date()) {
  const anniversary = new Date(now.getFullYear(), 10, 19, 0, 0, 0, 0);
  if (now > anniversary && !isAnniversaryDay(now)) {
    anniversary.setFullYear(anniversary.getFullYear() + 1);
  }
  return anniversary;
}

function isAnniversaryDay(date) {
  return date.getMonth() === 10 && date.getDate() === 19;
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
  const legacyPoems = readLegacyPoems();

  try {
    let poems = await fetchPoems();

    if (!poems.length) {
      await importPoems(await fetchStarterPoems());
      poems = await fetchPoems();
    }

    if (legacyPoems.length) {
      await importPoems(legacyPoems);
      localStorage.removeItem(app.poemsStorageKey);
      poems = await fetchPoems();
    }

    app.poems = poems;
  } catch (error) {
    console.error('Poems could not be loaded from storage:', error);
    app.poems = await fetchStarterPoems();
  }

  normalisePoems();
}

async function fetchPoems() {
  const response = await fetch('/api/poems', { cache: 'no-store' });
  if (!response.ok) throw new Error('Poems request failed');
  const data = await response.json();
  return Array.isArray(data.poems) ? data.poems : [];
}

async function fetchStarterPoems() {
  const response = await fetch(app.poemsPath);
  if (!response.ok) throw new Error('Starter poems request failed');
  return response.json();
}

function readLegacyPoems() {
  try {
    const saved = JSON.parse(localStorage.getItem(app.poemsStorageKey) || '[]');
    return Array.isArray(saved) ? saved.filter(isFilledPoem) : [];
  } catch {
    return [];
  }
}

async function importPoems(poems) {
  const filled = poems.filter(isFilledPoem);
  if (!filled.length) return;

  const response = await fetch('/api/poems/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ poems: filled }),
  });
  if (!response.ok) throw new Error('Poems import failed');
}

function isFilledPoem(poem) {
  return poem && typeof poem.id === 'string' && typeof poem.date === 'string' && typeof poem.content === 'string' && poem.content.trim();
}

function normalisePoems() {
  const savedPoems = app.poems.filter(isFilledPoem).map((poem) => ({ ...poem, isDraft: false }));
  app.poems = [...savedPoems, createBlankPoem()];
}

function renderPoems() {
  app.elements.poemsBoard.replaceChildren(...app.poems.map(createPoem));
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function createPoem(poem) {
  const article = document.createElement('article');
  article.className = 'poems-notepad';
  if (poem.isDraft) article.classList.add('poem-draft');

  const date = document.createElement('input');
  date.type = 'date';
  date.className = 'poem-date';
  date.value = poem.date;
  date.setAttribute('aria-label', 'Poem date');

  const text = document.createElement('textarea');
  text.className = 'poem-text';
  text.value = poem.content;
  text.rows = 1;
  text.placeholder = 'Write a new poem…';
  text.setAttribute('aria-label', 'Poem text');

  requestAnimationFrame(() => autoResize(text));

  text.addEventListener('input', () => {
    poem.content = text.value;
    autoResize(text);

    if (poem.isDraft && poem.content.trim()) {
      poem.isDraft = false;
      poem.isNew = true;
      article.classList.remove('poem-draft');
      addBlankPoem();
    }

    // A cleared note should disappear instead of leaving spare empty cards.
    // The one dedicated draft stays ready for the next poem.
    if (!poem.isDraft && !poem.content.trim()) {
      window.clearTimeout(app.poemSyncTimers.get(poem.id));
      void removeEmptyPoem(poem, article);
      return;
    }

    queuePoemSave(poem, article);
  });

  date.addEventListener('input', () => {
    poem.date = date.value;
    if (poem.content.trim()) queuePoemSave(poem, article);
  });

  article.append(date, text);
  return article;
}

function queuePoemSave(poem, article) {
  window.clearTimeout(app.poemSyncTimers.get(poem.id));
  const timer = window.setTimeout(() => void syncPoem(poem, article), 500);
  app.poemSyncTimers.set(poem.id, timer);
}

async function syncPoem(poem, article) {
  const content = poem.content.trim();

  if (!content && !poem.isDraft) {
    await removeEmptyPoem(poem, article);
    return;
  }

  if (!content || poem.isSaving) return;
  poem.isSaving = true;
  const body = { id: poem.id, date: poem.date, content };
  const endpoint = poem.isNew ? '/api/poems' : `/api/poems/${encodeURIComponent(poem.id)}`;

  try {
    const response = await fetch(endpoint, {
      method: poem.isNew ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error('Poem save failed');

    poem.isNew = false;
  } catch (error) {
    console.error('Poem could not be saved:', error);
  } finally {
    poem.isSaving = false;
    if (poem.content.trim() !== content) queuePoemSave(poem, article);
  }
}

async function removeEmptyPoem(poem, article) {
  try {
    const response = await fetch(`/api/poems/${encodeURIComponent(poem.id)}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Poem delete failed');
    app.poems = app.poems.filter((item) => item !== poem);
    article.remove();
    addBlankPoem();
  } catch (error) {
    console.error('Empty poem could not be removed:', error);
  }
}

function addBlankPoem() {
  if (app.poems.some((poem) => poem.isDraft)) return;
  const poem = createBlankPoem();
  app.poems.push(poem);
  app.elements.poemsBoard.appendChild(createPoem(poem));
}

function createBlankPoem() {
  return {
    id: crypto.randomUUID(),
    date: getLocalDateKey(new Date()),
    content: '',
    isDraft: true,
    isNew: false,
  };
}
