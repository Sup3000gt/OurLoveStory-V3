export interface UploadStatPhoto {
  status: string;
  targetVisibility: 'public' | 'private';
}

export interface UploadStatsValue {
  selected: number;
  uploaded: number;
  duplicate: number;
  publicCount: number;
  privateCount: number;
}

export interface UploadStatsProps {
  photos: UploadStatPhoto[];
  labels: {
    selected: string;
    uploaded: string;
    duplicate: string;
    public: string;
    private: string;
  };
}

export function calculateUploadStats(
  photos: UploadStatPhoto[],
): UploadStatsValue {
  const included = photos.filter(
    (photo) =>
      photo.status !== 'duplicate'
      && photo.status !== 'skipped',
  );

  return {
    selected: photos.length,
    uploaded: photos.filter(
      (photo) =>
        photo.status === 'uploaded',
    ).length,
    duplicate: photos.filter(
      (photo) =>
        photo.status === 'duplicate',
    ).length,
    publicCount: included.filter(
      (photo) =>
        photo.targetVisibility === 'public',
    ).length,
    privateCount: included.filter(
      (photo) =>
        photo.targetVisibility === 'private',
    ).length,
  };
}

export function UploadStats({
  photos,
  labels,
}: UploadStatsProps) {
  const stats = calculateUploadStats(photos);

  return (
    <div
      className="upload-stats"
      aria-live="polite"
    >
      <span>
        <strong>{stats.selected}</strong>
        {' '}
        {labels.selected}
      </span>
      <span>
        <strong>{stats.uploaded}</strong>
        {' '}
        {labels.uploaded}
      </span>
      <span>
        <strong>{stats.duplicate}</strong>
        {' '}
        {labels.duplicate}
      </span>
      <span>
        <strong>{stats.publicCount}</strong>
        {' '}
        {labels.public}
      </span>
      <span>
        <strong>{stats.privateCount}</strong>
        {' '}
        {labels.private}
      </span>
    </div>
  );
}