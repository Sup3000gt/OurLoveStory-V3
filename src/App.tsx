import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom';
import { useState } from 'react';
import type { Memory } from '../shared/contracts';
import {
  Header,
} from './components/Header';
import {
  PhotoSessionUploadProvider,
} from './contexts/PhotoSessionUploadContext';
import {
  useMemories,
} from './hooks/useMemories';
import {
  useOwnerSession,
} from './hooks/useOwnerSession';
import { getGalleryPageState } from './lib/gallery-pagination';
import {
  AddPhotosPage,
} from './pages/AddPhotosPage';
import {
  GalleryPage,
} from './pages/GalleryPage';
import {
  HomePage,
} from './pages/HomePage';
import {
  MemoryDetailPage,
} from './pages/MemoryDetailPage';
import {
  StudioPage,
} from './pages/StudioPage';
import {
  UploadSessionReviewPage,
} from './pages/UploadSessionReviewPage';
import './styles/global.css';
import './styles/feature-upgrades.css';

export default function App() {
  const ownerSession =
    useOwnerSession();

  const memoryQuery =
    useMemories();

  const [galleryCategory, setGalleryCategory] =
    useState<'All' | Memory['category']>('All');
  const galleryQuery =
    useMemories(
      galleryCategory === 'All'
        ? undefined
        : galleryCategory,
    );

  const [galleryPageIndex, setGalleryPageIndex] = useState(0);
  const memoryPages = memoryQuery.data?.pages;
  const galleryMemoryPages = galleryQuery.data?.pages;
  const memories =
    memoryPages?.flatMap((page) => page.memories)
    ?? [];
  const galleryPage = getGalleryPageState(
    galleryMemoryPages,
    galleryPageIndex,
    Boolean(galleryQuery.hasNextPage),
  );

  const goToPreviousGalleryPage = () => {
    setGalleryPageIndex((pageIndex) => Math.max(pageIndex - 1, 0));
  };

  const goToNextGalleryPage = () => {
    if (galleryPageIndex < galleryPage.totalPages - 1) {
      setGalleryPageIndex((pageIndex) => pageIndex + 1);
      return;
    }

    if (!galleryQuery.hasNextPage || galleryQuery.isFetchingNextPage) return;

    void galleryQuery.fetchNextPage().then((result) => {
      const pages = result.data?.pages;
      if (pages?.length) setGalleryPageIndex(pages.length - 1);
    });
  };

  const isOwner =
    ownerSession.data?.isOwner
    ?? false;

  return (
    <BrowserRouter>
      <Header
        isOwner={isOwner}
        ownerName={
          ownerSession.data
            ?.displayName
          ?? null
        }
      />

      <PhotoSessionUploadProvider>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                memories={
                  memories
                }
                isLoading={
                  memoryQuery.isLoading
                }
                error={
                  memoryQuery.error
                }
                isOwner={isOwner}
              />
            }
          />

          <Route
            path="/gallery"
            element={
              <GalleryPage
                memories={
                  galleryPage.memories
                }
                isLoading={
                  galleryQuery.isLoading
                }
                error={
                  galleryQuery.error
                }
                isOwner={isOwner}
                category={galleryCategory}
                currentPage={galleryPage.currentPage}
                totalPages={galleryPage.totalPages}
                hasPreviousPage={galleryPage.hasPreviousPage}
                hasNextPage={galleryPage.hasNextPage}
                isFetchingPage={galleryQuery.isFetchingNextPage}
                onPreviousPage={goToPreviousGalleryPage}
                onNextPage={goToNextGalleryPage}
                onCategoryChange={(category) => {
                  setGalleryPageIndex(0);
                  setGalleryCategory(category);
                }}
              />
            }
          />

          <Route
            path="/memory/:memoryId/add-photos"
            element={
              <AddPhotosPage
                memories={
                  memories
                }
                isLoading={
                  memoryQuery.isLoading
                }
                isOwner={isOwner}
              />
            }
          />

          <Route
            path="/memory/:memoryId"
            element={
              <MemoryDetailPage
                memories={
                  memories
                }
                isLoading={
                  memoryQuery.isLoading
                }
                isOwner={isOwner}
              />
            }
          />

          <Route
            path="/studio"
            element={
              <StudioPage
                isOwner={isOwner}
                ownerCheckLoading={
                  ownerSession
                    .isLoading
                }
                ownerCheckError={
                  ownerSession.error
                }
              />
            }
          />

          <Route
            path="/upload-sessions/:sessionId/review"
            element={
              <UploadSessionReviewPage
                isOwner={isOwner}
              />
            }
          />
        </Routes>
      </PhotoSessionUploadProvider>
    </BrowserRouter>
  );
}
