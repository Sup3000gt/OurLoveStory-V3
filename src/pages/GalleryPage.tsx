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
  category: 'All' | Memory['category'];
  currentPage: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isFetchingPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onCategoryChange: (category: 'All' | Memory['category']) => void;
}

export function GalleryPage({
  memories,
  isLoading,
  error,
  isOwner,
  category,
  currentPage,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  isFetchingPage,
  onPreviousPage,
  onNextPage,
  onCategoryChange,
}: GalleryPageProps) {
  const { t } = useTranslation();
  const categories = ['All', ...MEMORY_CATEGORIES];

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
              onClick={() => {
                if (category !== item) {
                  onCategoryChange(item as 'All' | Memory['category']);
                }
              }}
              type="button"
            >
              {label}
            </button>
          );
        })}
      </div>
      {isLoading ? <div className="gallery-status">{t('gallery.loading')}</div> : null}
      {error ? <div className="gallery-status error">{t('gallery.loadError')}</div> : null}
      {!isLoading && !error && memories.length === 0 ? (
        <div className="gallery-status">{t('gallery.empty')}</div>
      ) : null}
      {memories.length > 0 ? (
        <GalleryGrid memories={memories} variant="masonry" isOwner={isOwner} />
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
