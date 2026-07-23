import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { GalleryGrid } from '../components/GalleryGrid';
import { ShareLinkButton } from '../components/ShareLinkButton';
import { TimelineMonthNavigator } from '../components/TimelineMonthNavigator';
import { useTimeline } from '../hooks/useTimeline';
import { timelineMonthTranslationKeys } from '../i18n/translations';
import { useTranslation } from '../i18n/useTranslation';
import { getGalleryPageState } from '../lib/gallery-pagination';
import { parseTimelineMonthKey } from '../lib/timeline';
import { adjacentTimelineMonths } from '../lib/timeline-navigation';
import { useTimelineMonth } from '../hooks/useTimelineMonth';

export function TimelineMonthPage() {
  const { monthKey = '' } = useParams();
  const { t } = useTranslation();
  const month = parseTimelineMonthKey(monthKey);
  const timelineQuery = useTimeline();
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
  const adjacentMonths = timelineQuery.data
    ? adjacentTimelineMonths(timelineQuery.data.years.flatMap((year) => year.months), monthKey)
    : { previous: null, next: null };

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
        <div className="timeline-month-heading">
          <h1>{monthLabel}</h1>
          {month ? (
            <ShareLinkButton
              title={monthLabel}
              url={window.location.origin + '/timeline/' + monthKey}
              label={t('share.label')}
              copiedLabel={t('share.copied')}
              fallbackLabel={t('share.manual')}
            />
          ) : null}
        </div>
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
        <>
          <TimelineMonthNavigator {...adjacentMonths} />
          <GalleryGrid memories={monthPage.memories} variant="masonry" isOwner={false} />
        </>
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
      {month ? <TimelineMonthNavigator {...adjacentMonths} /> : null}
    </main>
  );
}
