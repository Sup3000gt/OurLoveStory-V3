import { ArrowRight, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Memory } from '../../shared/contracts';
import { GalleryGrid } from '../components/GalleryGrid';

interface HomePageProps {
  memories: Memory[];
  isLoading: boolean;
  error: Error | null;
}

export function HomePage({ memories, isLoading, error }: HomePageProps) {
  const published = memories.filter((memory) => memory.status === 'published');
  const featured = published.filter((memory) => memory.featured);
  const homeMemories = (featured.length ? featured : published).slice(0, 6);

  return (
    <main>
      <section className="hero-shell">
        <div className="hero-collage" aria-label="Two favorite portraits from our story">
          <figure className="hero-photo hero-photo-primary">
            <img
              src="/media/hero-primary.jpg"
              alt="A favorite portrait from our travels"
              fetchPriority="high"
            />
          </figure>
          <figure className="hero-photo hero-photo-secondary">
            <img
              src="/media/hero-secondary.jpg"
              alt="Another favorite portrait from our story"
            />
          </figure>
          <span className="hero-tape hero-tape-primary" aria-hidden="true" />
          <span className="hero-tape hero-tape-secondary" aria-hidden="true" />
        </div>

        <div className="hero-copy">
          <p className="hero-title">the little moments<br />that mean <em>everything</em></p>
          <Heart className="hero-heart" size={24} fill="currentColor" />
          <p>A private gallery of our favorite memories,<br />the places we've been, and the moments<br />we never want to forget.</p>
          <Link to="/gallery" className="primary-button">Our Journey <ArrowRight size={16} /></Link>
          <div className="paper-note">collecting<br />memories<br />together ♡</div>
        </div>
      </section>

      <section className="section memories-section">
        <header className="section-heading">
          <span>—</span><h2>Our Memories</h2><span>—</span>
          <p>every moment, forever us ♡</p>
        </header>
        {isLoading ? <GalleryStatus message="Gathering our memories…" /> : null}
        {error ? <GalleryStatus message={error.message} tone="error" /> : null}
        {!isLoading && !error && homeMemories.length === 0 ? (
          <GalleryStatus message="No public memories have been published yet." />
        ) : null}
        {homeMemories.length > 0 ? <GalleryGrid memories={homeMemories} variant="portrait" /> : null}
        <div className="center-action"><Link to="/gallery" className="text-link">Browse all memories <ArrowRight size={16} /></Link></div>
      </section>

      <section className="quote-band" id="about">
        <p>“ I choose you. And I’ll choose you, over and over and over. ♡ ”</p>
        <em>Always.</em>
      </section>
    </main>
  );
}

function GalleryStatus({ message, tone = 'normal' }: { message: string; tone?: 'normal' | 'error' }) {
  return <div className={`gallery-status ${tone}`}>{message}</div>;
}
