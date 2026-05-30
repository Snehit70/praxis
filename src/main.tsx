import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App'
import { clerkAppearance } from './lib/clerkAppearance'
import '@fontsource-variable/geist'
import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import './index.css'
import { logger } from './lib/logger'

logger.info('App initialization started');

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!clerkPublishableKey) {
  logger.error('Missing VITE_CLERK_PUBLISHABLE_KEY');
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY. Add it to .env and restart the dev server.');
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  logger.error('Root element not found in DOM');
  throw new Error('Root element not found. Ensure index.html has <div id="root"></div>.');
}

logger.debug('Root element found');

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ClerkProvider
        publishableKey={clerkPublishableKey}
        afterSignOutUrl="/"
        appearance={clerkAppearance}
      >
        <App />
      </ClerkProvider>
    </React.StrictMode>,
  );
  logger.info('App rendered successfully');
} catch (error) {
  logger.error('Failed to render app', error);
  throw error;
}
