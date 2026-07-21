import type {
  RecordSessionFailureRequest,
  RecordSessionUploadRequest,
  SessionAuthorizedUpload,
  UploadSessionFileStatus,
} from '../../shared/contracts';
import {
  PHOTO_UPLOAD_CONCURRENCY,
  PHOTO_UPLOAD_MAX_RETRIES,
  UPLOAD_AUTH_BATCH_SIZE,
} from '../../shared/upload-constants';
import {
  authorizeUploadSessionBatch,
  DirectUploadError,
  type GetToken,
  recordUploadSessionFailure,
  recordUploadSessionFile,
  uploadFileDirectly,
} from './api';
import {
  ReliableUploadBatchError,
  uploadBatchReliably,
  type ReliableUploadEvent,
} from './reliable-upload';

export interface SessionUploadPhoto {
  localId: string;
  sessionFileId: string;
  file: File;
  status: UploadSessionFileStatus;
}

export interface SessionUploadDependencies {
  authorize(
    sessionId: string,
    fileIds: string[],
    getToken: GetToken,
  ): Promise<SessionAuthorizedUpload[]>;

  upload(
    authorization: SessionAuthorizedUpload,
    file: File,
  ): Promise<void>;

  recordUploaded(
    sessionId: string,
    request: RecordSessionUploadRequest,
    getToken: GetToken,
  ): Promise<unknown>;

  recordFailed(
    sessionId: string,
    request: RecordSessionFailureRequest,
    getToken: GetToken,
  ): Promise<unknown>;
}

export interface UploadPendingSessionPhotosInput {
  sessionId: string;
  photos: SessionUploadPhoto[];
  getToken: GetToken;
  dependencies?: SessionUploadDependencies;
  onEvent?: (
    event: ReliableUploadEvent<SessionAuthorizedUpload>,
  ) => void;
}

export interface UploadPendingSessionPhotosResult {
  completedLocalIds: string[];
}

const defaultDependencies:
  SessionUploadDependencies = {
    authorize: async (
      sessionId,
      fileIds,
      getToken,
    ) => (
      await authorizeUploadSessionBatch(
        sessionId,
        {
          sessionFileIds: fileIds,
        },
        getToken,
      )
    ).uploads,

    upload: async (authorization, file) => {
      await uploadFileDirectly(
        authorization.uploadUrl,
        authorization.headers,
        file,
      );
    },

    recordUploaded: (
      sessionId,
      request,
      getToken,
    ) =>
      recordUploadSessionFile(
        sessionId,
        request,
        getToken,
      ),

    recordFailed: (
      sessionId,
      request,
      getToken,
    ) =>
      recordUploadSessionFailure(
        sessionId,
        request,
        getToken,
      ),
  };

export async function uploadPendingSessionPhotos(
  input: UploadPendingSessionPhotosInput,
): Promise<UploadPendingSessionPhotosResult> {
  const {
    sessionId,
    photos,
    getToken,
    dependencies = defaultDependencies,
    onEvent,
  } = input;

  const completedLocalIds = new Set(
    photos
      .filter((photo) =>
        photo.status === 'uploaded',
      )
      .map((photo) => photo.localId),
  );

  const pending = photos.filter((photo) =>
    photo.status !== 'uploaded'
    && photo.status !== 'skipped',
  );

  for (
    let offset = 0;
    offset < pending.length;
    offset += UPLOAD_AUTH_BATCH_SIZE
  ) {
    const batch = pending.slice(
      offset,
      offset + UPLOAD_AUTH_BATCH_SIZE,
    );

    const photoByLocalId = new Map(
      batch.map((photo) => [
        photo.localId,
        photo,
      ]),
    );

    try {
      const result = await uploadBatchReliably({
        items: batch.map((photo) => ({
          id: photo.localId,
          file: photo,
        })),

        authorize: async (selectedPhotos) =>
          dependencies.authorize(
            sessionId,
            selectedPhotos.map(
              (photo) => photo.sessionFileId,
            ),
            getToken,
          ),

        upload: async (
          authorization,
          selectedPhoto,
        ) => {
          await dependencies.upload(
            authorization,
            selectedPhoto.file,
          );

          await dependencies.recordUploaded(
            sessionId,
            {
              sessionFileId:
                authorization.sessionFileId,
              objectKey:
                authorization.objectKey,
            },
            getToken,
          );
        },

        shouldReauthorize: (error) =>
          error instanceof DirectUploadError
          && (
            error.status === 401
            || error.status === 403
          ),

        getFileName: (photo) =>
          photo.file.name,

        concurrency:
          PHOTO_UPLOAD_CONCURRENCY,

        maxRetries:
          PHOTO_UPLOAD_MAX_RETRIES,

        onEvent,
      });

      for (const localId of result.keys()) {
        completedLocalIds.add(localId);
      }
    } catch (error) {
      if (
        error
        instanceof ReliableUploadBatchError
      ) {
        const failed = photoByLocalId.get(
          error.itemId,
        );

        if (failed) {
          await dependencies.recordFailed(
            sessionId,
            {
              sessionFileId:
                failed.sessionFileId,
              errorCode:
                describeUploadError(
                  error.originalError,
                ),
            },
            getToken,
          );
        }

        for (
          const localId
          of error.completedUploads.keys()
        ) {
          completedLocalIds.add(localId);
        }
      }

      throw error;
    }
  }

  return {
    completedLocalIds: [
      ...completedLocalIds,
    ],
  };
}

function describeUploadError(
  error: unknown,
): string {
  if (error instanceof DirectUploadError) {
    if (error.status === null) {
      return 'NETWORK_ERROR';
    }

    return `HTTP_${error.status}`;
  }

  return 'UPLOAD_FAILED';
}