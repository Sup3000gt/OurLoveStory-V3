import { ArrowRight, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Memory } from '../data/memories';
import { GalleryGrid } from '../components/GalleryGrid';

export function HomePage({ memories }: { memories: Memory[] }) {
  return (
    <main>
      <section className="hero-shell">
        <div className="hero-image"><img src="/media/hero.jpg" alt="A couple sharing a quiet moment at sunset" /></div>
        <div className="hero-copy">
          <p className="hero-title">the little moments<br/>that mean <em>everything</em></p>
          <Heart className="hero-heart" size={24} fill="currentColor" />
          <p>A private gallery of our favorite memories,<br/>the places we've been, and the moments<br/>we never want to forget.</p>
          <Link to="/gallery" className="primary-button">Our Journey <ArrowRight size={16}/></Link>
          <div className="paper-note">collecting<br/>memories<br/>together ♡</div>
        </div>
      </section>

      <section className="section memories-section">
        <header className="section-heading">
          <span>—</span><h2>Our Memories</h2><span>—</span>
          <p>every moment, forever us ♡</p>
        </header>
        <GalleryGrid memories={memories.slice(0, 6)} />
        <div className="center-action"><Link to="/gallery" className="text-link">Browse all memories <ArrowRight size={16}/></Link></div>
      </section>

      <section className="quote-band" id="about">
        <p>“ I choose you. And I’ll choose you, over and over and over. ♡ ”</p>
        <em>Always.</em>
      </section>
    </main>
  );
}
