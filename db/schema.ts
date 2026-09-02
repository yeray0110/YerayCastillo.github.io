import { sql } from 'drizzle-orm';
import { index, text, sqliteTable } from 'drizzle-orm/sqlite-core';

export const poems = sqliteTable(
  'poems',
  {
    id: text('id').primaryKey(),
    date: text('poem_date').notNull(),
    content: text('content').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_poems_date').on(table.date, table.createdAt)],
);
