import { createList } from '@/db/list-service';

export async function POST() {
  const listId = await createList();
  return Response.json({ listId }, { status: 201 });
}
