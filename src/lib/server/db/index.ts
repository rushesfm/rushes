// src/lib/db/index.ts

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema';

type CachedClient = {
	sql: Sql;
	db: ReturnType<typeof drizzle<typeof schema>>;
};

const clientCache = new Map<string, CachedClient>();

function isCloudflareWorkerRuntime(): boolean {
	if (typeof globalThis === 'undefined') return false;
	const globalNavigator = (globalThis as { navigator?: { userAgent?: string } }).navigator;
	return globalNavigator?.userAgent === 'Cloudflare-Workers';
}

export function getDb(connectionString: string) {
	// Cloudflare Workers cannot share I/O objects across requests,
	// so avoid caching the postgres client in that environment.
	if (!isCloudflareWorkerRuntime()) {
		const cached = clientCache.get(connectionString);
		if (cached) {
			return cached.db;
		}
	}

	const sql = postgres(connectionString, {
		max: 1,
		prepare: false
	});

	const db = drizzle(sql, { schema });

	// Only cache when not running inside the Workers runtime.
	if (!isCloudflareWorkerRuntime()) {
		clientCache.set(connectionString, { sql, db });
	}

	return db;
}

// Helper function to get database URL from platform env
export function getDatabaseUrl(env?: {
	HYPERDRIVE?: { connectionString: string };
	DATABASE_URL?: string;
}): string | undefined {
	return env?.HYPERDRIVE?.connectionString ?? env?.DATABASE_URL;
}
