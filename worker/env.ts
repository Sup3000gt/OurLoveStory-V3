export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  IMAGES: ImagesBinding;
  ASSETS: Fetcher;
  CLERK_SECRET_KEY: string;
  CLERK_JWT_KEY?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  IMAGE_SOURCE_SIGNING_KEY: string;
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}

export interface OwnerIdentity {
  userId: string;
  email: string;
  displayName: string;
}
