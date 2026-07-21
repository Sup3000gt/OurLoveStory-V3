type BlobArrayBufferCapability = {
  arrayBuffer?: () => Promise<ArrayBuffer>;
};

export async function readBlobAsArrayBuffer(
  blob: Blob,
): Promise<ArrayBuffer> {
  const arrayBuffer = (
    blob as unknown as BlobArrayBufferCapability
  ).arrayBuffer;

  if (typeof arrayBuffer === 'function') {
    return arrayBuffer.call(blob);
  }

  return new Promise<ArrayBuffer>(
    (resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (
          reader.result === null
          || typeof reader.result === 'string'
        ) {
          reject(
            new Error(
              'The selected file did not produce binary data.',
            ),
          );
          return;
        }

        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(
          reader.error
          ?? new Error(
            'The selected file could not be read.',
          ),
        );
      };

      reader.onabort = () => {
        reject(
          new Error(
            'Reading the selected file was cancelled.',
          ),
        );
      };

      reader.readAsArrayBuffer(blob);
    },
  );
}