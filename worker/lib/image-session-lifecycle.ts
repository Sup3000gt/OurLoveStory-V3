import type { Env } from '../env';
import {
  assetDerivativeKey,
  sessionThumbnailKey,
} from './image-derivatives';
import {
  readOrGenerateDerivative,
  type ImageSourceDescriptor,
} from './image-transformer';

export interface ConfirmedImageMapping {
  sessionId: string;
  sessionFileId: string;
  assetId: string;
  objectKey: string;
  sizeBytes: number;
}

export interface SessionImageFileReference {
  id: string;
  objectKey: string | null;
}

export function imageAssetObjectKeys(assetId: string, objectKey: string): string[] {
  return [
    objectKey,
    assetDerivativeKey(assetId, 'thumbnail'),
    assetDerivativeKey(assetId, 'preview'),
  ];
}

export async function deleteSessionImageObjects(
  env: Env,
  sessionId: string,
  files: SessionImageFileReference[],
): Promise<void> {
  const keys = new Set<string>();
  for (const file of files) {
    if (file.objectKey) keys.add(file.objectKey);
    keys.add(sessionThumbnailKey(sessionId, file.id));
  }
  if (keys.size > 0) await env.MEDIA.delete([...keys]);
}

function sourceForMapping(mapping: ConfirmedImageMapping): ImageSourceDescriptor {
  return {
    kind: 'asset',
    assetId: mapping.assetId,
    objectKey: mapping.objectKey,
    sizeBytes: mapping.sizeBytes,
  };
}

async function finalizeOneConfirmedImage(
  env: Env,
  mapping: ConfirmedImageMapping,
  sourceOrigin: string,
): Promise<void> {
  const source = sourceForMapping(mapping);
  const sessionKey = sessionThumbnailKey(mapping.sessionId, mapping.sessionFileId);
  const finalThumbnailKey = assetDerivativeKey(mapping.assetId, 'thumbnail');
  const sessionThumbnail = await env.MEDIA.get(sessionKey);
  const sessionThumbnailBody = sessionThumbnail && 'body' in sessionThumbnail
    ? sessionThumbnail.body
    : null;

  if (sessionThumbnail && sessionThumbnailBody) {
    const bytes = new Uint8Array(await sessionThumbnail.arrayBuffer());
    await env.MEDIA.put(finalThumbnailKey, bytes, {
      httpMetadata: { contentType: 'image/webp' },
      customMetadata: {
        version: 'v1',
        source: `asset:${mapping.assetId}`,
        variant: 'thumbnail',
      },
    });
    await env.MEDIA.delete(sessionKey);
  }

  const variants = sessionThumbnailBody ? ['preview'] : ['thumbnail', 'preview'];
  await Promise.allSettled(
    variants.map((variant) => readOrGenerateDerivative(
      env,
      source,
      variant as 'thumbnail' | 'preview',
      assetDerivativeKey(mapping.assetId, variant as 'thumbnail' | 'preview'),
      { sourceOrigin },
    )),
  );
}

export async function finalizeConfirmedImages(
  env: Env,
  mappings: ConfirmedImageMapping[],
  sourceOrigin: string,
): Promise<void> {
  for (let index = 0; index < mappings.length; index += 3) {
    const batch = mappings.slice(index, index + 3);
    await Promise.allSettled(
      batch.map(async (mapping) => {
        try {
          await finalizeOneConfirmedImage(env, mapping, sourceOrigin);
        } catch {
          // Derivative work is a post-confirm best effort. Lazy generation retries it later.
        }
      }),
    );
  }
}
