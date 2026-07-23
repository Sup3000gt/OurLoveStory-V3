import type { Memory } from '../../shared/contracts';
import type { MemoryFacets } from '../../shared/memory-discovery';
import { GalleryGrid } from '../components/GalleryGrid';
import { ActiveFilterSummary } from '../components/gallery/ActiveFilterSummary';
import { GalleryFilters } from '../components/gallery/GalleryFilters';
import { GallerySearchBar } from '../components/gallery/GallerySearchBar';
import { MobileFilterSheet } from '../components/gallery/MobileFilterSheet';
import { ShareLinkButton } from '../components/ShareLinkButton';
import { useTranslation } from '../i18n/useTranslation';
import {
  hasActiveGalleryFilters,
  toGallerySearch,
  type GalleryFilterState,
} from '../lib/gallery-filters';

interface GalleryPageProps {
  memories: Memory[];
  isLoading: boolean;
  error: Error | null;
  isOwner: boolean;
  filters: GalleryFilterState;
  facets: MemoryFacets | undefined;
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  isFetchingPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onFiltersChange: (next: GalleryFilterState) => void;
  onClearFilters: () => void;
  onPrefetchNextPage: () => void;
}

export function GalleryPage({
  memories,
  isLoading,
  error,
  isOwner,
  filters,
  facets,
  totalCount,
  currentPage,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  isFetchingPage,
  onPreviousPage,
  onNextPage,
  onFiltersChange,
  onClearFilters,
  onPrefetchNextPage,
}: GalleryPageProps) {
  const { t } = useTranslation();
  const hasActiveFilters = hasActiveGalleryFilters(filters);
  const galleryUrl = window.location.origin + '/gallery' + toGallerySearch(filters);

  return (
    <main className="page-shell">
      <header className="page-intro">
        <p>{t('gallery.eyebrow')}</p>
        <h1>{t('gallery.title')}</h1>
        <span>{t('gallery.subtitle')}</span>
      </header>
      <section className="gallery-discovery-panel">
        <GallerySearchBar
          value={filters.query}
          onChange={(query) => onFiltersChange({ ...filters, query })}
          onClear={() => onFiltersChange({ ...filters, query: '' })}
        />
        <div className="gallery-desktop-filters">
          <GalleryFilters
            state={filters}
            facets={facets}
            onChange={onFiltersChange}
            onClear={onClearFilters}
          />
        </div>
        <MobileFilterSheet state={filters} facets={facets} onApply={onFiltersChange} />
        <div className="gallery-share-actions">
          <ShareLinkButton
            title={t('gallery.title')}
            url={galleryUrl}
            label={t('share.label')}
            copiedLabel={t('share.copied')}
            fallbackLabel={t('share.manual')}
          />
          {isOwner && hasActiveFilters ? <p>{t('gallery.publicShareHint')}</p> : null}
        </div>
      </section>
      <ActiveFilterSummary state={filters} facets={facets} totalCount={totalCount} />
      {isLoading ? <div className="gallery-status">{t('gallery.loading')}</div> : null}
      {error ? <div className="gallery-status error">{t('gallery.loadError')}</div> : null}
      {!isLoading && !error && memories.length === 0 ? (
        <div className="gallery-status">
          {hasActiveFilters ? t('gallery.noResults') : t('gallery.empty')}
        </div>
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
            onFocus={onPrefetchNextPage}
            onMouseEnter={onPrefetchNextPage}
          >
            {isFetchingPage ? t('gallery.loadingPage') : t('gallery.nextPage')}
          </button>
        </nav>
      ) : null}
    </main>
  );
}
