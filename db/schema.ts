import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
export const kv = sqliteTable('club_kv',{key:text('key').primaryKey(),value:text('value').notNull(),expires:integer('expires').notNull().default(0)});
export const hashes = sqliteTable('club_hash',{key:text('key').notNull(),field:text('field').notNull(),value:text('value').notNull(),expires:integer('expires').notNull().default(0)},t=>[primaryKey({columns:[t.key,t.field]})]);
