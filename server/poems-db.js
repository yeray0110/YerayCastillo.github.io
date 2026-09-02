function toPoem(row) {
  return { id: row.id, date: row.date, content: row.content };
}

export async function listPoems(database) {
  const result = await database
    .prepare(
      `SELECT id, poem_date AS date, content
       FROM poems
       WHERE TRIM(content) <> ''
       ORDER BY poem_date DESC, created_at DESC`,
    )
    .all();
  return result.results.map(toPoem);
}

export async function createPoem(database, poem) {
  await database
    .prepare('INSERT OR IGNORE INTO poems (id, poem_date, content) VALUES (?, ?, ?)')
    .bind(poem.id, poem.date, poem.content)
    .run();
  return poem;
}

export async function updatePoem(database, poem) {
  await database
    .prepare(
      `UPDATE poems
       SET poem_date = ?, content = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .bind(poem.date, poem.content, poem.id)
    .run();
  return poem;
}

export async function deletePoem(database, id) {
  await database.prepare('DELETE FROM poems WHERE id = ?').bind(id).run();
}

export async function importPoems(database, poems) {
  const statements = poems.map((poem) =>
    database
      .prepare('INSERT OR IGNORE INTO poems (id, poem_date, content) VALUES (?, ?, ?)')
      .bind(poem.id, poem.date, poem.content),
  );
  if (statements.length) await database.batch(statements);
}
