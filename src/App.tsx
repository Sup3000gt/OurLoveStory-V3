import { useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { demoMemories } from './data/memories';
import { canViewMemory } from './lib/format';
import { GalleryPage } from './pages/GalleryPage';
import { HomePage } from './pages/HomePage';
import { StudioPage } from './pages/StudioPage';
import './styles/global.css';

export default function App() {
  const [demoSignedIn, setDemoSignedIn] = useState(false);
  const visibleMemories = demoMemories.filter((memory) => canViewMemory(memory.visibility, demoSignedIn));
  return (
    <BrowserRouter>
      <Header isSignedIn={demoSignedIn} onSignIn={() => setDemoSignedIn(true)} onSignOut={() => setDemoSignedIn(false)}/>
      <Routes>
        <Route path="/" element={<HomePage memories={visibleMemories}/>}/>
        <Route path="/gallery" element={<GalleryPage memories={visibleMemories}/>}/>
        <Route path="/studio" element={<StudioPage isSignedIn={demoSignedIn}/>}/>
      </Routes>
    </BrowserRouter>
  );
}
