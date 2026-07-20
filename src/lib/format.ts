import type { Language } from '../i18n/translations';

export function formatMemoryDate(date: string, language: Language = 'en'): string {
  const parsed = new Date(`${date}T00:00:00Z`);

  if (language === 'zh') {
    const year = parsed.getUTCFullYear();
    const month = parsed.getUTCMonth() + 1;
    const day = parsed.getUTCDate();
    return `${year}年${month}月${day}日`;
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed);
}

export function canViewMemory(visibility: 'public' | 'private', isSignedIn: boolean): boolean {
  return visibility === 'public' || isSignedIn;
}
