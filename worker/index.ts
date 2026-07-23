import type { Env } from './env';
import {
  optionalOwner,
  requireOwner,
  resolveOwnerSession,
} from './lib/auth';
import {
  createMemory,
  deleteAsset,
  deleteMemory,
  getMemory,
  listMemoryFacets,
  listMemories,
  serveAsset,
  updateAssetVisibility,
  updateMemory,
} from './lib/memories';
import {
  handleImageRoute,
  matchImageRoute,
} from './lib/image-routes';
import { normalizeMemoryPageSize } from './lib/memory-pagination';
import {
  MemoryDiscoveryValidationError,
  parseMemoryDiscoveryFilters,
} from '../shared/memory-discovery';
import type { MemoryDiscoveryFilters } from '../shared/memory-discovery';
import {
  clearTimelineCover,
  listTimeline,
  setTimelineCover,
} from './lib/timeline';
import { parseTimelineCoverInput } from './lib/timeline-validation';
import {
  handleError,
  json,
  methodNotAllowed,
  noContent,
  notFound,
} from './lib/responses';
import {
  handleUploadSessionRoute,
  matchUploadSessionRoute,
} from './lib/upload-session-routes';
import { authorizeUploads } from './lib/uploads';

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);
    const requestId =
      request.headers.get('cf-ray')
      ?? crypto.randomUUID();

    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    try {
      if (url.pathname === '/api/health') {
        return request.method === 'GET'
          ? json({
              ok: true,
              service: 'our-love-story',
            })
          : methodNotAllowed(['GET']);
      }

      if (url.pathname === '/api/session') {
        return request.method === 'GET'
          ? json(
              await resolveOwnerSession(request, env),
            )
          : methodNotAllowed(['GET']);
      }

      const imageRoute = matchImageRoute(url.pathname);
      if (imageRoute && !(
        imageRoute.action === 'legacy-asset'
        && request.method !== 'GET'
        && request.method !== 'HEAD'
      )) {
        return handleImageRoute(request, env, imageRoute);
      }

      const uploadSessionRoute =
        matchUploadSessionRoute(url.pathname);
      if (uploadSessionRoute) {
        const owner = await requireOwner(request, env);
        return handleUploadSessionRoute(
          request,
          env,
          ctx,
          owner,
          uploadSessionRoute,
          requestId,
        );
      }

      if (url.pathname === '/api/uploads') {
        if (request.method !== 'POST') {
          return methodNotAllowed(['POST']);
        }
        const owner = await requireOwner(request, env);
        return json(
          await authorizeUploads(request, env, owner),
          { status: 201 },
        );
      }

      if (url.pathname === '/api/timeline') {
        return request.method === 'GET'
          ? json(await listTimeline(env))
          : methodNotAllowed(['GET']);
      }

      if (url.pathname === '/api/timeline/covers') {
        if (request.method === 'PUT') {
          const owner = await requireOwner(request, env);
          const input = parseTimelineCoverInput(await request.json());
          return json(await setTimelineCover(env, owner, input));
        }
        if (request.method === 'DELETE') {
          await requireOwner(request, env);
          const { periodType, periodKey } = parseTimelineCoverInput({
            periodType: url.searchParams.get('periodType'),
            periodKey: url.searchParams.get('periodKey'),
            assetId: 'timeline-cover-clear',
          });
          await clearTimelineCover(env, periodType, periodKey);
          return noContent();
        }
        return methodNotAllowed(['PUT', 'DELETE']);
      }

      if (url.pathname === '/api/memories/facets') {
        if (request.method !== 'GET') return methodNotAllowed(['GET']);
        const owner = await optionalOwner(request, env);
        return json(await listMemoryFacets(env, Boolean(owner)));
      }

      if (url.pathname === '/api/memories') {
        if (request.method === 'GET') {
          let filters: MemoryDiscoveryFilters;
          try {
            filters = parseMemoryDiscoveryFilters(url.searchParams);
          } catch (error) {
            if (error instanceof MemoryDiscoveryValidationError) {
              return json({ error: error.message }, { status: 400 });
            }
            throw error;
          }
          const owner = await optionalOwner(
            request,
            env,
          );
          return json(await listMemories(
            env,
            Boolean(owner),
            {
              limit: normalizeMemoryPageSize(url.searchParams.get('limit')),
              cursor: url.searchParams.get('cursor'),
              query: filters.query,
              category: filters.category,
              year: filters.year,
              month: filters.month,
            },
          ));
        }
        if (request.method === 'POST') {
          const owner = await requireOwner(
            request,
            env,
          );
          return json(
            await createMemory(
              request,
              env,
              owner,
            ),
            { status: 201 },
          );
        }
        return methodNotAllowed(['GET', 'POST']);
      }

      const memoryMatch = url.pathname.match(
        /^\/api\/memories\/([^/]+)$/,
      );
      if (memoryMatch) {
        const memoryId = decodeURIComponent(
          memoryMatch[1]!,
        );
        if (request.method === 'GET') {
          const owner = await optionalOwner(
            request,
            env,
          );
          const memory = await getMemory(
            env,
            memoryId,
            Boolean(owner),
          );
          return memory ? json(memory) : notFound();
        }
        if (request.method === 'PATCH') {
          await requireOwner(request, env);
          return json(
            await updateMemory(
              request,
              env,
              memoryId,
            ),
          );
        }
        if (request.method === 'DELETE') {
          await requireOwner(request, env);
          return deleteMemory(
            env,
            memoryId,
            ctx,
          );
        }
        return methodNotAllowed([
          'GET',
          'PATCH',
          'DELETE',
        ]);
      }

      const assetMatch = url.pathname.match(
        /^\/api\/assets\/([^/]+)$/,
      );
      if (assetMatch) {
        const assetId = decodeURIComponent(
          assetMatch[1]!,
        );
        if (request.method === 'PATCH') {
          await requireOwner(request, env);
          return json(
            await updateAssetVisibility(
              request,
              env,
              assetId,
            ),
          );
        }
        if (request.method === 'DELETE') {
          await requireOwner(request, env);
          return json(
            await deleteAsset(
              env,
              assetId,
              ctx,
            ),
          );
        }
        if (
          request.method !== 'GET'
          && request.method !== 'HEAD'
        ) {
          return methodNotAllowed([
            'GET',
            'HEAD',
            'PATCH',
            'DELETE',
          ]);
        }
        return serveAsset(
          request,
          env,
          assetId,
          false,
        );
      }

      return notFound();
    } catch (error) {
      return handleError(error);
    }
  },
} satisfies ExportedHandler<Env>;
