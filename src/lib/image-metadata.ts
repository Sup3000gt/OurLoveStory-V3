export interface ImageDimensions {
  width: number;
  height: number;
}

async function dimensionsFromImageElement(
  file: File,
): Promise<ImageDimensions | null> {
  if (
    typeof Image === 'undefined'
    || typeof URL.createObjectURL
      !== 'function'
  ) {
    return null;
  }

  const objectUrl =
    URL.createObjectURL(file);

  try {
    return await new Promise(
      (resolve) => {
        const image = new Image();
        image.onload = () => {
          const width =
            image.naturalWidth;
          const height =
            image.naturalHeight;
          resolve(
            width > 0 && height > 0
              ? { width, height }
              : null,
          );
        };
        image.onerror = () =>
          resolve(null);
        image.src = objectUrl;
      },
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function readImageDimensions(
  file: File,
): Promise<ImageDimensions | null> {
  if (
    typeof createImageBitmap
      === 'function'
  ) {
    try {
      const bitmap =
        await createImageBitmap(file);
      const dimensions = {
        width: bitmap.width,
        height: bitmap.height,
      };
      bitmap.close();

      if (
        dimensions.width > 0
        && dimensions.height > 0
      ) {
        return dimensions;
      }
    } catch {
      // Older browsers can reject otherwise valid files here.
    }
  }

  return dimensionsFromImageElement(file);
}
