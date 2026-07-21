export interface ContentHasher {
  hash(file: File): Promise<string>;
}

type WorkerResponse =
  | {
      id: string;
      ok: true;
      contentHash: string;
    }
  | {
      id: string;
      ok: false;
      errorCode: string;
    };

export class PhotoHashClient implements ContentHasher {
  private readonly worker: Worker;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    worker = new Worker(
      new URL(
        '../workers/photo-hash.worker.ts',
        import.meta.url,
      ),
      { type: 'module' },
    ),
  ) {
    this.worker = worker;
  }

  hash(file: File): Promise<string> {
    const result = this.queue.then(() =>
      this.run(file),
    );

    this.queue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }

  dispose(): void {
    this.worker.terminate();
  }

  private run(file: File): Promise<string> {
    const id = crypto.randomUUID();

    return new Promise<string>((resolve, reject) => {
      const onMessage = (
        event: MessageEvent<WorkerResponse>,
      ) => {
        if (event.data.id !== id) return;

        this.worker.removeEventListener(
          'message',
          onMessage,
        );

        if (event.data.ok) {
          resolve(event.data.contentHash);
        } else {
          reject(
            new Error(event.data.errorCode),
          );
        }
      };

      this.worker.addEventListener(
        'message',
        onMessage,
      );

      this.worker.postMessage({ id, file });
    });
  }
}