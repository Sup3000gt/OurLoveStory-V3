import {
  type AuthorizeSessionBatchRequest,
  type CreateUploadSessionRequest,
  type RecordSessionFailureRequest,
  type RecordSessionUploadRequest,
  type UpdateSessionFileRequest,
  type UpdateSessionReviewRequest,
  type UploadSessionMatchRequest,
  type UploadSessionFileInput,
} from '../../shared/contracts';
import {
  MAX_PHOTOS_PER_SELECTION,
  UPLOAD_AUTH_BATCH_SIZE,
} from '../../shared/upload-constants';
import {
  MAX_IMAGE_BYTES,
  ValidationError,
  optionalPositiveInteger,
  optionalString,
  requiredBoundedInteger,
  requiredNonNegativeInteger,
  requiredPositiveInteger,
  requiredRecord,
  requiredString,
  validateIsoDate,
  validateMemoryCategory,
  validateMemoryStatus,
  validateVisibility,
} from './validation';

const SHA256_HEX = /^[a-f0-9]{64}$/;

const SESSION_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

function validateHash(
  value: unknown,
  label: string,
): string {
  if (
    typeof value !== 'string'
    || !SHA256_HEX.test(value)
  ) {
    throw new ValidationError(
      `${label} must be a SHA-256 hex value.`,
    );
  }
  return value;
}

function validateSessionFiles(
  value: unknown,
): UploadSessionFileInput[] {
  if (
    !Array.isArray(value)
    || value.length < 1
    || value.length > MAX_PHOTOS_PER_SELECTION
  ) {
    throw new ValidationError(
      `Choose between 1 and ${MAX_PHOTOS_PER_SELECTION} photos.`,
    );
  }

  const sortOrders = new Set<number>();
  const identities = new Set<string>();

  return value.map((candidate, index) => {
    const record = requiredRecord(
      candidate,
      `Photo ${index + 1}`,
    );
    const filename = requiredString(
      record.filename,
      `Photo ${index + 1} filename`,
      255,
    );
    const mimeType = requiredString(
      record.mimeType,
      `Photo ${index + 1} MIME type`,
      100,
    ).toLowerCase();

    if (!SESSION_IMAGE_MIME_TYPES.has(mimeType)) {
      throw new ValidationError(
        'Upload Sessions accept photos only.',
      );
    }

    const sizeBytes = requiredPositiveInteger(
      record.sizeBytes,
      `Photo ${index + 1} size`,
    );
    if (sizeBytes > MAX_IMAGE_BYTES) {
      throw new ValidationError(
        `${filename} exceeds the 50 MiB image limit.`,
      );
    }

    const originalSortOrder = requiredBoundedInteger(
      record.originalSortOrder,
      `Photo ${index + 1} sort order`,
      0,
      MAX_PHOTOS_PER_SELECTION - 1,
    );
    if (sortOrders.has(originalSortOrder)) {
      throw new ValidationError(
        'Photo sort orders must be unique.',
      );
    }
    sortOrders.add(originalSortOrder);

    const resumeFingerprint = validateHash(
      record.resumeFingerprint,
      `Photo ${index + 1} resume fingerprint`,
    );
    const occurrenceIndex = requiredNonNegativeInteger(
      record.occurrenceIndex,
      `Photo ${index + 1} occurrence index`,
    );
    const identity = `${resumeFingerprint}:${occurrenceIndex}`;
    if (identities.has(identity)) {
      throw new ValidationError(
        'Photo resume identities must be unique.',
      );
    }
    identities.add(identity);

    return {
      resumeFingerprint,
      contentHash: validateHash(
        record.contentHash,
        `Photo ${index + 1} content hash`,
      ),
      occurrenceIndex,
      filename,
      mimeType,
      sizeBytes,
      width: optionalPositiveInteger(
        record.width,
        `Photo ${index + 1} width`,
      ),
      height: optionalPositiveInteger(
        record.height,
        `Photo ${index + 1} height`,
      ),
      originalSortOrder,
      targetVisibility: validateVisibility(
        record.targetVisibility,
        `Photo ${index + 1} visibility`,
      ),
    };
  });
}

export function validateCreateUploadSessionRequest(
  value: unknown,
): CreateUploadSessionRequest {
  const record = requiredRecord(
    value,
    'Upload Session',
  );
  const files = validateSessionFiles(record.files);

  if (record.sessionKind === 'append') {
    return {
      sessionKind: 'append',
      memoryId: requiredString(
        record.memoryId,
        'Memory ID',
        128,
      ),
      files,
    };
  }

  if (record.sessionKind !== 'create') {
    throw new ValidationError(
      'Session kind must be create or append.',
    );
  }

  return {
    sessionKind: 'create',
    title: requiredString(record.title, 'Title', 120),
    location: requiredString(
      record.location,
      'Location',
      160,
    ),
    date: validateIsoDate(record.date),
    category: validateMemoryCategory(record.category),
    description: optionalString(
      record.description,
      600,
    ),
    featured: Boolean(record.featured),
    targetMemoryStatus: validateMemoryStatus(
      record.targetMemoryStatus,
    ),
    files,
  };
}

export function validateMatchUploadSessionRequest(
  value: unknown,
): UploadSessionMatchRequest {
  const record = requiredRecord(
    value,
    'Upload Session match data',
  );
  if (
    !Array.isArray(record.files)
    || record.files.length < 1
    || record.files.length > MAX_PHOTOS_PER_SELECTION
  ) {
    throw new ValidationError(
      `Choose between 1 and ${MAX_PHOTOS_PER_SELECTION} photos to resume.`,
    );
  }

  return {
    files: record.files.map((candidate, index) => {
      const file = requiredRecord(
        candidate,
        `Resume photo ${index + 1}`,
      );
      return {
        localId: requiredString(
          file.localId,
          `Resume photo ${index + 1} local ID`,
          128,
        ),
        resumeFingerprint: validateHash(
          file.resumeFingerprint,
          `Resume photo ${index + 1} fingerprint`,
        ),
        occurrenceIndex: requiredNonNegativeInteger(
          file.occurrenceIndex,
          `Resume photo ${index + 1} occurrence index`,
        ),
        filename: requiredString(
          file.filename,
          `Resume photo ${index + 1} filename`,
          255,
        ),
        sizeBytes: requiredPositiveInteger(
          file.sizeBytes,
          `Resume photo ${index + 1} size`,
        ),
      };
    }),
  };
}

export function validateAuthorizeSessionBatchRequest(
  value: unknown,
): AuthorizeSessionBatchRequest {
  const record = requiredRecord(
    value,
    'Upload authorization data',
  );
  if (
    !Array.isArray(record.sessionFileIds)
    || record.sessionFileIds.length < 1
    || record.sessionFileIds.length > UPLOAD_AUTH_BATCH_SIZE
  ) {
    throw new ValidationError(
      `Choose between 1 and ${UPLOAD_AUTH_BATCH_SIZE} pending photos.`,
    );
  }

  const sessionFileIds = record.sessionFileIds.map(
    (value, index) =>
      requiredString(
        value,
        `Session file ID ${index + 1}`,
        128,
      ),
  );

  if (new Set(sessionFileIds).size !== sessionFileIds.length) {
    throw new ValidationError(
      'Session file IDs must be unique.',
    );
  }

  return { sessionFileIds };
}

export function validateRecordSessionUploadRequest(
  value: unknown,
): RecordSessionUploadRequest {
  const record = requiredRecord(
    value,
    'Uploaded photo data',
  );
  return {
    sessionFileId: requiredString(
      record.sessionFileId,
      'Session file ID',
      128,
    ),
    objectKey: requiredString(
      record.objectKey,
      'Object key',
      1024,
    ),
  };
}

export function validateRecordSessionFailureRequest(
  value: unknown,
): RecordSessionFailureRequest {
  const record = requiredRecord(
    value,
    'Upload failure data',
  );
  return {
    sessionFileId: requiredString(
      record.sessionFileId,
      'Session file ID',
      128,
    ),
    errorCode: requiredString(
      record.errorCode,
      'Error code',
      80,
    ),
  };
}

export function validateUpdateSessionFileRequest(
  value: unknown,
): UpdateSessionFileRequest {
  const record = requiredRecord(
    value,
    'Session file update',
  );
  const result: UpdateSessionFileRequest = {};

  if (record.targetVisibility !== undefined) {
    result.targetVisibility = validateVisibility(
      record.targetVisibility,
      'Target visibility',
    );
  }
  if (record.reviewSortOrder !== undefined) {
    result.reviewSortOrder = requiredBoundedInteger(
      record.reviewSortOrder,
      'Review sort order',
      0,
      MAX_PHOTOS_PER_SELECTION - 1,
    );
  }
  if (record.allowDuplicate !== undefined) {
    if (typeof record.allowDuplicate !== 'boolean') {
      throw new ValidationError(
        'Allow duplicate must be true or false.',
      );
    }
    result.allowDuplicate = record.allowDuplicate;
  }
  if (record.skipped !== undefined) {
    if (typeof record.skipped !== 'boolean') {
      throw new ValidationError(
        'Skipped must be true or false.',
      );
    }
    result.skipped = record.skipped;
  }

  if (Object.keys(result).length === 0) {
    throw new ValidationError(
      'No Session file fields were provided.',
    );
  }

  return result;
}

export function validateUpdateSessionReviewRequest(
  value: unknown,
): UpdateSessionReviewRequest {
  const record = requiredRecord(
    value,
    'Session review',
  );
  const proposedCoverSessionFileId =
    record.proposedCoverSessionFileId === null
      ? null
      : requiredString(
          record.proposedCoverSessionFileId,
          'Proposed cover Session file ID',
          128,
        );

  if (
    !Array.isArray(record.files)
    || record.files.length < 1
    || record.files.length > MAX_PHOTOS_PER_SELECTION
  ) {
    throw new ValidationError(
      `Review between 1 and ${MAX_PHOTOS_PER_SELECTION} photos.`,
    );
  }

  const ids = new Set<string>();
  const sortOrders = new Set<number>();

  const files = record.files.map((candidate, index) => {
    const file = requiredRecord(
      candidate,
      `Review photo ${index + 1}`,
    );
    const sessionFileId = requiredString(
      file.sessionFileId,
      `Review photo ${index + 1} Session file ID`,
      128,
    );
    const reviewSortOrder = requiredBoundedInteger(
      file.reviewSortOrder,
      `Review photo ${index + 1} sort order`,
      0,
      MAX_PHOTOS_PER_SELECTION - 1,
    );

    if (ids.has(sessionFileId)) {
      throw new ValidationError(
        'Review Session file IDs must be unique.',
      );
    }
    if (sortOrders.has(reviewSortOrder)) {
      throw new ValidationError(
        'Review sort orders must be unique.',
      );
    }
    ids.add(sessionFileId);
    sortOrders.add(reviewSortOrder);

    if (typeof file.allowDuplicate !== 'boolean') {
      throw new ValidationError(
        `Review photo ${index + 1} duplicate setting must be true or false.`,
      );
    }
    if (typeof file.skipped !== 'boolean') {
      throw new ValidationError(
        `Review photo ${index + 1} skipped setting must be true or false.`,
      );
    }

    return {
      sessionFileId,
      reviewSortOrder,
      targetVisibility: validateVisibility(
        file.targetVisibility,
        `Review photo ${index + 1} visibility`,
      ),
      allowDuplicate: file.allowDuplicate,
      skipped: file.skipped,
    };
  });

  return {
    proposedCoverSessionFileId,
    files,
  };
}
