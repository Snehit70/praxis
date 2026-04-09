import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { logger } from './lib/logger'

logger.info('App initialization started');

const rootElement = document.getElementById('root');

if (!rootElement) {
  logger.error('Root element not found in DOM');
  throw new Error('Root element not found. Ensure index.html has <div id="root"></div>.');
}

logger.debug('Root element found');

try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  logger.info('App rendered successfully');
} catch (error) {
  logger.error('Failed to render app', error);
  throw error;
}
