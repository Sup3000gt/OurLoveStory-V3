import { Show, SignInButton, UserButton } from '@clerk/react';
import { LockKeyhole, LogIn, Menu, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useTranslation } from '../i18n/useTranslation';
import { Brand } from './Brand';

interface HeaderProps {
  isOwner: boolean;
  ownerName: string | null;
}

export function Header({ isOwner, ownerName }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const { language, setLanguage, t } = useTranslation();
  const closeMenu = () => setOpen(false);

  const privacyLabel = isOwner
    ? ownerName
      ? t('header.privateGalleryNamed', { name: ownerName })
      : t('header.privateGallery')
    : t('header.ourGallery');

  return (
    <header className="site-header">
      <div className="privacy-mark">
        <LockKeyhole size={15} />
        <span>{privacyLabel}</span>
      </div>
      <Brand />
      <button
        className="menu-button"
        onClick={() => setOpen((value) => !value)}
        aria-label={t('header.toggleMenu')}
        type="button"
      >
        <Menu />
      </button>
      <nav className={open ? 'nav open' : 'nav'}>
        <NavLink to="/" onClick={closeMenu}>{t('nav.home')}</NavLink>
        <NavLink to="/gallery" onClick={closeMenu}>{t('nav.gallery')}</NavLink>
        <a href="/timeline" onClick={closeMenu}>{t('nav.journal')}</a>
        <a href="/#about" onClick={closeMenu}>{t('nav.about')}</a>
        {isOwner ? (
          <Link className="studio-link" to="/studio" onClick={closeMenu}>
            <Upload size={15} />{t('nav.studio')}
          </Link>
        ) : null}
        <div className="language-switch" role="group" aria-label={t('language.label')}>
          <button
            type="button"
            className={language === 'zh' ? 'active' : ''}
            onClick={() => setLanguage('zh')}
          >
            {t('language.zh')}
          </button>
          <span aria-hidden="true">/</span>
          <button
            type="button"
            className={language === 'en' ? 'active' : ''}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
        </div>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="auth-button" type="button">
              <LogIn size={15} />{t('nav.ownerLogin')}
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </nav>
    </header>
  );
}
