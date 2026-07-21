import {
  LockKeyhole,
} from 'lucide-react';
import {
  useTranslation,
} from '../i18n/useTranslation';

export interface UploadSessionReviewPageProps {
  isOwner: boolean;
}

export function UploadSessionReviewPage({
  isOwner,
}: UploadSessionReviewPageProps) {
  const { t } = useTranslation();

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
    <main className="upload-session-review-page">
      <header className="studio-intro">
        <p>
          {t('studio.eyebrow')}
        </p>
        <h1>
          {t('studio.preview')}
        </h1>
        <em>
          {t('studio.previewHelp')}
        </em>
      </header>
    </main>
  );
}