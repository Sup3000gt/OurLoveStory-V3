import { useTranslation } from '../i18n/useTranslation';

export function Brand() {
  const { t } = useTranslation();

  return (
    <a className="brand" href="/" aria-label={t('brand.title')}>
      <strong>{t('brand.title')}</strong>
      <span>{t('brand.subtitle')}</span>
    </a>
  );
}
