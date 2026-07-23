import type { MemoryFacets } from '../../../shared/memory-discovery';
import { categoryTranslationKeys, timelineMonthTranslationKeys } from '../../i18n/translations';
import { useTranslation } from '../../i18n/useTranslation';
import { hasActiveGalleryFilters, type GalleryFilterState } from '../../lib/gallery-filters';

interface ActiveFilterSummaryProps {
  state: GalleryFilterState;
  totalCount: number;
  facets: MemoryFacets | undefined;
}

export function ActiveFilterSummary({ state, totalCount, facets }: ActiveFilterSummaryProps) {
  const { t } = useTranslation();
  const hasActiveFilters = hasActiveGalleryFilters(state);
  const selectedYear = facets?.years.find((item) => String(item.year) === state.year);
  const monthIsAvailable = selectedYear?.months.includes(state.month ?? -1);

  return (
    <div className="gallery-result-summary" aria-live="polite">
      <span>{t('gallery.resultCount', { count: totalCount })}</span>
      {hasActiveFilters ? (
        <span className="gallery-active-filters">
          {state.query ? <span>{state.query}</span> : null}
          {state.category !== 'All' ? <span>{t(categoryTranslationKeys[state.category])}</span> : null}
          {state.year ? <span>{state.year}</span> : null}
          {state.month !== null && monthIsAvailable
            ? <span>{t(timelineMonthTranslationKeys[state.month])}</span>
            : null}
        </span>
      ) : null}
    </div>
  );
}
