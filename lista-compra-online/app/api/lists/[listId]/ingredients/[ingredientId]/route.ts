import { deleteIngredient, getIngredient, isProvider, isValidListId, updateIngredient } from '@/db/list-service';

type RouteContext = { params: Promise<{ listId: string; ingredientId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const { listId, ingredientId } = await params;
  if (!isValidListId(listId)) return notFoundIngredient();
  const ingredient = await getIngredient(listId, ingredientId);
  if (!ingredient) return notFoundIngredient();

  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) return Response.json({ error: 'The changes are invalid.' }, { status: 400 });
  if (typeof body.name === 'string') ingredient.name = body.name.trim().slice(0, 60);
  if (typeof body.unit === 'string') ingredient.unit = body.unit.trim().slice(0, 20);
  if (typeof body.quantity === 'string') ingredient.quantity = normaliseQuantity(body.quantity);
  if (typeof body.checked === 'boolean') ingredient.checked = body.checked;
  if (typeof body.provider === 'string' && isProvider(body.provider)) ingredient.provider = body.provider;
  if (!ingredient.name) return Response.json({ error: 'An ingredient needs a name.' }, { status: 400 });

  return Response.json({ ingredient: await updateIngredient(ingredient) });
}

export async function DELETE(_: Request, { params }: RouteContext) {
  const { listId, ingredientId } = await params;
  if (!isValidListId(listId) || !(await getIngredient(listId, ingredientId))) return notFoundIngredient();
  await deleteIngredient(listId, ingredientId);
  return new Response(null, { status: 204 });
}

function normaliseQuantity(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : '';
}

function notFoundIngredient() {
  return Response.json({ error: 'We could not find that ingredient.' }, { status: 404 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
