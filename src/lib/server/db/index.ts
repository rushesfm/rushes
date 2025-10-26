// src/lib/db/index.ts

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// This function will be called by your layout
export function getDb(connectionString: string) {
	const client = postgres(connectionString);
	return drizzle(client, { schema });
}
