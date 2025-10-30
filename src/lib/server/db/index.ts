// src/lib/db/index.ts

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema';

type CachedClient = {
	sql: Sql;
	db: ReturnType<typeof drizzle<typeof schema>>;
};

const clientCache = new Map<string, CachedClient>();

export function getDb(connectionString: string) {
	const cached = clientCache.get(connectionString);
	if (cached) {
		return cached.db;
	}

	const sql = postgres(connectionString, {
		max: 1,
		prepare: false
	});

	const db = drizzle(sql, { schema });
	clientCache.set(connectionString, { sql, db });
	return db;
}
