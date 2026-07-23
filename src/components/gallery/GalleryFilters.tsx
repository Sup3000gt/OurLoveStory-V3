import { MEMORY_CATEGORIES, type Memory } from '../../../shared/contracts';
import type { MemoryFacets } from '../../../shared/memory-discovery';
import { categoryTranslationKeys, timelineMonthTranslationKeys } from '../../i18n/translations';
import { useTranslation } from '../../i18n/useTranslation';
import type { GalleryFilterState } from '../../lib/gallery-filters';

interface GalleryFiltersProps {
  state: GalleryFilterState;
  facets: MemoryFacets | undefined;
  onChange: (next: GalleryFilterState) => void;
  onClear: () => void;
}

export function GalleryFilters({ state, facets, onChange, onClear }: GalleryFiltersProps) {
  const { t } = useTranslation();
  const categories: Array<'All' | Memory['category']> = ['All', ...MEMORY_CATEGORIES];
  const years = facets?.years ?? [];
  const selectedYear = years.find((item) => String(item.year) === state.year);

  function changeYear(year: string) {
    onChange({
      ...state,
      year,
      month: year === state.year ? state.month : null,
    });
  }

  return (
    <section className="gallery-filters gallery-filter-toolbar" aria-label={t('gallery.filterLabel')}>
      <div className="gallery-category-chips gallery-category-chips--single-row gallery-category-chips--expanded" role="group" aria-label={t('gallery.filterLabel')}>
        {categories.map((category) => {
          const label = category === 'All'
            ? t('gallery.all')
            : t(categoryTranslationKeys[category]);
          return (
            <button
              key={category}
              className={state.category === category ? 'active' : ''}
              type="button"
              aria-pressed={state.category === category}
              onClick={() => onChange({ ...state, category })}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="gallery-date-filters gallery-date-filters--compact">
        <label htmlFor="gallery-filter-year">{t('gallery.year')}</label>
        <select
          id="gallery-filter-year"
          name="year"
          value={state.year}
          onChange={(event) => changeYear(event.target.value)}
        >
          <option value="">{t('gallery.allYears')}</option>
          {years.map(({ year }) => <option key={year} value={year}>{year}</option>)}
        </select>
        <label htmlFor="gallery-filter-month">{t('gallery.month')}</label>
        <select
          id="gallery-filter-month"
          name="month"
          value={state.month ?? ''}
          disabled={!state.year}
          onChange={(event) => onChange({
            ...state,
            month: event.target.value ? Number(event.target.value) : null,
          })}
        >
          <option value="">{t('gallery.allMonths')}</option>
          {selectedYear?.months.map((month) => (
            <option key={month} value={month}>{t(timelineMonthTranslationKeys[month])}</option>
          ))}
        </select>
      </div>
      <button className="gallery-clear-filters gallery-clear-filters--compact" type="button" onClick={onClear}>
        {t('gallery.clear')}
      </button>
    </section>
  );
}
