import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const lists = sqliteTable('lists', {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const ingredients = sqliteTable(
  'ingredients',
  {
    id: text('id').primaryKey(),
    listId: text('list_id').notNull(),
    provider: text('provider').notNull().default('breaks'),
    name: text('name').notNull(),
    unit: text('unit').notNull().default(''),
    quantity: text('quantity').notNull().default(''),
    checked: integer('checked', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull(),
    createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_ingredients_list_position').on(table.listId, table.position),
    index('idx_ingredients_list_provider_position').on(table.listId, table.provider, table.position),
  ],
);
