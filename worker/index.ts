import type { Env } from './env';
import { optionalOwner, requireOwner, resolveOwnerSession } from './lib/auth';
import {
  createMemory,
  deleteMemory,
  getMemory,
  listMemories,
  serveAsset,
  updateMemory,
} from './lib/memories';
import { handleError, json, methodNotAllowed, notFound } from './lib/responses';
import { authorizeUploads } from './lib/uploads';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    try {
      if (url.pathname === '/api/health') {
        return request.method === 'GET'
          ? json({ ok: true, service: 'our-love-story' })
          : methodNotAllowed(['GET']);
      }

      if (url.pathname === '/api/session') {
        return request.method === 'GET'
          ? json(await resolveOwnerSession(request, env))
          : methodNotAllowed(['GET']);
      }

      if (url.pathname === '/api/uploads') {
        if (request.method !== 'POST') return methodNotAllowed(['POST']);
        const owner = await requireOwner(request, env);
        return json(await authorizeUploads(request, env, owner), { status: 201 });
      }

      if (url.pathname === '/api/memories') {
        if (request.method === 'GET') {
          const owner = await optionalOwner(request, env);
          return json({ memories: await listMemories(env, Boolean(owner)) });
        }
        if (request.method === 'POST') {
          const owner = await requireOwner(request, env);
          return json(await createMemory(request, env, owner), { status: 201 });
        }
        return methodNotAllowed(['GET', 'POST']);
      }

      const memoryMatch = url.pathname.match(/^\/api\/memories\/([^/]+)$/);
      if (memoryMatch) {
        const memoryId = decodeURIComponent(memoryMatch[1]);
        if (request.method === 'GET') {
          const owner = await optionalOwner(request, env);
          const memory = await getMemory(env, memoryId, Boolean(owner));
          return memory ? json(memory) : notFound();
        }
        if (request.method === 'PATCH') {
          await requireOwner(request, env);
          return json(await updateMemory(request, env, memoryId));
        }
        if (request.method === 'DELETE') {
          await requireOwner(request, env);
          return deleteMemory(env, memoryId, ctx);
        }
        return methodNotAllowed(['GET', 'PATCH', 'DELETE']);
      }

      const downloadMatch = url.pathname.match(/^\/api\/assets\/([^/]+)\/download$/);
      if (downloadMatch) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return methodNotAllowed(['GET', 'HEAD']);
        }
        return serveAsset(request, env, decodeURIComponent(downloadMatch[1]), true);
      }

      const assetMatch = url.pathname.match(/^\/api\/assets\/([^/]+)$/);
      if (assetMatch) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return methodNotAllowed(['GET', 'HEAD']);
        }
        return serveAsset(request, env, decodeURIComponent(assetMatch[1]), false);
      }

      return notFound();
    } catch (error) {
      return handleError(error);
    }
  },
} satisfies ExportedHandler<Env>;
