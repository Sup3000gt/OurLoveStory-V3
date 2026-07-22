export const MEMORY_CATEGORIES = [
  'Travel',
  'Daily Life',
  'Homemade Food',
  'Dining Out',
  'Special Moments',
] as const;

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];
export type Visibility = 'public' | 'private';
export type MemoryStatus = 'draft' | 'published';
export type MediaType = 'image' | 'video';

export interface ImageAsset {
  id: string;
  type: 'image';
  thumbnailUrl: string;
  previewUrl: string;
  originalUrl: string | null;
  url: string;
  downloadUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  visibility: Visibility;
}

export interface VideoAsset {
  id: string;
  type: 'video';
  url: string;
  downloadUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  visibility: Visibility;
}

export type MemoryAsset = ImageAsset | VideoAsset;

export interface Memory {
  id: string;
  title: string;
  location: string;
  date: string;
  description: string;
  category: MemoryCategory;
  /**
   * Compatibility field for the original memory-level visibility model.
   * Asset visibility is the source of truth for public access.
   */
  visibility: Visibility;
  featured: boolean;
  status: MemoryStatus;
  coverAssetId: string;
  assets: MemoryAsset[];
  createdAt: string;
  updatedAt: string;
}

export interface OwnerSession {
  signedIn: boolean;
  isOwner: boolean;
  userId: string | null;
  displayName: string | null;
}

export interface UploadFileRequest {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface AuthorizedUpload {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
  mediaType: MediaType;
  originalFilename: string;
  sizeBytes: number;
}

export interface AuthorizeUploadsRequest {
  files: UploadFileRequest[];
}

export interface AuthorizeUploadsResponse {
  uploads: AuthorizedUpload[];
}

export interface CreateMemoryAssetInput {
  objectKey: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  mediaType: MediaType;
  sortOrder: number;
  visibility: Visibility;
}

export interface CreateMemoryRequest {
  title: string;
  location: string;
  date: string;
  category: MemoryCategory;
  description: string;
  /**
   * Retained for backwards compatibility. New memories are persisted as
   * private at the memory level; each asset controls its own visibility.
   */
  visibility: Visibility;
  featured: boolean;
  status: MemoryStatus;
  coverObjectKey: string;
  assets: CreateMemoryAssetInput[];
}

export interface UpdateMemoryRequest {
  title?: string;
  location?: string;
  date?: string;
  category?: MemoryCategory;
  description?: string;
  visibility?: Visibility;
  featured?: boolean;
  status?: MemoryStatus;
  coverAssetId?: string;
}

export interface UpdateAssetVisibilityRequest {
  visibility: Visibility;
}

export interface UpdateAssetVisibilityResponse {
  assetId: string;
  visibility: Visibility;
}

export interface DeleteAssetResponse {
  deletedAssetId: string;
  deletedMemory: boolean;
  memoryId: string;
  replacementCoverAssetId: string | null;
}

export type UploadSessionKind = 'create' | 'append';

export type UploadSessionStatus =
  | 'uploading'
  | 'review'
  | 'completed'
  | 'abandoned';

export type UploadSessionFileStatus =
  | 'pending'
  | 'authorized'
  | 'uploading'
  | 'uploaded'
  | 'failed'
  | 'skipped';

export interface UploadSessionFileInput {
  resumeFingerprint: string;
  contentHash: string;
  occurrenceIndex: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  originalSortOrder: number;
  targetVisibility: Visibility;
}

export interface CreatePhotoSessionRequest {
  sessionKind: 'create';
  title: string;
  location: string;
  date: string;
  category: MemoryCategory;
  description: string;
  featured: boolean;
  targetMemoryStatus: MemoryStatus;
  files: UploadSessionFileInput[];
}

export interface AppendPhotoSessionRequest {
  sessionKind: 'append';
  memoryId: string;
  files: UploadSessionFileInput[];
}

export type CreateUploadSessionRequest =
  | CreatePhotoSessionRequest
  | AppendPhotoSessionRequest;

export interface UploadSessionFile {
  id: string;
  resumeFingerprint: string;
  contentHash: string | null;
  occurrenceIndex: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  originalSortOrder: number;
  reviewSortOrder: number;
  targetVisibility: Visibility;
  allowDuplicate: boolean;
  objectKey: string | null;
  status: UploadSessionFileStatus;
  lastError: string | null;
}

export interface UploadSession {
  id: string;
  kind: UploadSessionKind;
  memoryId: string | null;
  title: string | null;
  location: string | null;
  date: string | null;
  category: MemoryCategory | null;
  description: string;
  featured: boolean;
  targetMemoryStatus: MemoryStatus;
  expectedFileCount: number;
  completedFileCount: number;
  reservedSortStart: number | null;
  proposedCoverSessionFileId: string | null;
  status: UploadSessionStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  files: UploadSessionFile[];
}

export interface UploadSessionSummary {
  id: string;
  kind: UploadSessionKind;
  memoryId: string | null;
  title: string | null;
  expectedFileCount: number;
  completedFileCount: number;
  status: UploadSessionStatus;
  updatedAt: string;
  expiresAt: string;
}

export interface UploadSessionMatchRequest {
  files: Array<{
    localId: string;
    resumeFingerprint: string;
    occurrenceIndex: number;
    filename: string;
    sizeBytes: number;
  }>;
}

export interface UploadSessionMatchResponse {
  matches: Array<{
    localId: string;
    sessionFileId: string;
    status: UploadSessionFileStatus;
  }>;
  missingSessionFileIds: string[];
  unmatchedLocalIds: string[];
}

export interface SessionAuthorizedUpload extends AuthorizedUpload {
  sessionFileId: string;
}

export interface AuthorizeSessionBatchRequest {
  sessionFileIds: string[];
}

export interface AuthorizeSessionBatchResponse {
  uploads: SessionAuthorizedUpload[];
}

export interface RecordSessionUploadRequest {
  sessionFileId: string;
  objectKey: string;
}

export interface RecordSessionFailureRequest {
  sessionFileId: string;
  errorCode: string;
}

export interface UpdateSessionFileRequest {
  targetVisibility?: Visibility;
  reviewSortOrder?: number;
  allowDuplicate?: boolean;
  skipped?: boolean;
}

export interface UpdateSessionReviewRequest {
  proposedCoverSessionFileId: string | null;
  files: Array<{
    sessionFileId: string;
    reviewSortOrder: number;
    targetVisibility: Visibility;
    allowDuplicate: boolean;
    skipped: boolean;
  }>;
}

export interface UploadSessionDuplicate {
  sessionFileId: string;
  contentHash: string;
  allowDuplicate: boolean;
  skipped: boolean;
}

export interface CheckUploadSessionDuplicatesResponse {
  duplicates: UploadSessionDuplicate[];
}

export interface ApiErrorBody {
  error: string;
  details?: string[];
}
