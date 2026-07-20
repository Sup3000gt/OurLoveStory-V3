import { KeyRound } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

export function ConfigurationRequired() {
  const { t } = useTranslation();

  return (
    <main className="configuration-required">
      <KeyRound size={42} />
      <h1>{t('config.title')}</h1>
      <p>{t('config.body')}</p>
    </main>
  );
}
