import { defineConfig } from 'vitest/config';

// Firestore security-rules tests. Requires the Firestore emulator:
//   npm run test:rules   (uses `npx firebase-tools emulators:exec`)
export default defineConfig({
  test: { include: ['tests/**/*.rules.test.ts'], environment: 'node', testTimeout: 20000 },
});
