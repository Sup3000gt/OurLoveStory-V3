export type OwnerSessionTokenGetter = () => Promise<string | null>;

export class OwnerSessionTokenPendingError extends Error {
  constructor() {
    super('The Clerk session token is still loading.');
    this.name = 'OwnerSessionTokenPendingError';
  }
}

export async function requireOwnerSessionToken(
  getToken: OwnerSessionTokenGetter,
): Promise<string> {
  const token = await getToken();
  if (!token) throw new OwnerSessionTokenPendingError();
  return token;
}