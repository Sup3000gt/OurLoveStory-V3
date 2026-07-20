import { verifyToken } from '@clerk/backend';
import type { OwnerSession } from '../../shared/contracts';
import type { Env, OwnerIdentity } from '../env';
import { tokenFromRequest } from './auth-token';
import { HttpError } from './responses';

interface OwnerRow {
  clerk_user_id: string;
  email: string;
  display_name: string;
}

export async function resolveOwnerSession(request: Request, env: Env): Promise<OwnerSession> {
  const userId = await resolveClerkUserId(request, env);
  if (!userId) {
    return { signedIn: false, isOwner: false, userId: null, displayName: null };
  }

  const owner = await findOwner(env, userId);
  return {
    signedIn: true,
    isOwner: Boolean(owner),
    userId,
    displayName: owner?.display_name ?? null,
  };
}

export async function optionalOwner(request: Request, env: Env): Promise<OwnerIdentity | null> {
  const userId = await resolveClerkUserId(request, env);
  if (!userId) return null;
  const owner = await findOwner(env, userId);
  if (!owner) return null;
  return { userId, email: owner.email, displayName: owner.display_name };
}

export async function requireOwner(request: Request, env: Env): Promise<OwnerIdentity> {
  const token = tokenFromRequest(request);
  if (!token) throw new HttpError(401, 'Sign in with an owner account.');

  const userId = await verifyClerkToken(token, env);
  if (!userId) throw new HttpError(401, 'Your session is invalid or expired.');

  const owner = await findOwner(env, userId);
  if (!owner) throw new HttpError(403, 'This Clerk account is not an authorized owner.');
  return { userId, email: owner.email, displayName: owner.display_name };
}

async function resolveClerkUserId(request: Request, env: Env): Promise<string | null> {
  const token = tokenFromRequest(request);
  if (!token) return null;
  return verifyClerkToken(token, env);
}

async function verifyClerkToken(token: string, env: Env): Promise<string | null> {
  try {
    const authorizedParties = env.CLERK_AUTHORIZED_PARTIES
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const verified = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      jwtKey: env.CLERK_JWT_KEY,
      authorizedParties: authorizedParties?.length ? authorizedParties : undefined,
    });
    return typeof verified.sub === 'string' ? verified.sub : null;
  } catch (error) {
    console.warn('Clerk token verification failed', error);
    return null;
  }
}

async function findOwner(env: Env, userId: string): Promise<OwnerRow | null> {
  return env.DB.prepare(
    'SELECT clerk_user_id, email, display_name FROM owners WHERE clerk_user_id = ? LIMIT 1',
  )
    .bind(userId)
    .first<OwnerRow>();
}
