import { useContext } from 'react';
import { LanguageContext } from './LanguageProvider';

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used inside LanguageProvider.');
  }
  return context;
}
