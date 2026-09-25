import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-database.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCVMrnHy7S6B0fi4g5yforJupRVvSBgPNw',
  authDomain: 'our-web19.firebaseapp.com',
  databaseURL: 'https://our-web19-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'our-web19',
  storageBucket: 'our-web19.firebasestorage.app',
  messagingSenderId: '554379671267',
  appId: '1:554379671267:web:26b9ef61465fc4ff8ff7d6',
  measurementId: 'G-YGH3E3VFR1'
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

const app = {
  biblePath: 'RVR1960-Spanish.json',
  anniversaryDate: getNextAnniversaryDate(),
  countdownIntervalId: null,
  flattenedBibleVerses: null,
  poems: [],
  poemsRef: ref(database, 'poems'),
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
  loadPoems();
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
  if (sectionName === 'poems') schedulePoemTextareasResize();
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






function loadPoems() {
  showPoemsStatus('Loading poems...');

  onValue(
    app.poemsRef,
    (snapshot) => {
      app.poems = normaliseRemotePoems(snapshot.val());
      renderPoems();
    },
    (error) => {
      console.error('Firebase poems listener failed:', error);
      showPoemsStatus('Poems cannot load yet. Check the Firebase Realtime Database rules.');
    }
  );
}

/**
 * Firebase stores poems as an object keyed by database id. This turns it into
 * a sorted array and always adds exactly one local blank notepad at the end.
 */
function normaliseRemotePoems(value) {
  const savedPoems = Object.entries(value || {})
    .map(([firebaseKey, poem]) => ({
      firebaseKey,
      date: typeof poem.date === 'string' ? poem.date : getLocalDateKey(new Date()),
      content: typeof poem.content === 'string' ? poem.content : '',
      createdAt: poem.createdAt || 0,
      updatedAt: poem.updatedAt || 0,
      isDraft: false
    }))
    .filter((poem) => poem.content.trim())
    .sort((a, b) => {
      const dateDifference = b.date.localeCompare(a.date);
      const updatedDifference = Number(b.updatedAt || 0) - Number(a.updatedAt || 0);

      return dateDifference || updatedDifference || b.firebaseKey.localeCompare(a.firebaseKey);
    });

  return [...savedPoems, createBlankPoem()];
}

function renderPoems() {
  const focusedKey = document.activeElement?.closest?.('.poems-notepad')?.dataset.poemKey;
  const focusedSelection = getFocusedTextareaSelection();

  app.elements.poemsBoard.replaceChildren(...app.poems.map(createPoem));

  restoreFocusedTextarea(focusedKey, focusedSelection);
  schedulePoemTextareasResize();
}

function showPoemsStatus(message) {
  app.elements.poemsBoard.replaceChildren();

  const status = document.createElement('p');
  status.className = 'poems-status';
  status.textContent = message;
  app.elements.poemsBoard.append(status);
}

function getFocusedTextareaSelection() {
  if (!document.activeElement?.classList?.contains('poem-text')) return null;

  return {
    start: document.activeElement.selectionStart,
    end: document.activeElement.selectionEnd
  };
}

function restoreFocusedTextarea(poemKey, selection) {
  if (!poemKey) return;

  const textarea = app.elements.poemsBoard.querySelector(`[data-poem-key="${poemKey}"] .poem-text`);
  if (!textarea) return;

  textarea.focus();
  if (selection) {
    textarea.setSelectionRange(selection.start, selection.end);
  }
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function resizeAllPoemTextareas() {
  app.elements.poemsBoard.querySelectorAll('.poem-text').forEach(autoResize);
}

function schedulePoemTextareasResize() {
  requestAnimationFrame(() => {
    resizeAllPoemTextareas();

    // Fonts and mobile browser viewport changes can finish a moment after the
    // first paint, so run one more pass to keep saved poems fully open.
    window.setTimeout(resizeAllPoemTextareas, 80);
  });
}

function createPoem(poem) {
  const article = document.createElement('article');
  article.className = 'poems-notepad';
  article.dataset.poemKey = poem.firebaseKey;
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
  text.placeholder = 'Write a new poem...';
  text.setAttribute('aria-label', 'Poem text');

  scheduleTextareaResize(text);

  text.addEventListener('input', () => {
    poem.content = text.value;
    autoResize(text);

    if (poem.isDraft && poem.content.trim()) {
      void promoteDraftPoem(poem, article);
      return;
    }

    if (!poem.isDraft && !poem.content.trim()) {
      window.clearTimeout(app.poemSyncTimers.get(poem.firebaseKey));
      void removePoem(poem);
      return;
    }

    queuePoemSave(poem);
  });

  date.addEventListener('input', () => {
    poem.date = date.value || getLocalDateKey(new Date());

    if (poem.isDraft && poem.content.trim()) {
      void promoteDraftPoem(poem, article);
      return;
    }

    if (!poem.isDraft) queuePoemSave(poem);
  });

  article.append(date, text);
  return article;
}

function scheduleTextareaResize(textarea) {
  requestAnimationFrame(() => {
    autoResize(textarea);
    window.setTimeout(() => autoResize(textarea), 80);
  });
}

async function promoteDraftPoem(poem, article) {
  if (poem.isSaving || !poem.content.trim()) return;

  poem.isSaving = true;
  const newPoemRef = push(app.poemsRef);
  poem.firebaseKey = newPoemRef.key;
  poem.isDraft = false;
  article.dataset.poemKey = poem.firebaseKey;
  article.classList.remove('poem-draft');

  addBlankPoem();

  try {
    await set(newPoemRef, {
      date: poem.date || getLocalDateKey(new Date()),
      content: poem.content.trimEnd(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Poem could not be created in Firebase:', error);
    showPoemsStatus('The poem could not be saved. Check Firebase rules and try again.');
  } finally {
    poem.isSaving = false;
  }
}

function queuePoemSave(poem) {
  if (poem.isDraft || !poem.firebaseKey) return;

  window.clearTimeout(app.poemSyncTimers.get(poem.firebaseKey));
  const timer = window.setTimeout(() => void syncPoem(poem), 650);
  app.poemSyncTimers.set(poem.firebaseKey, timer);
}

async function syncPoem(poem) {
  if (poem.isDraft || poem.isSaving || !poem.firebaseKey) return;

  const content = poem.content.trimEnd();
  if (!content.trim()) {
    await removePoem(poem);
    return;
  }

  poem.isSaving = true;

  try {
    await update(ref(database, `poems/${poem.firebaseKey}`), {
      date: poem.date || getLocalDateKey(new Date()),
      content,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Poem could not be saved to Firebase:', error);
  } finally {
    poem.isSaving = false;
  }
}

async function removePoem(poem) {
  if (!poem.firebaseKey) return;

  try {
    await remove(ref(database, `poems/${poem.firebaseKey}`));
  } catch (error) {
    console.error('Poem could not be removed from Firebase:', error);
  }
}

function addBlankPoem() {
  if (app.poems.some((poem) => poem.isDraft)) return;

  const poem = createBlankPoem();
  app.poems.push(poem);
  app.elements.poemsBoard.append(createPoem(poem));
}

function createBlankPoem() {
  return {
    firebaseKey: `draft-${crypto.randomUUID()}`,
    date: getLocalDateKey(new Date()),
    content: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isDraft: true,
    isSaving: false
  };
}
