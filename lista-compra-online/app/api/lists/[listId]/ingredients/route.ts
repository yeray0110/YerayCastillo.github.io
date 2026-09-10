import { createIngredient, getIngredients, isProvider, isValidListId, listExists } from '@/db/list-service';

type RouteContext = { params: Promise<{ listId: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { listId } = await params;
  if (!(await validateList(listId))) return notFoundList();
  const provider = new URL(request.url).searchParams.get('provider') ?? 'breaks';
  if (!isProvider(provider)) return invalidProvider();
  return Response.json({ ingredients: await getIngredients(listId, provider) });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { listId } = await params;
  if (!(await validateList(listId))) return notFoundList();

  const body: unknown = await request.json().catch(() => null);
  const input = isRecord(body) ? body : {};
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 60) : '';
  const unit = typeof input.unit === 'string' ? input.unit.trim().slice(0, 20) : '';
  const provider = typeof input.provider === 'string' ? input.provider : 'breaks';
  if (!name) return Response.json({ error: 'Enter the ingredient name.' }, { status: 400 });
  if (!isProvider(provider)) return invalidProvider();

  return Response.json({ ingredient: await createIngredient(listId, provider, name, unit) }, { status: 201 });
}

async function validateList(listId: string) {
  return isValidListId(listId) && listExists(listId);
}

function notFoundList() {
  return Response.json({ error: 'We could not find this list.' }, { status: 404 });
}

function invalidProvider() {
  return Response.json({ error: 'Invalid supplier.' }, { status: 400 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
