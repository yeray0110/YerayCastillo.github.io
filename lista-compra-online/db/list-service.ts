import { getDatabase } from './index';

export type Provider = 'breaks' | 'ocado';
export const providers: Provider[] = ['breaks', 'ocado'];

export type Ingredient = {
  id: string;
  listId: string;
  provider: Provider;
  name: string;
  unit: string;
  quantity: string;
  checked: boolean;
  position: number;
};

type IngredientRow = Omit<Ingredient, 'checked'> & { checked: number };

export const listIdPattern = /^[a-f0-9-]{36}$/i;

export function isValidListId(value: string) {
  return listIdPattern.test(value);
}

export function isProvider(value: string): value is Provider {
  return providers.includes(value as Provider);
}

export async function createList() {
  const id = crypto.randomUUID();
  await getDatabase()
    .prepare('INSERT INTO lists (id) VALUES (?)')
    .bind(id)
    .run();
  return id;
}

export async function listExists(listId: string) {
  const list = await getDatabase()
    .prepare('SELECT id FROM lists WHERE id = ?')
    .bind(listId)
    .first<{ id: string }>();
  return Boolean(list);
}

export async function getIngredients(listId: string, provider: Provider) {
  const result = await getDatabase()
    .prepare(
      `SELECT id, list_id AS listId, provider, name, unit, quantity, checked, position
       FROM ingredients
       WHERE list_id = ? AND provider = ?
       ORDER BY position ASC, created_at ASC`,
    )
    .bind(listId, provider)
    .all<IngredientRow>();

  return result.results.map(toIngredient);
}

export async function createIngredient(listId: string, provider: Provider, name: string, unit: string) {
  const database = getDatabase();
  const maxPosition = await database
    .prepare('SELECT COALESCE(MAX(position), 0) AS maxPosition FROM ingredients WHERE list_id = ? AND provider = ?')
    .bind(listId, provider)
    .first<{ maxPosition: number }>();

  const ingredient: Ingredient = {
    id: crypto.randomUUID(),
    listId,
    provider,
    name,
    unit,
    quantity: '',
    checked: false,
    position: (maxPosition?.maxPosition ?? 0) + 1,
  };

  await database
    .prepare(
      `INSERT INTO ingredients (id, list_id, provider, name, unit, quantity, checked, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(ingredient.id, ingredient.listId, ingredient.provider, ingredient.name, ingredient.unit, ingredient.quantity, 0, ingredient.position)
    .run();

  return ingredient;
}

export async function getIngredient(listId: string, ingredientId: string) {
  const row = await getDatabase()
    .prepare(
      `SELECT id, list_id AS listId, provider, name, unit, quantity, checked, position
       FROM ingredients
       WHERE id = ? AND list_id = ?`,
    )
    .bind(ingredientId, listId)
    .first<IngredientRow>();

  return row ? toIngredient(row) : null;
}

export async function updateIngredient(ingredient: Ingredient) {
  await getDatabase()
    .prepare(
      `UPDATE ingredients
       SET provider = ?, name = ?, unit = ?, quantity = ?, checked = ?
       WHERE id = ? AND list_id = ?`,
    )
    .bind(ingredient.provider, ingredient.name, ingredient.unit, ingredient.quantity, ingredient.checked ? 1 : 0, ingredient.id, ingredient.listId)
    .run();
  return ingredient;
}

export async function deleteIngredient(listId: string, ingredientId: string) {
  await getDatabase()
    .prepare('DELETE FROM ingredients WHERE id = ? AND list_id = ?')
    .bind(ingredientId, listId)
    .run();
}

function toIngredient(row: IngredientRow): Ingredient {
  return { ...row, checked: Boolean(row.checked) };
}
