import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker, { type Env as WorkerEnv } from '../src/index';

// For now, you'll need to do something like this to get a correctly-typed
// `Request` to pass to `worker.fetch()`.
const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

const testEnv: WorkerEnv = {
	...(env as unknown as WorkerEnv),
	HYPERDRIVE: { connectionString: 'postgresql://example.com/test' }
};

describe('rushes hyperdrive worker', () => {
	it('describes available endpoints', async () => {
		const request = new IncomingRequest('http://example.com');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.headers.get('content-type')).toContain('application/json');
		const payload = (await response.json()) as { service: string; endpoints: string[] };
		expect(payload.service).toBe('rushes-hyperdrive');
		expect(payload.endpoints).toContain('/videos');
	});

	it('handles CORS preflight without touching the database', async () => {
		const request = new IncomingRequest('http://example.com/videos', {
			method: 'OPTIONS'
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);

		expect(response.status).toBe(204);
		expect(response.headers.get('access-control-allow-origin')).toBe('*');
	});

	it('exposes the worker entry via SELF.fetch()', async () => {
		const response = await SELF.fetch('https://example.com');
		expect(response.headers.get('content-type')).toContain('application/json');
	});
});
