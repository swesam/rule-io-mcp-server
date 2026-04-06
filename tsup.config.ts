import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: false,
  },
  {
    entry: ['src/bin/rule-io-mcp.ts'],
    format: ['cjs'],
    outDir: 'dist/bin',
    splitting: false,
    sourcemap: false,
    clean: false,
    minify: false,
    banner: { js: '#!/usr/bin/env node' },
  },
]);
