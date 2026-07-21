export interface ReliableUploadItem<TFile, TUpload> {
  id: string;
  file: TFile;
  completedUpload?: TUpload;
}

export type ReliableUploadEventState =
  | 'uploading'
  | 'retrying'
  | 'uploaded'
  | 'failed';

export interface ReliableUploadEvent<TUpload> {
  id: string;
  filename: string;
  state: ReliableUploadEventState;
  attempt: number;
  retry: number;
  maxRetries: number;
  completed: number;
  total: number;
  upload?: TUpload;
  error?: unknown;
}

export interface ReliableUploadOptions<TFile, TUpload> {
  items: ReliableUploadItem<TFile, TUpload>[];
  authorize: (files: TFile[]) => Promise<TUpload[]>;
  upload: (upload: TUpload, file: TFile) => Promise<void>;
  shouldReauthorize: (error: unknown) => boolean;
  getFileName: (file: TFile) => string;
  onEvent?: (event: ReliableUploadEvent<TUpload>) => void;
  concurrency?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
}

export class ReliableUploadAuthorizationError extends Error {
  readonly originalError: unknown;

  constructor(originalError: unknown) {
    super('Upload authorization failed.');
    this.name = 'ReliableUploadAuthorizationError';
    this.originalError = originalError;
  }
}

export class ReliableUploadBatchError<TUpload = unknown> extends Error {
  readonly itemId: string;
  readonly filename: string;
  readonly originalError: unknown;
  readonly completedUploads: Map<string, TUpload>;

  constructor(
    itemId: string,
    filename: string,
    originalError: unknown,
    completedUploads: Map<string, TUpload>,
  ) {
    super(`${filename} did not upload.`);
    this.name = 'ReliableUploadBatchError';
    this.itemId = itemId;
    this.filename = filename;
    this.originalError = originalError;
    this.completedUploads = new Map(completedUploads);
  }
}

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function uploadBatchReliably<TFile, TUpload>(
  options: ReliableUploadOptions<TFile, TUpload>,
): Promise<Map<string, TUpload>> {
  const {
    items,
    authorize,
    upload,
    shouldReauthorize,
    getFileName,
    onEvent,
    concurrency = 3,
    maxRetries = 3,
    baseDelayMs = 1_000,
    sleep = defaultSleep,
  } = options;

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('Upload concurrency must be a positive integer.');
  }
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new Error('Upload retry count must be a non-negative integer.');
  }

  const completedUploads = new Map<string, TUpload>();
  for (const item of items) {
    if (item.completedUpload !== undefined) {
      completedUploads.set(item.id, item.completedUpload);
    }
  }

  const pendingItems = items.filter((item) => !completedUploads.has(item.id));
  if (pendingItems.length === 0) return completedUploads;

  let initialUploads: TUpload[];
  try {
    initialUploads = await authorizeWithRetry(
      pendingItems.map((item) => item.file),
      authorize,
      maxRetries,
      baseDelayMs,
      sleep,
    );
  } catch (error) {
    throw new ReliableUploadAuthorizationError(error);
  }

  if (initialUploads.length !== pendingItems.length) {
    throw new ReliableUploadAuthorizationError(
      new Error('Upload authorization count did not match the selected files.'),
    );
  }

  const tasks = pendingItems.map((item, index) => ({
    ...item,
    upload: initialUploads[index]!,
  }));

  let nextTaskIndex = 0;
  let completedCount = completedUploads.size;
  const failures: ReliableUploadBatchError<TUpload>[] = [];

  async function processTask(task: (typeof tasks)[number]): Promise<void> {
    let currentUpload = task.upload;
    const filename = getFileName(task.file);

    for (let attemptIndex = 0; attemptIndex <= maxRetries; attemptIndex += 1) {
      const retry = attemptIndex;
      onEvent?.({
        id: task.id,
        filename,
        state: retry === 0 ? 'uploading' : 'retrying',
        attempt: attemptIndex + 1,
        retry,
        maxRetries,
        completed: completedCount,
        total: items.length,
        upload: currentUpload,
      });

      try {
        await upload(currentUpload, task.file);
        completedUploads.set(task.id, currentUpload);
        completedCount += 1;
        onEvent?.({
          id: task.id,
          filename,
          state: 'uploaded',
          attempt: attemptIndex + 1,
          retry,
          maxRetries,
          completed: completedCount,
          total: items.length,
          upload: currentUpload,
        });
        return;
      } catch (error) {
        if (attemptIndex >= maxRetries) {
          onEvent?.({
            id: task.id,
            filename,
            state: 'failed',
            attempt: attemptIndex + 1,
            retry,
            maxRetries,
            completed: completedCount,
            total: items.length,
            upload: currentUpload,
            error,
          });
          failures.push(
            new ReliableUploadBatchError(
              task.id,
              filename,
              error,
              completedUploads,
            ),
          );
          return;
        }

        await sleep(baseDelayMs * (2 ** attemptIndex));

        if (shouldReauthorize(error)) {
          try {
            const refreshed = await authorizeWithRetry(
              [task.file],
              authorize,
              maxRetries,
              baseDelayMs,
              sleep,
            );
            if (!refreshed[0]) {
              throw new Error('A refreshed upload authorization was not returned.');
            }
            currentUpload = refreshed[0];
          } catch (authorizationError) {
            onEvent?.({
              id: task.id,
              filename,
              state: 'failed',
              attempt: attemptIndex + 1,
              retry,
              maxRetries,
              completed: completedCount,
              total: items.length,
              upload: currentUpload,
              error: authorizationError,
            });
            failures.push(
              new ReliableUploadBatchError(
                task.id,
                filename,
                authorizationError,
                completedUploads,
              ),
            );
            return;
          }
        }
      }
    }
  }

  async function worker(): Promise<void> {
    while (true) {
      const taskIndex = nextTaskIndex;
      nextTaskIndex += 1;
      const task = tasks[taskIndex];
      if (!task) return;
      await processTask(task);
    }
  }

  const workerCount = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  if (failures.length > 0) {
    const firstFailure = failures[0]!;
    throw new ReliableUploadBatchError(
      firstFailure.itemId,
      firstFailure.filename,
      firstFailure.originalError,
      completedUploads,
    );
  }

  return completedUploads;
}

async function authorizeWithRetry<TFile, TUpload>(
  files: TFile[],
  authorize: (files: TFile[]) => Promise<TUpload[]>,
  maxRetries: number,
  baseDelayMs: number,
  sleep: (milliseconds: number) => Promise<void>,
): Promise<TUpload[]> {
  let lastError: unknown = null;

  for (let attemptIndex = 0; attemptIndex <= maxRetries; attemptIndex += 1) {
    try {
      return await authorize(files);
    } catch (error) {
      lastError = error;
      if (attemptIndex >= maxRetries) break;
      await sleep(baseDelayMs * (2 ** attemptIndex));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Upload authorization failed.');
}