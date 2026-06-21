// Teach `bun:test`'s `expect` about the @testing-library/jest-dom custom
// matchers (toBeInTheDocument, toHaveClass, toHaveAccessibleName, ...). The
// matchers are registered at runtime by test/setup-dom.ts; this declaration
// merge gives them types for editors and any tsc pass over the test files.
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers';

declare module 'bun:test' {
  // Empty bodies are the point: these merge the jest-dom matchers onto the
  // existing bun:test interfaces.
  /* eslint-disable @typescript-eslint/no-empty-object-type */
  interface Matchers<T = unknown> extends TestingLibraryMatchers<unknown, T> {}
  interface AsymmetricMatchers extends TestingLibraryMatchers<unknown, unknown> {}
  /* eslint-enable @typescript-eslint/no-empty-object-type */
}
