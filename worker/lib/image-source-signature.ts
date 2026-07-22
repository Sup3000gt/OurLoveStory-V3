const MAX_SIGNATURE_TTL_SECONDS = 60;
const textEncoder = new TextEncoder();

export function canonicalImageSource(pathname: string, expires: number): string {
  return `${pathname}\n${expires}`;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    .padEnd(value.length + ((4 - (value.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  );
}

export async function signImageSource(
  secret: string,
  pathname: string,
  expires: number,
): Promise<string> {
  const key = await hmacKey(secret, 'sign');
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    textEncoder.encode(canonicalImageSource(pathname, expires)),
  );
  return toBase64Url(new Uint8Array(signature));
}

export async function verifyImageSourceSignature(
  secret: string,
  pathname: string,
  expires: number,
  signature: string,
  nowSeconds: number,
): Promise<boolean> {
  if (!Number.isInteger(expires) || !Number.isInteger(nowSeconds)) return false;
  if (expires <= nowSeconds || expires > nowSeconds + MAX_SIGNATURE_TTL_SECONDS) return false;

  try {
    const key = await hmacKey(secret, 'verify');
    return await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(signature),
      textEncoder.encode(canonicalImageSource(pathname, expires)),
    );
  } catch {
    return false;
  }
}

export async function signedImageSourceUrl(
  origin: string,
  pathname: string,
  secret: string,
  nowSeconds: number,
): Promise<{
  url: string;
  expires: number;
  signature: string;
}> {
  const expires = nowSeconds + MAX_SIGNATURE_TTL_SECONDS;
  const signature = await signImageSource(secret, pathname, expires);
  const url = new URL(pathname, origin);
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('signature', signature);
  return { url: url.toString(), expires, signature };
}
