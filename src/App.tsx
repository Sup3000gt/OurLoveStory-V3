import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { useMemories } from './hooks/useMemories';
import { useOwnerSession } from './hooks/useOwnerSession';
import { GalleryPage } from './pages/GalleryPage';
import { HomePage } from './pages/HomePage';
import { MemoryDetailPage } from './pages/MemoryDetailPage';
import { StudioPage } from './pages/StudioPage';
import './styles/global.css';
import './styles/feature-upgrades.css';

export default function App() {
  const ownerSession = useOwnerSession();
  const memories = useMemories();
  const isOwner = ownerSession.data?.isOwner ?? false;

  return (
    <BrowserRouter>
      <Header isOwner={isOwner} ownerName={ownerSession.data?.displayName ?? null} />
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              memories={memories.data ?? []}
              isLoading={memories.isLoading}
              error={memories.error}
              isOwner={isOwner}
            />
          }
        />
        <Route
          path="/gallery"
          element={
            <GalleryPage
              memories={memories.data ?? []}
              isLoading={memories.isLoading}
              error={memories.error}
              isOwner={isOwner}
            />
          }
        />
        <Route
          path="/memory/:memoryId"
          element={
            <MemoryDetailPage
              memories={memories.data ?? []}
              isLoading={memories.isLoading}
              isOwner={isOwner}
            />
          }
        />
        <Route
          path="/studio"
          element={
            <StudioPage
              isOwner={isOwner}
              ownerCheckLoading={ownerSession.isLoading}
              ownerCheckError={ownerSession.error}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
