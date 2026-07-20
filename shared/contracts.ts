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

export interface MemoryAsset {
  id: string;
  type: MediaType;
  url: string;
  downloadUrl: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sortOrder: number;
  visibility: Visibility;
}

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

export interface ApiErrorBody {
  error: string;
  details?: string[];
}
