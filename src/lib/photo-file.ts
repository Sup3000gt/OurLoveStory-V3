import {
  MAX_PHOTOS_PER_SELECTION,
} from '../../shared/upload-constants';

const SESSION_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const LEGACY_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

const LEGACY_MAX_FILES = 20;
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export type SelectionMode =
  | { mode: 'photo-session' }
  | { mode: 'legacy-media' };

export function normalizeLocalMediaMime(
  file: Pick<File, 'name' | 'type'>,
): string {
  return file.type.trim().toLowerCase();
}

export function classifySelection(
  files: File[],
): SelectionMode {
  if (files.length === 0) {
    throw new Error('Choose at least one photo or video.');
  }

  const mimeTypes = files.map(normalizeLocalMediaMime);
  const hasVideo = mimeTypes.some((mimeType) =>
    LEGACY_VIDEO_MIME_TYPES.has(mimeType),
  );

  if (hasVideo) {
    if (files.length > LEGACY_MAX_FILES) {
      throw new Error(
        'Selections containing video can include up to 20 files.',
      );
    }

    files.forEach((file, index) => {
      const mimeType = mimeTypes[index]!;
      const supported =
        SESSION_PHOTO_MIME_TYPES.has(mimeType)
        || LEGACY_VIDEO_MIME_TYPES.has(mimeType);

      if (!supported) {
        throw new Error(
          `${file.name} uses an unsupported file type.`,
        );
      }

      const limit = LEGACY_VIDEO_MIME_TYPES.has(mimeType)
        ? MAX_VIDEO_BYTES
        : MAX_IMAGE_BYTES;

      if (file.size > limit) {
        throw new Error(
          `${file.name} exceeds its file size limit.`,
        );
      }
    });

    return { mode: 'legacy-media' };
  }

  if (files.length > MAX_PHOTOS_PER_SELECTION) {
    throw new Error(
      `Choose up to ${MAX_PHOTOS_PER_SELECTION} photos.`,
    );
  }

  files.forEach((file, index) => {
    const mimeType = mimeTypes[index]!;

    if (!SESSION_PHOTO_MIME_TYPES.has(mimeType)) {
      throw new Error(
        `${file.name} uses an unsupported photo type.`,
      );
    }

    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(
        `${file.name} exceeds the 50 MiB image limit.`,
      );
    }
  });

  return { mode: 'photo-session' };
}