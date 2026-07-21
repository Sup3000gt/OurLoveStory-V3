import {
  createContext,
  type ReactNode,
  useContext,
} from 'react';
import type {
  UploadSession,
} from '../../shared/contracts';
import {
  usePhotoSessionUpload,
  type SelectedPhoto,
} from '../hooks/usePhotoSessionUpload';

type PhotoSessionUploadValue =
  ReturnType<
    typeof usePhotoSessionUpload
  >;

const PhotoSessionUploadContext =
  createContext<
    PhotoSessionUploadValue | null
  >(null);

export interface PhotoSessionUploadProviderProps {
  children: ReactNode;
}

export function PhotoSessionUploadProvider({
  children,
}: PhotoSessionUploadProviderProps) {
  const workflow =
    usePhotoSessionUpload();

  return (
    <PhotoSessionUploadContext.Provider
      value={workflow}
    >
      {children}
    </PhotoSessionUploadContext.Provider>
  );
}

export function usePhotoSessionUploadContext():
  PhotoSessionUploadValue {
  const value =
    useContext(
      PhotoSessionUploadContext,
    );

  if (!value) {
    throw new Error(
      'usePhotoSessionUploadContext must be used inside PhotoSessionUploadProvider.',
    );
  }

  return value;
}

export function hasLocalSession(
  session:
    Pick<UploadSession, 'id'>
    | null,
  sessionId: string,
): boolean {
  return session?.id === sessionId;
}

export function buildSessionPhotoLookup(
  photos: SelectedPhoto[],
): Map<string, SelectedPhoto> {
  return new Map(
    photos.flatMap((photo) =>
      photo.sessionFileId
        ? [[
            photo.sessionFileId,
            photo,
          ] as const]
        : [],
    ),
  );
}