import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import App from './App'
import './index.css'
import { logger } from './lib/logger'

logger.info('App initialization started');

const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  logger.error('VITE_CONVEX_URL is not defined');
  throw new Error('VITE_CONVEX_URL is not defined. Please set it in your .env file.');
}

logger.debug('Convex URL validated', { convexUrl: convexUrl.substring(0, 20) + '...' });

const convex = new ConvexReactClient(convexUrl);
logger.info('Convex client initialized');

const rootElement = document.getElementById('root');

if (!rootElement) {
  logger.error('Root element not found in DOM');
  throw new Error('Root element not found. Ensure index.html has <div id="root"></div>.');
}

logger.debug('Root element found');

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </React.StrictMode>,
  );
  logger.info('App rendered successfully');
} catch (error) {
  logger.error('Failed to render app', error);
  throw error;
}
