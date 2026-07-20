import { Show, SignInButton, UserButton } from '@clerk/react';
import { LockKeyhole, LogIn, Menu, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Brand } from './Brand';

interface HeaderProps {
  isOwner: boolean;
  ownerName: string | null;
}

export function Header({ isOwner, ownerName }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const closeMenu = () => setOpen(false);

  return (
    <header className="site-header">
      <div className="privacy-mark">
        <LockKeyhole size={15} />
        <span>{isOwner ? `PRIVATE GALLERY${ownerName ? ` · ${ownerName}` : ''}` : 'OUR GALLERY'}</span>
      </div>
      <Brand />
      <button className="menu-button" onClick={() => setOpen((value) => !value)} aria-label="Toggle menu">
        <Menu />
      </button>
      <nav className={open ? 'nav open' : 'nav'}>
        <NavLink to="/" onClick={closeMenu}>Home</NavLink>
        <NavLink to="/gallery" onClick={closeMenu}>Gallery</NavLink>
        <a href="/#journal" onClick={closeMenu}>Journal</a>
        <a href="/#about" onClick={closeMenu}>About Us</a>
        {isOwner ? (
          <Link className="studio-link" to="/studio" onClick={closeMenu}>
            <Upload size={15} />Owner Studio
          </Link>
        ) : null}
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="auth-button" type="button">
              <LogIn size={15} />Owner login
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
