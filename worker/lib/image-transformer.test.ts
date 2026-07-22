import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import {
  generateAndPersistDerivative,
  readOrGenerateDerivative,
  type ImageSourceDescriptor,
} from './image-transformer';

const source: ImageSourceDescriptor = {
  kind: 'asset',
  assetId: 'asset-1',
  objectKey: 'assets/asset-1/original',
  sizeBytes: 10 * 1024 * 1024,
};

function stream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
}

function envFor(original: { body: ReadableStream<Uint8Array> | null; size: number }) {
  const put = vi.fn().mockResolvedValue({});
  const get = vi.fn().mockResolvedValue(original);
  const input = vi.fn();
  const images = { input };
  return {
    env: { MEDIA: { get, put }, IMAGES: images, IMAGE_SOURCE_SIGNING_KEY: 'test-secret' } as unknown as Env,
    get,
    put,
    input,
  };
}

describe('hybrid persistent image transformer', () => {
  it('uses the Images binding for an input exactly 20 MB', async () => {
    const output = new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/webp' } });
    const outputResult = { response: vi.fn().mockResolvedValue(output) };
    const transformer = { transform: vi.fn().mockReturnThis(), output: vi.fn().mockResolvedValue(outputResult) };
    const fixture = envFor({ body: stream(new Uint8Array([1])), size: 20 * 1024 * 1024 });
    fixture.input.mockReturnValue(transformer);

    await generateAndPersistDerivative(fixture.env, { ...source, sizeBytes: 20 * 1024 * 1024 }, 'thumbnail', 'derivatives/a.webp');

    expect(fixture.input).toHaveBeenCalledWith(expect.any(ReadableStream));
    expect(transformer.transform).toHaveBeenCalledWith({ width: 640, height: 640, fit: 'scale-down' });
    expect(transformer.output).toHaveBeenCalledWith({ format: 'image/webp', quality: 75, anim: false });
  });

  it('uses the injected remote fetch for inputs above 20 MB', async () => {
    const fixture = envFor({ body: stream(new Uint8Array([1])), size: 21 * 1024 * 1024 });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2]), { status: 200 }));

    await generateAndPersistDerivative(fixture.env, { ...source, sizeBytes: 21 * 1024 * 1024 }, 'preview', 'derivatives/a.webp', { fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(expect.any(String), { cf: { image: { format: 'webp', quality: 82, fit: 'scale-down', anim: false } } });
    expect(fixture.input).not.toHaveBeenCalled();
  });

  it('rejects inputs above 100 MB before reading the R2 body', async () => {
    const body = { getReader: vi.fn() } as unknown as ReadableStream<Uint8Array>;
    const fixture = envFor({ body, size: 100 * 1024 * 1024 + 1 });

    await expect(generateAndPersistDerivative(fixture.env, { ...source, sizeBytes: 100 * 1024 * 1024 + 1 }, 'thumbnail', 'derivatives/a.webp'))
      .rejects.toMatchObject({ code: 'SOURCE_TOO_LARGE' });
    expect((body as unknown as { getReader: ReturnType<typeof vi.fn> }).getReader).not.toHaveBeenCalled();
    expect(fixture.get).not.toHaveBeenCalled();
  });

  it('persists WebP bytes with source, variant, and version metadata', async () => {
    const fixture = envFor({ body: stream(new Uint8Array([1])), size: 1 });
    const output = new Response(new Uint8Array([4, 5]), { headers: { 'content-type': 'image/webp' } });
    fixture.input.mockReturnValue({ transform: vi.fn().mockReturnThis(), output: vi.fn().mockResolvedValue({ response: () => output }) });

    await generateAndPersistDerivative(fixture.env, source, 'thumbnail', 'derivatives/a.webp');

    expect(fixture.put).toHaveBeenCalledWith('derivatives/a.webp', expect.any(Uint8Array), {
      httpMetadata: { contentType: 'image/webp' },
      customMetadata: { version: 'v1', source: 'asset:asset-1', variant: 'thumbnail' },
    });
  });

  it('shares one in-flight promise for concurrent requests of one key', async () => {
    const fixture = envFor({ body: stream(new Uint8Array([1])), size: 1 });
    let release!: (value: { response: () => Response }) => void;
    const output = new Promise<{ response: () => Response }>((resolve) => { release = resolve; });
    fixture.input.mockReturnValue({ transform: vi.fn().mockReturnThis(), output: vi.fn().mockReturnValue(output) });
    const first = generateAndPersistDerivative(fixture.env, source, 'thumbnail', 'derivatives/a.webp');
    const second = generateAndPersistDerivative(fixture.env, source, 'thumbnail', 'derivatives/a.webp');
    expect(first).toBe(second);
    release({ response: () => new Response(new Uint8Array([1])) });
    await Promise.all([first, second]);
    expect(fixture.input).toHaveBeenCalledTimes(1);
  });

  it('maps non-OK remote responses and Cloudflare quota error 9422', async () => {
    const remote = envFor({ body: stream(new Uint8Array([1])), size: 21 * 1024 * 1024 });
    await expect(generateAndPersistDerivative(remote.env, { ...source, sizeBytes: 21 * 1024 * 1024 }, 'thumbnail', 'a', { fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 503 })) }))
      .rejects.toMatchObject({ code: 'REMOTE_FAILED' });

    const binding = envFor({ body: stream(new Uint8Array([1])), size: 1 });
    binding.input.mockReturnValue({ transform: vi.fn().mockReturnThis(), output: vi.fn().mockRejectedValue(Object.assign(new Error('quota'), { code: 9422 })) });
    await expect(generateAndPersistDerivative(binding.env, source, 'thumbnail', 'b'))
      .rejects.toMatchObject({ code: 'QUOTA_EXCEEDED' });
  });

  it('reads a cached derivative before generating it', async () => {
    const fixture = envFor({ body: stream(new Uint8Array([1])), size: 1 });
    fixture.get.mockResolvedValue({ body: stream(new Uint8Array([9])), arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([9]).buffer) });
    const result = await readOrGenerateDerivative(fixture.env, source, 'thumbnail', 'derivatives/a.webp');
    expect(result.bytes).toEqual(new Uint8Array([9]));
    expect(fixture.input).not.toHaveBeenCalled();
  });
});
