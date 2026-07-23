import { timelineMonthTranslationKeys } from '../i18n/translations';
import { useTranslation } from '../i18n/useTranslation';
import { parseTimelineMonthKey, timelineMonthArchiveHref } from '../lib/timeline';

interface TimelineMonthNavigatorProps {
  previous: string | null;
  next: string | null;
}

export function TimelineMonthNavigator({ previous, next }: TimelineMonthNavigatorProps) {
  const { t } = useTranslation();
  const monthLabel = (monthKey: string) => {
    const month = parseTimelineMonthKey(monthKey);
    if (!month) return monthKey;

    return t('timeline.monthLabel', {
      month: t(timelineMonthTranslationKeys[month.month]),
      year: month.year,
    });
  };

  if (!previous && !next) return null;

  return (
    <nav className="timeline-month-navigator" aria-label={t('timeline.monthPaginationLabel')}>
      {previous ? (
        <a href={timelineMonthArchiveHref(previous)}>
          <span aria-hidden="true">←</span> {monthLabel(previous)}
        </a>
      ) : null}
      {next ? (
        <a href={timelineMonthArchiveHref(next)}>
          {monthLabel(next)} <span aria-hidden="true">→</span>
        </a>
      ) : null}
    </nav>
  );
}
