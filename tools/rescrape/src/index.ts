import { scrape } from './scraper';

scrape().catch(err => {
    console.error('Fatal error:', err);
});
