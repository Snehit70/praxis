// DOM environment for frontend component tests, scoped to the `src` test run
// via `bun test --preload` (see package.json `test:unit`). The server
// integration suite runs without this, on clean Bun globals.
//
// Order matters: happy-dom must register `document`/`window` on globalThis
// BEFORE @testing-library/dom is loaded, because its `screen` export binds to
// `document.body` at module-evaluation time. A static `import` of Testing
// Library here would be hoisted ahead of registration and permanently stub
// `screen` into a throwing state — hence the dynamic imports below.
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { afterEach } from 'bun:test';

GlobalRegistrator.register();

// Now that the DOM globals exist, pull in the jest-dom matchers and RTL.
await import('@testing-library/jest-dom');
const { cleanup } = await import('@testing-library/react');

// Unmount React trees between tests so the document never leaks across cases.
afterEach(() => {
  cleanup();
});
