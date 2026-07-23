import { TimelinePhoto } from '../components/TimelinePhoto';
import { useTimeline } from '../hooks/useTimeline';
import { useTranslation } from '../i18n/useTranslation';
import { timelineCoverHref } from '../lib/timeline';

export function TimelinePage() {
  const { data: timeline, error, isLoading } = useTimeline();
  const { t } = useTranslation();
  const photoCountLabel = (count: number) => t(
    count === 1 ? 'timeline.photoCount.one' : 'timeline.photoCount.many',
    { count },
  );

  return (
    <main className="page-shell timeline-page">
      <header className="page-intro">
        <p>{t('timeline.eyebrow')}</p>
        <h1>{t('timeline.title')}</h1>
        <span>{t('timeline.subtitle')}</span>
      </header>
      {isLoading ? <div className="gallery-status">{t('timeline.loading')}</div> : null}
      {error ? <div className="gallery-status error">{t('timeline.loadError')}</div> : null}
      {!isLoading && !error && timeline?.years.length === 0 ? (
        <div className="gallery-status">{t('timeline.empty')}</div>
      ) : null}
      {timeline?.years.length ? (
        <section className="timeline-river" aria-label={t('timeline.riverLabel')}>
          {timeline.years.map((year, yearIndex) => {
            const months = year.months.filter((month) => month.photoCount > 0);
            return (
              <section className="timeline-year" key={year.key}>
                <div className="timeline-year-marker" aria-hidden="true">
                  <span />
                </div>
                <div className="timeline-year-content">
                  <div className="timeline-period-heading">
                    <h2 data-timeline-period-label>{year.label}</h2>
                    <span>{photoCountLabel(year.photoCount)}</span>
                  </div>
                  <article className="timeline-year-card">
                    <a className="timeline-cover-link" href={timelineCoverHref(year.cover)}>
                      <TimelinePhoto
                        photo={year.cover}
                        periodLabel={year.label}
                        loading={yearIndex === 0 ? 'eager' : 'lazy'}
                      />
                      <span className="timeline-card-caption">{t('timeline.yearCover')}</span>
                    </a>
                  </article>
                  {months.length ? (
                    <div className="timeline-month-grid">
                      {months.map((month) => (
                        <article className="timeline-month-card" key={month.key}>
                          <a className="timeline-cover-link" href={timelineCoverHref(month.cover)}>
                            <TimelinePhoto
                              photo={month.cover}
                              periodLabel={month.label}
                              loading="lazy"
                            />
                            <div className="timeline-month-copy">
                              <h3 data-timeline-period-label>{month.label}</h3>
                              <span>{photoCountLabel(month.photoCount)}</span>
                            </div>
                          </a>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}
