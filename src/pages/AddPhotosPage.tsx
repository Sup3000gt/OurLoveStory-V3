import {
  LockKeyhole,
} from 'lucide-react';
import type {
  Memory,
} from '../../shared/contracts';
import {
  useTranslation,
} from '../i18n/useTranslation';

export interface AddPhotosPageProps {
  memories: Memory[];
  isLoading: boolean;
  isOwner: boolean;
}

export function AddPhotosPage({
  memories,
  isLoading,
  isOwner,
}: AddPhotosPageProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <main className="detail-status">
        <p aria-live="polite">
          {t('detail.loading')}
        </p>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="login-required">
        <LockKeyhole size={40} />
        <h1>
          {t('studio.ownerOnlyTitle')}
        </h1>
        <p>
          {t('studio.ownerOnlyText')}
        </p>
      </main>
    );
  }

  return (
    <main className="add-photos-page">
      <header className="studio-intro">
        <p>
          {t('studio.eyebrow')}
        </p>
        <h1>
          {t('studio.uploadStep')}
        </h1>
        <em>
          {t('studio.selectedEmpty')}
        </em>
      </header>

      <div
        className="upload-empty-hint"
        data-memory-count={
          memories.length
        }
      >
        {t('studio.selectedEmpty')}
      </div>
    </main>
  );
}