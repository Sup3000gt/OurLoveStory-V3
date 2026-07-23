import { ArrowRight, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Memory } from '../../shared/contracts';
import { GalleryGrid } from '../components/GalleryGrid';
import { useTranslation } from '../i18n/useTranslation';

interface HomePageProps {
  memories: Memory[];
  isLoading: boolean;
  error: Error | null;
  isOwner: boolean;
}

export function HomePage({
  memories,
  isLoading,
  error,
  isOwner,
}: HomePageProps) {
  const { t } = useTranslation();
  const published = memories.filter((memory) => memory.status === 'published');
  const featured = published.filter((memory) => memory.featured);
  const homeMemories = (featured.length ? featured : published).slice(0, 6);

  return (
    <main>
      <section className="hero-shell">
        <div className="hero-collage" aria-label={t('brand.title')}>
          <figure className="hero-photo hero-photo-primary">
            <img
              src="/media/hero-primary.jpg"
              alt={t('brand.title')}
              fetchPriority="high"
            />
          </figure>
          <figure className="hero-photo hero-photo-secondary">
            <img
              src="/media/hero-secondary.jpg"
              alt={t('brand.title')}
            />
          </figure>
          <span className="hero-tape hero-tape-primary" aria-hidden="true" />
          <span className="hero-tape hero-tape-secondary" aria-hidden="true" />
        </div>

        <div className="hero-copy">
          <p className="hero-title">
            {t('home.heroLine1')}<br />
            {t('home.heroLine2')} <em>{t('home.heroEverything')}</em>
          </p>
          <Heart className="hero-heart" size={24} fill="currentColor" />
          <p>{t('home.heroIntro')}</p>
          <Link to="/gallery" className="primary-button">
            {t('home.journey')} <ArrowRight size={16} />
          </Link>
          <div className="paper-note">
            {t('home.noteLine1')}<br />
            {t('home.noteLine2')}<br />
            {t('home.noteLine3')}
          </div>
        </div>
      </section>

      <section className="section memories-section" id="journal">
        <header className="section-heading">
          <span>—</span><h2>{t('home.memories')}</h2><span>—</span>
          <p>{t('home.memoriesSubtitle')}</p>
        </header>
        {isLoading ? <GalleryStatus message={t('gallery.loading')} /> : null}
        {error ? <GalleryStatus message={t('gallery.loadError')} tone="error" /> : null}
        {!isLoading && !error && homeMemories.length === 0 ? (
          <GalleryStatus message={t('gallery.empty')} />
        ) : null}
        {homeMemories.length > 0 ? (
          <GalleryGrid memories={homeMemories} variant="portrait" isOwner={isOwner} />
        ) : null}
        <div className="center-action">
          <Link to="/gallery" className="text-link">
            {t('home.browseAll')} <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section className="quote-band">
        <p>{t('home.quote')}</p>
        <em>{t('home.always')}</em>
      </section>
    </main>
  );
}

function GalleryStatus({
  message,
  tone = 'normal',
}: {
  message: string;
  tone?: 'normal' | 'error';
}) {
  return <div className={`gallery-status ${tone}`}>{message}</div>;
}
