const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
]);

const HEIC_FILE_EXTENSION = /\.(?:heic|heif)$/i;

export type HeicConverter = (
  file: File,
) => Promise<Blob>;

export interface HeicConversionEvent {
  index: number;
  total: number;
  filename: string;
}

export function isHeicFile(
  file: Pick<File, 'name' | 'type'>,
): boolean {
  return HEIC_MIME_TYPES.has(
    file.type.trim().toLowerCase(),
  ) || HEIC_FILE_EXTENSION.test(file.name);
}

export function jpegFilename(
  filename: string,
): string {
  const stem = filename.replace(
    HEIC_FILE_EXTENSION,
    '',
  );
  return `${stem || 'photo'}.jpg`;
}

async function convertHeicToJpeg(
  file: File,
): Promise<Blob> {
  const { heicTo } = await import(
    'heic-to/csp'
  );
  return heicTo({
    blob: file,
    type: 'image/jpeg',
    quality: 0.9,
  });
}

export async function normalizeSelectedMediaFiles(
  files: File[],
  options: {
    convert?: HeicConverter;
    onConvert?: (
      event: HeicConversionEvent,
    ) => void;
  } = {},
): Promise<File[]> {
  const convert =
    options.convert
    ?? convertHeicToJpeg;
  const normalized: File[] = [];

  for (
    let index = 0;
    index < files.length;
    index += 1
  ) {
    const file = files[index]!;
    if (!isHeicFile(file)) {
      normalized.push(file);
      continue;
    }

    options.onConvert?.({
      index,
      total: files.length,
      filename: file.name,
    });

    try {
      const jpeg = await convert(file);
      normalized.push(
        new File(
          [jpeg],
          jpegFilename(file.name),
          {
            type: 'image/jpeg',
            lastModified:
              file.lastModified,
          },
        ),
      );
    } catch {
      throw new Error(
        `${file.name} could not be converted from HEIC. Try exporting it as JPEG first.`,
      );
    }
  }

  return normalized;
}
