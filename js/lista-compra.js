import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getDatabase,
  onValue,
  ref,
  set
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

const ingredientStorageKey = 'mi-lista-de-ingredientes-v1';

const appState = {
  ingredients: [],
  ingredientsRef: ref(database, 'shoppingList/ingredients'),
  hasMigratedLocalIngredients: false,
  isSaving: false,
  elements: {},
  toastTimer: null
};

document.addEventListener('DOMContentLoaded', initialiseShoppingList);

function initialiseShoppingList() {
  appState.elements = {
    addForm: document.getElementById('add-ingredient-form'),
    nameInput: document.getElementById('ingredient-name'),
    unitInput: document.getElementById('ingredient-unit'),
    ingredientList: document.getElementById('ingredient-list'),
    ingredientCount: document.getElementById('ingredient-count'),
    shoppingList: document.getElementById('shopping-list'),
    shoppingSummary: document.getElementById('shopping-summary'),
    clearQuantities: document.getElementById('clear-quantities'),
    copyButton: document.getElementById('copy-list'),
    backupButton: document.getElementById('backup-button'),
    restoreInput: document.getElementById('restore-input'),
    toast: document.getElementById('toast'),
    emptyIngredients: document.getElementById('empty-ingredients-template'),
    emptyShopping: document.getElementById('empty-shopping-template')
  };

  bindShoppingEvents();
  listenIngredients();
  renderShoppingApp();
}

function bindShoppingEvents() {
  appState.elements.addForm.addEventListener('submit', addIngredient);
  appState.elements.ingredientList.addEventListener('input', updateQuantity);
  appState.elements.ingredientList.addEventListener('click', handleIngredientAction);
  appState.elements.shoppingList.addEventListener('change', toggleShoppingItem);
  appState.elements.clearQuantities.addEventListener('click', clearQuantities);
  appState.elements.copyButton.addEventListener('click', copyShoppingList);
  appState.elements.backupButton.addEventListener('click', downloadBackup);
  appState.elements.restoreInput.addEventListener('change', restoreBackup);
}

function listenIngredients() {
  onValue(
    appState.ingredientsRef,
    async (snapshot) => {
      const remoteIngredients = normaliseRemoteIngredients(snapshot.val());

      if (!remoteIngredients.length && !appState.hasMigratedLocalIngredients) {
        const legacyIngredients = readLocalIngredients();
        appState.hasMigratedLocalIngredients = true;

        if (legacyIngredients.length) {
          appState.ingredients = legacyIngredients;
          await saveIngredients();
          localStorage.removeItem(ingredientStorageKey);
          return;
        }
      }

      appState.ingredients = remoteIngredients;
      renderShoppingApp();
    },
    (error) => {
      console.error('The shopping list could not connect to Firebase.', error);
      showToast('No se pudo conectar con Firebase.');
    }
  );
}

function readLocalIngredients() {
  try {
    const savedIngredients = JSON.parse(localStorage.getItem(ingredientStorageKey));
    if (!Array.isArray(savedIngredients)) return [];

    return normaliseIngredientArray(savedIngredients);
  } catch (error) {
    console.warn('The ingredient list could not be read.', error);
    return [];
  }
}

function normaliseRemoteIngredients(value) {
  return normaliseIngredientArray(Object.values(value || {}));
}

function normaliseIngredientArray(ingredients) {
  return ingredients
    .filter((ingredient) => ingredient && typeof ingredient.name === 'string')
    .map((ingredient, index) => ({
      id: typeof ingredient.id === 'string' ? ingredient.id : createId(),
      name: ingredient.name.trim().slice(0, 60),
      unit: typeof ingredient.unit === 'string' ? ingredient.unit.trim().slice(0, 20) : '',
      quantity: normaliseQuantity(ingredient.quantity),
      checked: Boolean(ingredient.checked),
      order: Number.isFinite(Number(ingredient.order)) ? Number(ingredient.order) : index
    }))
    .filter((ingredient) => ingredient.name)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

function ingredientsToFirebaseObject() {
  return appState.ingredients.reduce((firebaseIngredients, ingredient, index) => {
    firebaseIngredients[ingredient.id] = {
      id: ingredient.id,
      name: ingredient.name,
      unit: ingredient.unit,
      quantity: ingredient.quantity,
      checked: ingredient.checked,
      order: Number.isFinite(Number(ingredient.order)) ? Number(ingredient.order) : index
    };

    return firebaseIngredients;
  }, {});
}

async function saveIngredients() {
  appState.isSaving = true;

  try {
    await set(appState.ingredientsRef, ingredientsToFirebaseObject());
  } catch (error) {
    console.error('The ingredient list could not be saved to Firebase.', error);
    showToast('No se pudo guardar en Firebase.');
  } finally {
    appState.isSaving = false;
  }
}

function addIngredient(event) {
  event.preventDefault();
  const name = appState.elements.nameInput.value.trim();
  const unit = appState.elements.unitInput.value.trim();

  if (!name) return;

  appState.ingredients.push({ id: createId(), name, unit, quantity: '', checked: false, order: Date.now() });
  saveIngredients();
  appState.elements.addForm.reset();
  renderShoppingApp();
  appState.elements.nameInput.focus();
  showToast(`${name} se ha guardado.`);
}

function updateQuantity(event) {
  const input = event.target.closest('[data-quantity-id]');
  if (!input) return;

  const ingredient = getIngredient(input.dataset.quantityId);
  if (!ingredient) return;

  ingredient.quantity = normaliseQuantity(input.value);
  ingredient.checked = false;
  saveIngredients();
  renderShoppingList();
}

function handleIngredientAction(event) {
  const actionButton = event.target.closest('[data-action]');
  if (!actionButton) return;

  const ingredient = getIngredient(actionButton.dataset.id);
  if (!ingredient) return;

  if (actionButton.dataset.action === 'edit') editIngredient(ingredient);
  if (actionButton.dataset.action === 'delete') deleteIngredient(ingredient);
}

function editIngredient(ingredient) {
  const nextName = window.prompt('Nombre del ingrediente:', ingredient.name);
  if (nextName === null) return;
  const name = nextName.trim();
  if (!name) {
    showToast('El ingrediente necesita un nombre.');
    return;
  }

  const nextUnit = window.prompt('Unidad (puede quedar vacía):', ingredient.unit);
  if (nextUnit === null) return;

  ingredient.name = name.slice(0, 60);
  ingredient.unit = nextUnit.trim().slice(0, 20);
  saveIngredients();
  renderShoppingApp();
  showToast('Ingrediente actualizado.');
}

function deleteIngredient(ingredient) {
  if (!window.confirm(`¿Eliminar “${ingredient.name}”?`)) return;

  appState.ingredients = appState.ingredients.filter((item) => item.id !== ingredient.id);
  saveIngredients();
  renderShoppingApp();
  showToast('Ingrediente eliminado.');
}

function clearQuantities() {
  const hasQuantities = appState.ingredients.some((ingredient) => hasQuantity(ingredient.quantity));
  if (!hasQuantities) {
    showToast('Todavía no hay cantidades que limpiar.');
    return;
  }

  if (!window.confirm('Se limpiarán las cantidades de hoy. Tus ingredientes se conservarán.')) return;

  appState.ingredients.forEach((ingredient) => {
    ingredient.quantity = '';
    ingredient.checked = false;
  });
  saveIngredients();
  renderShoppingApp();
  showToast('Lista preparada para la próxima compra.');
}

function toggleShoppingItem(event) {
  const checkbox = event.target.closest('[data-shopping-id]');
  if (!checkbox) return;
  const ingredient = getIngredient(checkbox.dataset.shoppingId);
  if (!ingredient) return;

  ingredient.checked = checkbox.checked;
  saveIngredients();
  renderShoppingList();
}

function renderShoppingApp() {
  renderIngredientList();
  renderShoppingList();
}

function renderIngredientList() {
  const { ingredientList, ingredientCount, emptyIngredients } = appState.elements;
  ingredientList.replaceChildren();
  ingredientCount.textContent = `${appState.ingredients.length} ${appState.ingredients.length === 1 ? 'guardado' : 'guardados'}`;

  if (!appState.ingredients.length) {
    ingredientList.append(emptyIngredients.content.cloneNode(true));
    return;
  }

  appState.ingredients.forEach((ingredient) => {
    const row = document.createElement('article');
    row.className = 'ingredient-row';

    const nameWrap = document.createElement('div');
    nameWrap.className = 'ingredient-name-wrap';
    const name = document.createElement('span');
    name.className = 'ingredient-name';
    name.textContent = ingredient.name;
    name.title = ingredient.name;
    const unit = document.createElement('span');
    unit.className = 'ingredient-unit';
    unit.textContent = ingredient.unit || 'Sin unidad';
    nameWrap.append(name, unit);

    const quantity = document.createElement('input');
    quantity.className = 'ingredient-quantity';
    quantity.type = 'number';
    quantity.inputMode = 'decimal';
    quantity.min = '0';
    quantity.step = 'any';
    quantity.placeholder = '—';
    quantity.value = ingredient.quantity;
    quantity.dataset.quantityId = ingredient.id;
    quantity.setAttribute('aria-label', `Cantidad de ${ingredient.name}`);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(
      createActionButton('editar', ingredient.id, 'Editar ingrediente', '✎'),
      createActionButton('delete', ingredient.id, 'Eliminar ingrediente', '×')
    );

    row.append(nameWrap, quantity, actions);
    ingredientList.append(row);
  });
}

function renderShoppingList() {
  const { shoppingList, shoppingSummary, copyButton, emptyShopping } = appState.elements;
  const selectedIngredients = appState.ingredients.filter((ingredient) => hasQuantity(ingredient.quantity));
  shoppingList.replaceChildren();
  copyButton.disabled = !selectedIngredients.length;

  if (!selectedIngredients.length) {
    shoppingList.append(emptyShopping.content.cloneNode(true));
    shoppingSummary.textContent = appState.ingredients.length
      ? 'Añade una cantidad para incluir un ingrediente.'
      : 'Añade tus ingredientes habituales para empezar.';
    return;
  }

  selectedIngredients.forEach((ingredient) => {
    const item = document.createElement('div');
    item.className = `shopping-item${ingredient.checked ? ' is-checked' : ''}`;
    const checkbox = document.createElement('input');
    const label = document.createElement('label');
    const labelId = `shopping-label-${ingredient.id}`;

    checkbox.type = 'checkbox';
    checkbox.id = `shopping-check-${ingredient.id}`;
    checkbox.checked = ingredient.checked;
    checkbox.dataset.shoppingId = ingredient.id;
    checkbox.setAttribute('aria-labelledby', labelId);

    label.id = labelId;
    label.htmlFor = checkbox.id;
    const quantity = document.createElement('span');
    quantity.textContent = formatQuantity(ingredient.quantity, ingredient.unit);
    label.append(quantity, document.createTextNode(` · ${ingredient.name}`));

    item.append(checkbox, label);
    shoppingList.append(item);
  });

  const boughtCount = selectedIngredients.filter((ingredient) => ingredient.checked).length;
  shoppingSummary.textContent = boughtCount
    ? `${boughtCount} de ${selectedIngredients.length} marcados como comprados.`
    : `${selectedIngredients.length} ${selectedIngredients.length === 1 ? 'ingrediente' : 'ingredientes'} en la lista.`;
}

function createActionButton(action, id, label, text) {
  const button = document.createElement('button');
  button.className = 'icon-button';
  button.type = 'button';
  button.dataset.action = action;
  button.dataset.id = id;
  button.setAttribute('aria-label', label);
  button.textContent = text;
  return button;
}

async function copyShoppingList() {
  const text = buildShoppingText();
  if (!text) return;

  try {
    await navigator.clipboard.writeText(text);
    showToast('Lista copiada.');
  } catch (error) {
    fallbackCopy(text);
    showToast('Lista copiada.');
  }
}

function buildShoppingText() {
  const selectedIngredients = appState.ingredients.filter((ingredient) => hasQuantity(ingredient.quantity));
  if (!selectedIngredients.length) return '';

  return ['Lista de compra', '', ...selectedIngredients.map((ingredient) => `• ${formatQuantity(ingredient.quantity, ingredient.unit)} · ${ingredient.name}`)].join('\n');
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function downloadBackup() {
  const backup = JSON.stringify({ version: 1, ingredients: appState.ingredients }, null, 2);
  const blob = new Blob([backup], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mi-lista-de-ingredientes.json';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Copia guardada en tu dispositivo.');
}

function restoreBackup(event) {
  const [file] = event.target.files;
  if (!file) return;
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      if (!backup || !Array.isArray(backup.ingredients)) throw new Error('Invalid backup');

      if (!window.confirm('La copia sustituirá la lista actual. ¿Continuar?')) return;
      appState.ingredients = normaliseBackup(backup.ingredients);
      saveIngredients();
      renderShoppingApp();
      showToast('Copia restaurada.');
    } catch (error) {
      showToast('No se pudo leer esa copia.');
    } finally {
      event.target.value = '';
    }
  };

  reader.readAsText(file);
}

function normaliseBackup(ingredients) {
  return ingredients
    .filter((ingredient) => ingredient && typeof ingredient.name === 'string')
    .map((ingredient, index) => ({
      id: typeof ingredient.id === 'string' ? ingredient.id : createId(),
      name: ingredient.name.trim().slice(0, 60),
      unit: typeof ingredient.unit === 'string' ? ingredient.unit.trim().slice(0, 20) : '',
      quantity: normaliseQuantity(ingredient.quantity),
      checked: Boolean(ingredient.checked),
      order: Number.isFinite(Number(ingredient.order)) ? Number(ingredient.order) : index
    }))
    .filter((ingredient) => ingredient.name);
}

function getIngredient(id) {
  return appState.ingredients.find((ingredient) => ingredient.id === id);
}

function createId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return `ingredient-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normaliseQuantity(value) {
  if (value === '' || value === null || value === undefined) return '';
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : '';
}

function hasQuantity(value) {
  return Number(value) > 0;
}

function formatQuantity(quantity, unit) {
  const number = Number(quantity);
  const formattedNumber = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(number);
  return unit ? `${formattedNumber} ${unit}` : formattedNumber;
}

function showToast(message) {
  const toast = appState.elements.toast;
  window.clearTimeout(appState.toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  appState.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2500);
}
