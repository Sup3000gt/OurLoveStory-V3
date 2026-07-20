import { AwsClient } from 'aws4fetch';
import type {
  AuthorizeUploadsRequest,
  AuthorizeUploadsResponse,
  AuthorizedUpload,
} from '../../shared/contracts';
import type { Env, OwnerIdentity } from '../env';
import { HttpError } from './responses';
import { mediaTypeForMime, safeObjectExtension, validateUploadFiles } from './validation';

const PRESIGNED_URL_TTL_SECONDS = 300;

export async function authorizeUploads(
  request: Request,
  env: Env,
  owner: OwnerIdentity,
): Promise<AuthorizeUploadsResponse> {
  assertS3Configuration(env);
  const input = (await request.json()) as Partial<AuthorizeUploadsRequest>;
  const files = validateUploadFiles(input.files);
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
    retries: 1,
  });
  const year = new Date().getUTCFullYear();
  const expiresAt = new Date(Date.now() + PRESIGNED_URL_TTL_SECONDS * 1000).toISOString();

  const uploads: AuthorizedUpload[] = [];
  for (const file of files) {
    const extension = safeObjectExtension(file.filename, file.mimeType);
    const objectKey = `originals/${owner.userId}/${year}/${crypto.randomUUID()}.${extension}`;
    const endpoint = new URL(
      `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${encodeURIComponent(env.R2_BUCKET_NAME)}/${encodeObjectKey(objectKey)}`,
    );
    endpoint.searchParams.set('X-Amz-Expires', String(PRESIGNED_URL_TTL_SECONDS));
    const headers = { 'Content-Type': file.mimeType };
    const signed = await client.sign(
      new Request(endpoint, { method: 'PUT', headers }),
      { aws: { signQuery: true } },
    );
    uploads.push({
      objectKey,
      uploadUrl: signed.url,
      headers,
      expiresAt,
      mediaType: mediaTypeForMime(file.mimeType),
      originalFilename: file.filename,
      sizeBytes: file.sizeBytes,
    });
  }

  return { uploads };
}

function assertS3Configuration(env: Env): void {
  const required = [
    env.R2_ACCOUNT_ID,
    env.R2_BUCKET_NAME,
    env.R2_ACCESS_KEY_ID,
    env.R2_SECRET_ACCESS_KEY,
  ];
  if (required.some((value) => !value || value.startsWith('REPLACE_'))) {
    throw new HttpError(503, 'R2 direct-upload credentials have not been configured.');
  }
}

function encodeObjectKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}
