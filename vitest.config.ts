import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const pkgUrl = new URL('./package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8')) as { version: string };

export default defineConfig({
  define: {
    __PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**'],
    },
  },
});
