import { useMemo, useState } from 'react';
import type { Memory } from '../../shared/contracts';
import { MEMORY_CATEGORIES } from '../../shared/contracts';
import { GalleryGrid } from '../components/GalleryGrid';
import { categoryTranslationKeys } from '../i18n/translations';
import { useTranslation } from '../i18n/useTranslation';

interface GalleryPageProps {
  memories: Memory[];
  isLoading: boolean;
  error: Error | null;
  isOwner: boolean;
  currentPage: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isFetchingPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function GalleryPage({
  memories,
  isLoading,
  error,
  isOwner,
  currentPage,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  isFetchingPage,
  onPreviousPage,
  onNextPage,
}: GalleryPageProps) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string>('All');
  const categories = ['All', ...MEMORY_CATEGORIES];
  const filtered = useMemo(
    () => (category === 'All' ? memories : memories.filter((memory) => memory.category === category)),
    [category, memories],
  );

  return (
    <main className="page-shell">
      <header className="page-intro">
        <p>{t('gallery.eyebrow')}</p>
        <h1>{t('gallery.title')}</h1>
        <span>{t('gallery.subtitle')}</span>
      </header>
      <div className="filter-row" role="group" aria-label={t('gallery.filterLabel')}>
        {categories.map((item) => {
          const label = item === 'All'
            ? t('gallery.all')
            : t(categoryTranslationKeys[item as keyof typeof categoryTranslationKeys]);
          return (
            <button
              key={item}
              className={category === item ? 'active' : ''}
              onClick={() => setCategory(item)}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>
      {isLoading ? <div className="gallery-status">{t('gallery.loading')}</div> : null}
      {error ? <div className="gallery-status error">{t('gallery.loadError')}</div> : null}
      {!isLoading && !error && filtered.length === 0 ? (
        <div className="gallery-status">{t('gallery.empty')}</div>
      ) : null}
      {filtered.length > 0 ? (
        <GalleryGrid memories={filtered} variant="masonry" isOwner={isOwner} />
      ) : null}
      {totalPages > 0 && (hasPreviousPage || hasNextPage) ? (
        <nav className="gallery-pagination" aria-label={t('gallery.paginationLabel')}>
          <button
            className="secondary-button"
            type="button"
            onClick={onPreviousPage}
            disabled={!hasPreviousPage || isFetchingPage}
          >
            {t('gallery.previousPage')}
          </button>
          <span aria-live="polite">
            {t('gallery.page', { current: currentPage })}
          </span>
          <button
            className="secondary-button"
            type="button"
            onClick={onNextPage}
            disabled={!hasNextPage || isFetchingPage}
          >
            {isFetchingPage ? t('gallery.loadingPage') : t('gallery.nextPage')}
          </button>
        </nav>
      ) : null}
    </main>
  );
}
