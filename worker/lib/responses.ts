import type { ApiErrorBody } from '../../shared/contracts';
import { ValidationError } from './validation';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function noContent(headers?: HeadersInit): Response {
  return new Response(null, { status: 204, headers });
}

export function notFound(): Response {
  return json({ error: 'Not found.' } satisfies ApiErrorBody, { status: 404 });
}

export function methodNotAllowed(methods: string[]): Response {
  return json(
    { error: 'Method not allowed.' } satisfies ApiErrorBody,
    { status: 405, headers: { allow: methods.join(', ') } },
  );
}

export function handleError(error: unknown): Response {
  if (error instanceof ValidationError) {
    return json({ error: error.message } satisfies ApiErrorBody, { status: error.status });
  }
  if (error instanceof HttpError) {
    return json({ error: error.message } satisfies ApiErrorBody, { status: error.status });
  }
  console.error('Unhandled API error', error);
  return json({ error: 'An unexpected server error occurred.' } satisfies ApiErrorBody, { status: 500 });
}
