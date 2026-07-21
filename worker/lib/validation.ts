import {
  MEMORY_CATEGORIES,
  type CreateMemoryAssetInput,
  type CreateMemoryRequest,
  type MediaType,
  type MemoryCategory,
  type MemoryStatus,
  type UpdateAssetVisibilityRequest,
  type UploadFileRequest,
  type Visibility,
} from '../../shared/contracts';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
const MAX_FILES = 20;
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ValidationError extends Error {
  readonly status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function mediaTypeForMime(mimeType: string): MediaType {
  const normalized = mimeType.toLowerCase();
  if (IMAGE_MIME_TYPES.has(normalized)) return 'image';
  if (VIDEO_MIME_TYPES.has(normalized)) return 'video';
  throw new ValidationError(`Unsupported media type: ${mimeType}`);
}

export function validateVisibility(
  value: unknown,
  label = 'Visibility',
): Visibility {
  if (value !== 'public' && value !== 'private') {
    throw new ValidationError(`${label} must be public or private.`);
  }
  return value;
}

export function validateMemoryCategory(value: unknown): MemoryCategory {
  const category = requiredString(value, 'Category', 40);
  if (
    !MEMORY_CATEGORIES.includes(
      category as (typeof MEMORY_CATEGORIES)[number],
    )
  ) {
    throw new ValidationError('Choose a valid memory category.');
  }
  return category as MemoryCategory;
}

export function validateMemoryStatus(value: unknown): MemoryStatus {
  if (value !== 'draft' && value !== 'published') {
    throw new ValidationError('Status must be draft or published.');
  }
  return value;
}

export function validateIsoDate(value: unknown, label = 'Date'): string {
  const date = requiredString(value, label, 10);
  if (
    !ISO_DATE.test(date)
    || Number.isNaN(Date.parse(`${date}T00:00:00Z`))
  ) {
    throw new ValidationError(`${label} must use YYYY-MM-DD format.`);
  }
  return date;
}

export function validateAssetVisibilityUpdate(
  value: unknown,
): UpdateAssetVisibilityRequest {
  const record = requiredRecord(
    value,
    'Asset visibility data',
  );
  return {
    visibility: validateVisibility(
      record.visibility,
      'Asset visibility',
    ),
  };
}

export function validateUploadFiles(
  value: unknown,
): UploadFileRequest[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError(
      'Choose at least one photo or video.',
    );
  }
  if (value.length > MAX_FILES) {
    throw new ValidationError(
      `You can upload up to ${MAX_FILES} files in one memory.`,
    );
  }

  return value.map((candidate, index) => {
    const record = requiredRecord(
      candidate,
      `File ${index + 1}`,
    );
    const filename = requiredString(
      record.filename,
      `File ${index + 1} filename`,
      255,
    );
    const mimeType = requiredString(
      record.mimeType,
      `File ${index + 1} MIME type`,
      100,
    ).toLowerCase();
    const sizeBytes = requiredPositiveInteger(
      record.sizeBytes,
      `File ${index + 1} size`,
    );
    const mediaType = mediaTypeForMime(mimeType);
    const limit = mediaType === 'image'
      ? MAX_IMAGE_BYTES
      : MAX_VIDEO_BYTES;

    if (sizeBytes > limit) {
      throw new ValidationError(
        mediaType === 'image'
          ? `${filename} exceeds the 50 MiB image limit.`
          : `${filename} exceeds the 2 GiB video limit.`,
      );
    }

    return { filename, mimeType, sizeBytes };
  });
}

export function validateCreateMemoryRequest(
  value: unknown,
): CreateMemoryRequest {
  const record = requiredRecord(value, 'Memory data');
  const title = requiredString(record.title, 'Title', 120);
  const location = requiredString(
    record.location,
    'Location',
    160,
  );
  const date = validateIsoDate(record.date);
  const category = validateMemoryCategory(record.category);
  const visibility = record.visibility === undefined
    ? 'private'
    : validateVisibility(record.visibility);
  const status = validateMemoryStatus(record.status);

  if (
    !Array.isArray(record.assets)
    || record.assets.length === 0
    || record.assets.length > MAX_FILES
  ) {
    throw new ValidationError(
      `A memory must contain between 1 and ${MAX_FILES} assets.`,
    );
  }

  const assets = record.assets.map((asset, index) =>
    validateMemoryAsset(asset, index),
  );
  const coverObjectKey = requiredString(
    record.coverObjectKey,
    'Cover asset',
    1024,
  );
  if (
    !assets.some((asset) =>
      asset.objectKey === coverObjectKey,
    )
  ) {
    throw new ValidationError(
      'The cover asset must belong to this memory.',
    );
  }

  return {
    title,
    location,
    date,
    category,
    description: optionalString(record.description, 600),
    visibility,
    featured: Boolean(record.featured),
    status,
    coverObjectKey,
    assets,
  };
}

function validateMemoryAsset(
  value: unknown,
  index: number,
): CreateMemoryAssetInput {
  const record = requiredRecord(
    value,
    `Asset ${index + 1}`,
  );
  const mimeType = requiredString(
    record.mimeType,
    `Asset ${index + 1} MIME type`,
    100,
  ).toLowerCase();
  const inferredType = mediaTypeForMime(mimeType);

  if (
    record.mediaType !== 'image'
    && record.mediaType !== 'video'
  ) {
    throw new ValidationError(
      `Asset ${index + 1} media type is invalid.`,
    );
  }

  const mediaType = record.mediaType;
  if (mediaType !== inferredType) {
    throw new ValidationError(
      `Asset ${index + 1} media type does not match its MIME type.`,
    );
  }

  const sortOrder = requiredNonNegativeInteger(
    record.sortOrder,
    `Asset ${index + 1} sort order`,
  );
  const sizeBytes = requiredPositiveInteger(
    record.sizeBytes,
    `Asset ${index + 1} size`,
  );
  const limit = mediaType === 'image'
    ? MAX_IMAGE_BYTES
    : MAX_VIDEO_BYTES;

  if (sizeBytes > limit) {
    throw new ValidationError(
      `Asset ${index + 1} exceeds its file size limit.`,
    );
  }

  return {
    objectKey: requiredString(
      record.objectKey,
      `Asset ${index + 1} object key`,
      1024,
    ),
    originalFilename: requiredString(
      record.originalFilename,
      `Asset ${index + 1} filename`,
      255,
    ),
    mimeType,
    sizeBytes,
    mediaType,
    sortOrder,
    visibility: record.visibility === undefined
      ? 'private'
      : validateVisibility(
          record.visibility,
          `Asset ${index + 1} visibility`,
        ),
  };
}

export function assertOwnedObjectKey(
  objectKey: string,
  ownerId: string,
): void {
  const expectedPrefix = `originals/${ownerId}/`;
  if (
    !objectKey.startsWith(expectedPrefix)
    || objectKey.includes('..')
  ) {
    throw new ValidationError(
      'The uploaded object does not belong to this owner.',
    );
  }
}

export function sanitizeDownloadFilename(
  filename: string,
): string {
  const extensionMatch = filename.match(
    /\.([a-zA-Z0-9]{1,10})$/,
  );
  const extension = extensionMatch
    ? `.${extensionMatch[1].toLowerCase()}`
    : '';
  const base = filename
    .replace(/\\/g, '/')
    .split('/')
    .pop()!
    .replace(/\.[a-zA-Z0-9]{1,10}$/, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 100);

  return `${base || 'download'}${extension}`;
}

export function safeObjectExtension(
  filename: string,
  mimeType: string,
): string {
  const known: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };
  const fromMime = known[mimeType.toLowerCase()];
  if (fromMime) return fromMime;
  const match = filename
    .toLowerCase()
    .match(/\.([a-z0-9]{1,10})$/);
  return match?.[1] ?? 'bin';
}

export function requiredRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
  ) {
    throw new ValidationError(`${label} is required.`);
  }
  return value as Record<string, unknown>;
}

export function requiredString(
  value: unknown,
  label: string,
  maxLength: number,
): string {
  if (
    typeof value !== 'string'
    || value.trim().length === 0
  ) {
    throw new ValidationError(`${label} is required.`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ValidationError(
      `${label} must be ${maxLength} characters or fewer.`,
    );
  }
  return normalized;
}

export function optionalString(
  value: unknown,
  maxLength: number,
): string {
  if (value == null) return '';
  if (typeof value !== 'string') {
    throw new ValidationError(
      'Description must be text.',
    );
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ValidationError(
      `Description must be ${maxLength} characters or fewer.`,
    );
  }
  return normalized;
}

export function requiredPositiveInteger(
  value: unknown,
  label: string,
): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value <= 0
  ) {
    throw new ValidationError(
      `${label} must be a positive integer.`,
    );
  }
  return value;
}

export function requiredNonNegativeInteger(
  value: unknown,
  label: string,
): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < 0
  ) {
    throw new ValidationError(
      `${label} must be a non-negative integer.`,
    );
  }
  return value;
}

export function requiredBoundedInteger(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== 'number'
    || !Number.isSafeInteger(value)
    || value < min
    || value > max
  ) {
    throw new ValidationError(
      `${label} must be between ${min} and ${max}.`,
    );
  }
  return value;
}