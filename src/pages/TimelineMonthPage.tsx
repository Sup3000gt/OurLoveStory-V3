import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { GalleryGrid } from '../components/GalleryGrid';
import { timelineMonthTranslationKeys } from '../i18n/translations';
import { useTranslation } from '../i18n/useTranslation';
import { getGalleryPageState } from '../lib/gallery-pagination';
import { parseTimelineMonthKey } from '../lib/timeline';
import { useTimelineMonth } from '../hooks/useTimelineMonth';

export function TimelineMonthPage() {
  const { monthKey = '' } = useParams();
  const { t } = useTranslation();
  const month = parseTimelineMonthKey(monthKey);
  const monthQuery = useTimelineMonth(monthKey);
  const [pageIndex, setPageIndex] = useState(0);
  const monthPage = getGalleryPageState(
    monthQuery.data?.pages,
    pageIndex,
    Boolean(monthQuery.hasNextPage),
  );
  const monthLabel = month
    ? t('timeline.monthLabel', {
      month: t(timelineMonthTranslationKeys[month.month]),
      year: month.year,
    })
    : t('timeline.title');

  const goToPreviousPage = () => {
    setPageIndex((currentPage) => Math.max(currentPage - 1, 0));
  };

  const goToNextPage = () => {
    if (pageIndex < monthPage.totalPages - 1) {
      setPageIndex((currentPage) => currentPage + 1);
      return;
    }

    if (!monthQuery.hasNextPage || monthQuery.isFetchingNextPage) return;

    void monthQuery.fetchNextPage().then((result) => {
      const pages = result.data?.pages;
      if (pages?.length) setPageIndex(pages.length - 1);
    });
  };

  return (
    <main className="page-shell timeline-month-page">
      <a className="timeline-month-back text-link" href="/timeline">
        ← {t('timeline.backToTimeline')}
      </a>
      <header className="page-intro">
        <p>{t('timeline.monthEyebrow')}</p>
        <h1>{monthLabel}</h1>
        <span>
          {month ? t('timeline.monthSubtitle') : t('timeline.invalidMonth')}
        </span>
      </header>

      {month && monthQuery.isLoading ? (
        <div className="gallery-status">{t('timeline.loading')}</div>
      ) : null}
      {month && monthQuery.error ? (
        <div className="gallery-status error">{t('timeline.loadError')}</div>
      ) : null}
      {!month ? (
        <div className="gallery-status error">{t('timeline.invalidMonth')}</div>
      ) : null}
      {month && !monthQuery.isLoading && !monthQuery.error && monthPage.memories.length === 0 ? (
        <div className="gallery-status">{t('timeline.monthEmpty')}</div>
      ) : null}
      {monthPage.memories.length > 0 ? (
        <GalleryGrid memories={monthPage.memories} variant="masonry" isOwner={false} />
      ) : null}
      {month && monthPage.totalPages > 0 && (monthPage.hasPreviousPage || monthPage.hasNextPage) ? (
        <nav className="gallery-pagination" aria-label={t('timeline.monthPaginationLabel')}>
          <button
            className="secondary-button"
            type="button"
            onClick={goToPreviousPage}
            disabled={!monthPage.hasPreviousPage || monthQuery.isFetchingNextPage}
          >
            {t('gallery.previousPage')}
          </button>
          <span aria-live="polite">{t('gallery.page', { current: monthPage.currentPage })}</span>
          <button
            className="secondary-button"
            type="button"
            onClick={goToNextPage}
            disabled={!monthPage.hasNextPage || monthQuery.isFetchingNextPage}
          >
            {monthQuery.isFetchingNextPage ? t('gallery.loadingPage') : t('gallery.nextPage')}
          </button>
        </nav>
      ) : null}
    </main>
  );
}
