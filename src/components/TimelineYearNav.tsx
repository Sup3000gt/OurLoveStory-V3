import { useEffect } from 'react';
import type { TimelineYear } from '../../shared/contracts';
import { useTranslation } from '../i18n/useTranslation';
import { timelineYearAnchor } from '../lib/timeline-navigation';

interface TimelineYearNavProps {
  years: TimelineYear[];
}

export function TimelineYearNav({ years }: TimelineYearNavProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const anchors = new Set(years.map((year) => timelineYearAnchor(Number(year.key))));
    if (!hash || !anchors.has(hash)) return;

    const target = document.getElementById(hash);
    if (!target) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, [years]);

  return (
    <nav className="timeline-year-nav" aria-label={t('timeline.riverLabel')}>
      {years.map((year) => (
        <a href={`#${timelineYearAnchor(Number(year.key))}`} key={year.key}>
          {year.label}
        </a>
      ))}
    </nav>
  );
}
