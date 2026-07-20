import { ClerkProvider } from '@clerk/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ConfigurationRequired } from './components/ConfigurationRequired';
import { LanguageProvider } from './i18n/LanguageProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false },
  },
});
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const isConfigured = Boolean(publishableKey && !publishableKey.includes('replace_me'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      {isConfigured ? (
        <ClerkProvider publishableKey={publishableKey} afterSignOutUrl="/">
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </ClerkProvider>
      ) : (
        <ConfigurationRequired />
      )}
    </LanguageProvider>
  </StrictMode>,
);
