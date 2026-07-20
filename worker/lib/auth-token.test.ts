import { describe, expect, it } from 'vitest';
import { tokenFromRequest } from './auth-token';

describe('tokenFromRequest', () => {
  it('prefers a Bearer token over the session cookie', () => {
    const request = new Request('https://example.com/api/session', {
      headers: {
        authorization: 'Bearer bearer-token',
        cookie: '__session=cookie-token',
      },
    });
    expect(tokenFromRequest(request)).toBe('bearer-token');
  });

  it('reads and decodes Clerk session cookies for inline media requests', () => {
    const request = new Request('https://example.com/api/assets/asset', {
      headers: { cookie: 'theme=warm; __session=header.payload%2Esignature; other=value' },
    });
    expect(tokenFromRequest(request)).toBe('header.payload.signature');
  });

  it('returns null instead of throwing for malformed cookie encoding', () => {
    const request = new Request('https://example.com/api/session', {
      headers: { cookie: '__session=%E0%A4%A' },
    });
    expect(tokenFromRequest(request)).toBeNull();
  });
});
