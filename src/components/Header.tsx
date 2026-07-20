import { LockKeyhole, LogIn, Menu, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Brand } from './Brand';

interface HeaderProps { isSignedIn: boolean; onSignIn: () => void; onSignOut: () => void; }

export function Header({ isSignedIn, onSignIn, onSignOut }: HeaderProps) {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="privacy-mark"><LockKeyhole size={15}/><span>{isSignedIn ? 'PRIVATE GALLERY' : 'OUR GALLERY'}</span></div>
      <Brand />
      <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle menu"><Menu /></button>
      <nav className={open ? 'nav open' : 'nav'}>
        <NavLink to="/">Home</NavLink>
        <NavLink to="/gallery">Gallery</NavLink>
        <a href="#journal">Journal</a>
        <a href="#about">About Us</a>
        {isSignedIn ? <Link className="studio-link" to="/studio"><Upload size={15}/>Owner Studio</Link> : null}
        <button className="auth-button" onClick={isSignedIn ? onSignOut : onSignIn}>
          <LogIn size={15}/>{isSignedIn ? 'Sign out' : 'Owner login'}
        </button>
      </nav>
    </header>
  );
}
