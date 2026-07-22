import type { Env } from '../env';
import { optionalOwner } from './auth';
import {
  serveImageDerivative,
  serveImageOriginal,
  serveSignedInternalImageSource,
} from './image-delivery';
import type { ImageDerivativeVariant } from './image-derivatives';
import { methodNotAllowed } from './responses';

export type ImageRoute =
  | { action: 'derivative'; assetId: string; variant: ImageDerivativeVariant }
  | { action: 'original'; assetId: string }
  | { action: 'internal-asset-source'; assetId: string }
  | { action: 'internal-session-source'; sessionId: string; fileId: string };

function decodeSegment(segment: string): string {
  return decodeURIComponent(segment);
}

export function matchImageRoute(pathname: string): ImageRoute | null {
  const assetMatch = pathname.match(/^\/api\/assets\/([^/]+)\/(thumbnail|preview|original)$/);
  if (assetMatch) {
    const assetId = decodeSegment(assetMatch[1]!);
    const action = assetMatch[2];
    if (action === 'original') return { action, assetId };
    if (action === 'thumbnail' || action === 'preview') {
      return { action: 'derivative', assetId, variant: action };
    }
  }

  const assetSourceMatch = pathname.match(/^\/api\/internal\/image-source\/assets\/([^/]+)$/);
  if (assetSourceMatch) {
    return { action: 'internal-asset-source', assetId: decodeSegment(assetSourceMatch[1]!) };
  }

  const sessionSourceMatch = pathname.match(
    /^\/api\/internal\/image-source\/upload-sessions\/([^/]+)\/files\/([^/]+)$/,
  );
  if (sessionSourceMatch) {
    return {
      action: 'internal-session-source',
      sessionId: decodeSegment(sessionSourceMatch[1]!),
      fileId: decodeSegment(sessionSourceMatch[2]!),
    };
  }

  return null;
}

export async function handleImageRoute(
  request: Request,
  env: Env,
  route: ImageRoute,
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return methodNotAllowed(['GET', 'HEAD']);
  }

  if (route.action === 'internal-asset-source' || route.action === 'internal-session-source') {
    return serveSignedInternalImageSource(request, env, route);
  }

  const isOwner = Boolean(await optionalOwner(request, env));
  if (route.action === 'derivative') {
    return serveImageDerivative(request, env, route.assetId, route.variant, isOwner);
  }
  return serveImageOriginal(request, env, route.assetId, isOwner);
}
